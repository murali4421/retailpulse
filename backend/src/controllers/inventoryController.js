import { database, saveDatabase, broadcast } from '../data/store.js';
import { recordAuditEvent } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

// Get inventory items
export function listCategories(req, res) {
  const categories = Array.isArray(database.categories) && database.categories.length
    ? [...new Set(database.categories.map(cat => String(cat).trim()).filter(Boolean))]
    : ['General'];

  return res.json(categories);
}

export function addCategory(req, res) {
  const { name } = req.body || {};
  const categoryName = String(name || '').trim();

  if (!categoryName) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  if (!Array.isArray(database.categories)) {
    database.categories = [];
  }

  const normalized = categoryName.replace(/\s+/g, ' ');
  const exists = database.categories.some(cat => cat.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Category already exists' });
  }

  database.categories.push(normalized);
  saveDatabase();

  recordAuditEvent({
    eventType: 'INVENTORY_EVENT',
    action: 'CATEGORY_CREATED',
    userEmail: req.user?.email || 'admin@retailpulse.io',
    details: { category: normalized }
  });

  broadcast({ type: 'CATEGORY_UPDATED', data: { category: normalized } });

  return res.status(201).json({ category: normalized });
}

export function getInventory(req, res) {
  const { storeId, lowStockOnly, search, category } = req.query;
  let items = [...database.inventory];

  if (storeId && storeId !== 'ALL') {
    // Return items mapped with local stock
    items = items.map(item => ({
      ...item,
      currentStock: item.stockByStore[storeId] ?? 0,
      isLowStock: (item.stockByStore[storeId] ?? 0) <= item.minAlertThreshold
    }));
  } else {
    // Total stock across all locations
    items = items.map(item => {
      const totalStock = Object.values(item.stockByStore).reduce((acc, qty) => acc + qty, 0);
      const isAnyLow = Object.entries(item.stockByStore).some(([sId, qty]) => qty <= item.minAlertThreshold);
      return {
        ...item,
        currentStock: totalStock,
        isLowStock: isAnyLow
      };
    });
  }

  if (lowStockOnly === 'true') {
    items = items.filter(i => i.isLowStock);
  }

  if (category && category !== 'All') {
    items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase().trim();
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      i.barcode.includes(q) ||
      i.supplier?.toLowerCase().includes(q)
    );
  }

  return res.json(items);
}

// Barcode Lookup (for fast cashier POS or handheld scanner)
export function lookupBarcode(req, res) {
  const { barcode } = req.params;
  const { storeId = 'LOC-001' } = req.query;

  if (!barcode) {
    return res.status(400).json({ error: 'Barcode is required' });
  }

  const cleanBarcode = barcode.trim();
  const product = database.inventory.find(i => i.barcode === cleanBarcode || i.sku.toLowerCase() === cleanBarcode.toLowerCase());

  if (!product) {
    return res.status(404).json({ error: `Product with barcode "${cleanBarcode}" not found` });
  }

  const currentStock = product.stockByStore[storeId] ?? 0;
  return res.json({
    ...product,
    currentStock,
    isLowStock: currentStock <= product.minAlertThreshold
  });
}

