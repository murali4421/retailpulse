import { database, saveDatabase, broadcast } from '../data/store.js';
import { recordAuditEvent } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

// Record a new sale (from POS or synced offline)
export function createSale(req, res) {
  try {
    const {
      storeId = 'LOC-001',
      items,
      paymentMethod = 'CREDIT_CARD',
      discountAmount = 0,
      discountType = 'AMOUNT', // 'PERCENTAGE' or 'AMOUNT'
      discountRate = 0,
      taxRate: customTaxRate,
      taxName = 'Sales Tax',
      isTaxInclusive = false,
      currency = 'USD',
      currencySymbol = '$',
      offlineGenerated = false,
      clientTimestamp
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Sale must contain at least one item' });
    }

    const store = database.stores.find(s => s.id === storeId) || database.stores[0];
    const appliedTaxRate = customTaxRate !== undefined ? parseFloat(customTaxRate) : (store.taxRate ?? 0.085);

    // =========================================================================
    // MANDATORY STOCK VALIDATION BEFORE BILLING:
    // Ensure every single item has sufficient quantity in the specific store
    // =========================================================================
    for (const item of items) {
      const product = database.inventory.find(i => i.id === item.productId || i.sku === item.sku || i.barcode === item.barcode);
      if (!product) {
        return res.status(404).json({ error: `Product "${item.name || item.sku}" not found in catalog` });
      }

      const availableStock = product.stockByStore[storeId] ?? 0;
      const requestedQty = parseInt(item.quantity) || 1;

      if (availableStock < requestedQty) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available stock in store is ${availableStock}, but requested ${requestedQty}. Please adjust quantity before billing.`,
          productId: product.id,
          sku: product.sku,
          availableStock,
          requestedQty
        });
      }
    }

    let subtotal = 0;
    const validatedItems = [];

    // Deduct stock in real-time now that validation passed
    for (const item of items) {
      const product = database.inventory.find(i => i.id === item.productId || i.sku === item.sku || i.barcode === item.barcode);
      const qty = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(product.retailPrice);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      // Adjust stock in store
      if (!product.stockByStore[storeId]) product.stockByStore[storeId] = 0;
      product.stockByStore[storeId] = product.stockByStore[storeId] - qty;
      product.updatedAt = new Date().toISOString();

      validatedItems.push({
        productId: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        price: unitPrice,
        costPrice: product.costPrice,
        quantity: qty,
        lineTotal: parseFloat(lineTotal.toFixed(2))
      });

      // Automated low-stock alert if fell below threshold
      if (product.stockByStore[storeId] <= product.minAlertThreshold) {
        broadcast({
          type: 'LOW_STOCK_ALERT',
          data: {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            storeId,
            currentStock: product.stockByStore[storeId],
            threshold: product.minAlertThreshold
          }
        });
      }
    }

    // POS Setup Discount Calculation
    let calculatedDiscount = 0;
    if (discountType === 'PERCENTAGE' && discountRate > 0) {
      calculatedDiscount = parseFloat(((subtotal * discountRate) / 100).toFixed(2));
    } else {
      calculatedDiscount = parseFloat(parseFloat(discountAmount || 0).toFixed(2));
    }
    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    const discountedSubtotal = Math.max(0, subtotal - calculatedDiscount);
    let tax = 0;
    let total = 0;

    if (isTaxInclusive) {
      // Tax is already included in prices: Tax = Total - (Total / (1 + rate))
      total = parseFloat(discountedSubtotal.toFixed(2));
      tax = parseFloat((total - (total / (1 + appliedTaxRate))).toFixed(2));
    } else {
      // Tax added on top
      tax = parseFloat((discountedSubtotal * appliedTaxRate).toFixed(2));
      total = parseFloat((discountedSubtotal + tax).toFixed(2));
    }

    const saleTime = clientTimestamp ? new Date(clientTimestamp).toISOString() : new Date().toISOString();
    const orderSeq = database.sales.length + 10001;

    const newSale = {
      id: 'ORD-' + orderSeq,
      receiptNumber: `REC-${new Date().getFullYear()}-${orderSeq}`,
      timestamp: saleTime,
      storeId,
      storeName: store.name,
      cashierId: req.user?.id || 'usr_cashier',
      cashierName: req.user?.name || 'Alex Rivera',
      items: validatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discountAmount || 0),
      tax,
      total,
      paymentMethod,
      status: 'COMPLETED',
      refundReason: null,
      syncStatus: 'SYNCED',
      offlineGenerated: !!offlineGenerated
    };

    database.sales.unshift(newSale);
    saveDatabase();

    // Audit log
    recordAuditEvent({
      eventType: 'SALES_EVENT',
      action: 'SALE_TRANSACTION',
      userId: req.user?.id || 'usr_cashier',
      userEmail: req.user?.email || 'cashier@retailpulse.io',
      userRole: req.user?.role || 'cashier',
      storeId,
      status: 'SUCCESS',
      details: {
        orderId: newSale.id,
        receiptNumber: newSale.receiptNumber,
        total,
        itemCount: validatedItems.length,
        paymentMethod,
        offlineGenerated: !!offlineGenerated
      }
    });

    // Broadcast to connected dashboards
    broadcast({
      type: 'SALE_COMPLETED',
      data: newSale
    });

    return res.status(201).json(newSale);
  } catch (err) {
    console.error('Create sale error:', err);
    return res.status(500).json({ error: 'Failed to record sale' });
  }
}

// Batch Sync for Offline Transactions
export function batchSyncSales(req, res) {
  try {
    const { offlineSales } = req.body;
    if (!Array.isArray(offlineSales) || !offlineSales.length) {
      return res.status(400).json({ error: 'Array of offlineSales is required' });
    }

    const syncedResults = [];
    const errors = [];

    for (const draft of offlineSales) {
      try {
        const storeId = draft.storeId || 'LOC-001';
        const store = database.stores.find(s => s.id === storeId) || database.stores[0];
        const taxRate = store.taxRate || 0.085;

        let subtotal = 0;
        const validatedItems = [];

        for (const item of draft.items) {
          const product = database.inventory.find(i => i.id === item.productId || i.sku === item.sku || i.barcode === item.barcode);
          if (product) {
            const qty = parseInt(item.quantity) || 1;
            const unitPrice = parseFloat(product.retailPrice);
            const lineTotal = unitPrice * qty;
            subtotal += lineTotal;

            if (!product.stockByStore[storeId]) product.stockByStore[storeId] = 0;
            product.stockByStore[storeId] = Math.max(0, product.stockByStore[storeId] - qty);
            product.updatedAt = new Date().toISOString();

            validatedItems.push({
              productId: product.id,
              sku: product.sku,
              barcode: product.barcode,
              name: product.name,
              price: unitPrice,
              costPrice: product.costPrice,
              quantity: qty,
              lineTotal: parseFloat(lineTotal.toFixed(2))
            });
          }
        }

        const discountedSubtotal = Math.max(0, subtotal - parseFloat(draft.discount || 0));
        const tax = parseFloat((discountedSubtotal * taxRate).toFixed(2));
        const total = parseFloat((discountedSubtotal + tax).toFixed(2));

        const orderSeq = database.sales.length + 10001;
        const newSale = {
          id: draft.offlineId ? `ORD-SYNC-${draft.offlineId.substring(0, 6)}` : `ORD-${orderSeq}`,
          receiptNumber: draft.receiptNumber || `REC-${new Date().getFullYear()}-${orderSeq}`,
          timestamp: draft.timestamp || new Date().toISOString(),
          storeId,
          storeName: store.name,
          cashierId: req.user?.id || draft.cashierId || 'usr_cashier',
          cashierName: req.user?.name || draft.cashierName || 'Alex Rivera',
          items: validatedItems,
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount: parseFloat(draft.discount || 0),
          tax,
          total,
          paymentMethod: draft.paymentMethod || 'CASH',
          status: 'COMPLETED',
          refundReason: null,
          syncStatus: 'SYNCED',
          offlineGenerated: true
        };

        database.sales.unshift(newSale);
        syncedResults.push({
          offlineId: draft.offlineId,
          serverOrderId: newSale.id,
          receiptNumber: newSale.receiptNumber,
          status: 'SUCCESS'
        });
      } catch (e) {
        errors.push({ offlineId: draft.offlineId, error: e.message });
      }
    }

    saveDatabase();

    recordAuditEvent({
      eventType: 'SALES_EVENT',
      action: 'OFFLINE_BATCH_SYNC',
      userEmail: req.user?.email || 'cashier@retailpulse.io',
      status: 'SUCCESS',
      details: {
        syncedCount: syncedResults.length,
        errorsCount: errors.length
      }
    });

    broadcast({
      type: 'BATCH_SALES_SYNCED',
      data: { syncedCount: syncedResults.length }
    });

    return res.json({
      message: `Successfully synchronized ${syncedResults.length} offline transactions`,
      syncedCount: syncedResults.length,
      syncedResults,
      errors
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Refund a sale
export function refundSale(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const sale = database.sales.find(s => s.id === id);
  if (!sale) return res.status(404).json({ error: 'Sale transaction not found' });

  if (sale.status === 'REFUNDED') {
    return res.status(400).json({ error: 'This transaction has already been refunded' });
  }

  // Restock inventory items
  for (const item of sale.items) {
    const prod = database.inventory.find(i => i.id === item.productId);
    if (prod) {
      if (!prod.stockByStore[sale.storeId]) prod.stockByStore[sale.storeId] = 0;
      prod.stockByStore[sale.storeId] += item.quantity;
      prod.updatedAt = new Date().toISOString();
    }
  }

  sale.status = 'REFUNDED';
  sale.refundReason = reason || 'Customer requested return';
  sale.refundedAt = new Date().toISOString();
  sale.refundedBy = req.user?.email || 'manager@retailpulse.io';

  saveDatabase();

  // Audit event & suspicious alert check (if high amount)
  recordAuditEvent({
    eventType: 'SALES_EVENT',
    action: 'SALE_REFUND',
    userEmail: req.user?.email || 'manager@retailpulse.io',
    userId: req.user?.id || 'usr_mgr',
    userRole: req.user?.role || 'store_manager',
    storeId: sale.storeId,
    status: 'SUCCESS',
    severity: sale.total > 150 ? 'WARNING' : 'INFO',
    details: {
      orderId: sale.id,
      amount: sale.total,
      reason: sale.refundReason
    }
  });

  broadcast({
    type: 'SALE_REFUNDED',
    data: sale
  });

  return res.json({
    message: 'Sale refunded and stock returned to inventory successfully',
    sale
  });
}

// Get Sales List
export function getSales(req, res) {
  const { storeId, startDate, endDate, limit = 100 } = req.query;
  let list = [...database.sales];

  if (storeId && storeId !== 'ALL') {
    list = list.filter(s => s.storeId === storeId);
  }

  if (startDate) {
    const sDate = new Date(startDate);
    list = list.filter(s => new Date(s.timestamp) >= sDate);
  }

  if (endDate) {
    const eDate = new Date(endDate);
    list = list.filter(s => new Date(s.timestamp) <= eDate);
  }

  return res.json(list.slice(0, parseInt(limit)));
}

// Real-Time Analytics & Daily Sales Report Summary
export function getSalesDashboardSummary(req, res) {
  const { storeId } = req.query;
  let sales = [...database.sales];

  if (storeId && storeId !== 'ALL') {
    sales = sales.filter(s => s.storeId === storeId);
  }

  const completedSales = sales.filter(s => s.status === 'COMPLETED');

  // Overall financial metrics
  const totalRevenue = completedSales.reduce((acc, s) => acc + s.total, 0);
  const totalSubtotal = completedSales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalTax = completedSales.reduce((acc, s) => acc + s.tax, 0);
  const totalOrders = completedSales.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Cost and Gross Profit estimation
  let totalCost = 0;
  completedSales.forEach(sale => {
    sale.items.forEach(it => {
      const prod = database.inventory.find(p => p.id === it.productId);
      const cost = prod ? prod.costPrice : (it.price * 0.5);
      totalCost += cost * it.quantity;
    });
  });

  const grossProfit = totalSubtotal - totalCost;
  const grossMarginPercentage = totalSubtotal > 0 ? (grossProfit / totalSubtotal) * 100 : 0;

  // Today's stats vs Yesterday
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todaySales = completedSales.filter(s => new Date(s.timestamp).getTime() >= todayStart);
  const todayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
  const todayOrders = todaySales.length;

  // Top Selling Items
  const itemMap = {};
  completedSales.forEach(s => {
    s.items.forEach(it => {
      if (!itemMap[it.name]) {
        itemMap[it.name] = { name: it.name, quantity: 0, revenue: 0, sku: it.sku };
      }
      itemMap[it.name].quantity += it.quantity;
      itemMap[it.name].revenue += it.lineTotal;
    });
  });

  const topSellingProducts = Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Hourly sales trends (for today)
  const hourlyTrends = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i; // 8 AM to 7 PM
    const hourLabel = `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`;
    const matched = todaySales.filter(s => new Date(s.timestamp).getHours() === hour);
    const rev = matched.reduce((acc, s) => acc + s.total, 0);
    return {
      hour: hourLabel,
      revenue: parseFloat(rev.toFixed(2)),
      orders: matched.length
    };
  });

  // Daily trends for past 7 days
  const dailyTrends = [];
  for (let d = 6; d >= 0; d--) {
    const dDate = new Date(Date.now() - d * 24 * 3600 * 1000);
    const dayStr = dDate.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const dayStart = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate()).getTime();
    const dayEnd = dayStart + 24 * 3600 * 1000;

    const daySales = completedSales.filter(s => {
      const t = new Date(s.timestamp).getTime();
      return t >= dayStart && t < dayEnd;
    });

    dailyTrends.push({
      date: dayStr,
      revenue: parseFloat(daySales.reduce((acc, s) => acc + s.total, 0).toFixed(2)),
      orders: daySales.length
    });
  }

  // Payment method breakdown
  const paymentMethodStats = {};
  completedSales.forEach(s => {
    paymentMethodStats[s.paymentMethod] = (paymentMethodStats[s.paymentMethod] || 0) + s.total;
  });

  const paymentBreakdown = Object.entries(paymentMethodStats).map(([method, amount]) => ({
    method,
    amount: parseFloat(amount.toFixed(2)),
    percentage: parseFloat(((amount / totalRevenue) * 100).toFixed(1))
  }));

  // Low stock count
  const lowStockCount = database.inventory.filter(item => {
    if (storeId && storeId !== 'ALL') {
      return (item.stockByStore[storeId] ?? 0) <= item.minAlertThreshold;
    }
    return Object.values(item.stockByStore).some(qty => qty <= item.minAlertThreshold);
  }).length;

  return res.json({
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      totalOrders,
      todayOrders,
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossMarginPercentage: parseFloat(grossMarginPercentage.toFixed(1)),
      totalTaxCollected: parseFloat(totalTax.toFixed(2)),
      lowStockCount
    },
    topSellingProducts,
    hourlyTrends,
    dailyTrends,
    paymentBreakdown
  });
}