// Add or update an inventory item
export function saveProduct(req, res) {
  const { id, name, sku, barcode, category, description, costPrice, retailPrice, minAlertThreshold, supplier, stockByStore } = req.body;

  if (!name || !sku || !barcode) {
    return res.status(400).json({ error: 'Name, SKU, and Barcode are required' });
  }

  let product = null;
  const isNew = !id;

  if (id) {
    product = database.inventory.find(i => i.id === id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
  } else {
    // Check barcode or SKU uniqueness
    const existingSku = database.inventory.find(i => i.sku.toLowerCase() === sku.toLowerCase());
    if (existingSku) return res.status(400).json({ error: `SKU "${sku}" is already in use` });

    const existingBarcode = database.inventory.find(i => i.barcode === barcode);
    if (existingBarcode) return res.status(400).json({ error: `Barcode "${barcode}" is already assigned to "${existingBarcode.name}"` });

    product = {
      id: 'prod_' + uuidv4().substring(0, 8),
      stockByStore: { 'LOC-001': 0, 'LOC-002': 0, 'LOC-003': 0 }
    };
    database.inventory.unshift(product);
  }

  product.name = name;
  product.sku = sku;
  product.barcode = barcode;
  product.category = category || 'General';
  product.description = description || '';
  product.costPrice = parseFloat(costPrice) || 0;
  product.retailPrice = parseFloat(retailPrice) || 0;
  product.minAlertThreshold = parseInt(minAlertThreshold) || 10;
  product.supplier = supplier || '';
  if (stockByStore) {
    product.stockByStore = { ...product.stockByStore, ...stockByStore };
  }
  product.updatedAt = new Date().toISOString();

  saveDatabase();

  // Audit log
  recordAuditEvent({
    eventType: 'INVENTORY_EVENT',
    action: isNew ? 'PRODUCT_CREATED' : 'PRODUCT_UPDATED',
    userEmail: req.user?.email || 'admin@retailpulse.io',
    details: { id: product.id, sku: product.sku, name: product.name }
  });

  // Real-time broadcast
  broadcast({
    type: 'INVENTORY_UPDATED',
    data: product
  });

  return res.json(product);
}

// Adjust stock (Restock or manual adjustment)
export function adjustStock(req, res) {
  const { id } = req.params;
  const { storeId, delta, reason } = req.body;

  const product = database.inventory.find(i => i.id === id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (!product.stockByStore[storeId]) {
    product.stockByStore[storeId] = 0;
  }

  const prevStock = product.stockByStore[storeId];
  product.stockByStore[storeId] = Math.max(0, prevStock + parseInt(delta));
  product.updatedAt = new Date().toISOString();

  const newStock = product.stockByStore[storeId];
  saveDatabase();

  recordAuditEvent({
    eventType: 'INVENTORY_EVENT',
    action: delta > 0 ? 'STOCK_RESTOCKED' : 'STOCK_ADJUSTED',
    userEmail: req.user?.email || 'manager@retailpulse.io',
    storeId,
    details: {
      productId: product.id,
      sku: product.sku,
      previousStock: prevStock,
      adjustment: delta,
      newStock,
      reason: reason || 'Manual count reconciliation'
    }
  });

  // Check automated low-stock alert
  if (newStock <= product.minAlertThreshold) {
    broadcast({
      type: 'LOW_STOCK_ALERT',
      data: {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        storeId,
        currentStock: newStock,
        threshold: product.minAlertThreshold
      }
    });
  }

  broadcast({
    type: 'STOCK_CHANGED',
    data: { productId: product.id, storeId, newStock }
  });

  return res.json({
    message: 'Stock updated successfully',
    product: {
      ...product,
      currentStock: newStock,
      isLowStock: newStock <= product.minAlertThreshold
    }
  });
}

// Get automated replenishment recommendations
export function getReplenishmentRecommendations(req, res) {
  const { storeId = 'LOC-001' } = req.query;

  const recommendations = database.inventory
    .filter(item => {
      const stock = item.stockByStore[storeId] ?? 0;
      return stock <= item.minAlertThreshold;
    })
    .map(item => {
      const stock = item.stockByStore[storeId] ?? 0;
      const suggestedReorderQty = Math.max(item.minAlertThreshold * 3 - stock, 10);
      return {
        productId: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        currentStock: stock,
        minAlertThreshold: item.minAlertThreshold,
        suggestedReorderQty,
        supplier: item.supplier,
        costPrice: item.costPrice,
        estimatedCost: parseFloat((suggestedReorderQty * item.costPrice).toFixed(2))
      };
    });

  return res.json({
    storeId,
    itemsToReorderCount: recommendations.length,
    totalEstimatedCost: parseFloat(recommendations.reduce((sum, r) => sum + r.estimatedCost, 0).toFixed(2)),
    items: recommendations
  });
}

// Create a Replenishment Purchase Order
export function createReorderOrder(req, res) {
  const { storeId, supplier, items, notes } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const orderNumber = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const totalCost = items.reduce((sum, it) => sum + (it.quantity * it.unitCost), 0);

  const newReorder = {
    id: 'REO_' + uuidv4().substring(0, 8),
    orderNumber,
    storeId: storeId || 'LOC-001',
    supplier: supplier || 'Various Suppliers',
    status: 'SUBMITTED',
    items,
    notes: notes || '',
    totalEstimatedCost: parseFloat(totalCost.toFixed(2)),
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email || 'manager@retailpulse.io'
  };

  database.reorders.unshift(newReorder);
  saveDatabase();

  recordAuditEvent({
    eventType: 'INVENTORY_EVENT',
    action: 'REORDER_ORDER_CREATED',
    userEmail: req.user?.email || 'manager@retailpulse.io',
    storeId,
    details: { orderNumber, totalCost, itemsCount: items.length }
  });

  return res.json(newReorder);
}

// Inter-store stock transfer
export function transferStock(req, res) {
  const { productId, fromStoreId, toStoreId, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!productId || !fromStoreId || !toStoreId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Invalid transfer parameters' });
  }

  const product = database.inventory.find(i => i.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const fromStock = product.stockByStore[fromStoreId] ?? 0;
  if (fromStock < qty) {
    return res.status(400).json({ error: `Insufficient stock in source store (${fromStock} available, ${qty} requested)` });
  }

  product.stockByStore[fromStoreId] = fromStock - qty;
  product.stockByStore[toStoreId] = (product.stockByStore[toStoreId] ?? 0) + qty;
  product.updatedAt = new Date().toISOString();

  saveDatabase();

  recordAuditEvent({
    eventType: 'INVENTORY_EVENT',
    action: 'INTER_STORE_TRANSFER',
    userEmail: req.user?.email || 'manager@retailpulse.io',
    details: {
      productId,
      sku: product.sku,
      fromStoreId,
      toStoreId,
      quantity: qty
    }
  });

  broadcast({
    type: 'STOCK_TRANSFERRED',
    data: { productId, fromStoreId, toStoreId, quantity: qty }
  });

  return res.json({
    message: 'Transfer completed successfully',
    product
  });
}
