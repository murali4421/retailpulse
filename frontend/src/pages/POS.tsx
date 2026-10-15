import React, { useState, useEffect } from 'react';
import { api, type Product, type SaleTransaction } from '../services/api';
import { offlineDb } from '../services/offlineDb';
import { syncManager } from '../services/syncManager';
import { useAuth } from '../services/authContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  Printer,
  Sparkles,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const POS: React.FC = () => {
  const { user, activeStoreId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<Array<{
    product: Product;
    quantity: number;
    price: number;
  }>>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [selectedPayment, setSelectedPayment] = useState<'CREDIT_CARD' | 'CASH' | 'APPLE_PAY' | 'GOOGLE_PAY'>('CREDIT_CARD');

  // Checkout completed receipt state
  const [completedSale, setCompletedSale] = useState<SaleTransaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Load products (from server or IndexedDB offline cache)
  const loadCatalog = async () => {
    try {
      setLoading(true);
      const isOnline = syncManager.getOnlineStatus();
      if (isOnline) {
        const prods = await api.getInventory(activeStoreId, false);
        setProducts(prods);
        // Cache in Dexie for offline use
        await offlineDb.cacheAllProducts(prods as any);
      } else {
        const cached = await offlineDb.cachedProducts.toArray();
        setProducts(cached as any);
      }
    } catch (err) {
      console.warn('Loading catalog from offline cache due to network error:', err);
      const cached = await offlineDb.cachedProducts.toArray();
      setProducts(cached as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();

    // Listen for live stock updates over WebSocket
    const unsub = api.subscribeToLiveEvents((event) => {
      if (event.type === 'STOCK_CHANGED' || event.type === 'INVENTORY_UPDATED') {
        loadCatalog();
      }
    });

    return () => unsub();
  }, [activeStoreId]);

  // Barcode scan handler
  const handleBarcodeScanned = async (scannedBarcode: string) => {
    // Look up in current loaded products
    const found = products.find(
      p => p.barcode === scannedBarcode || p.sku.toLowerCase() === scannedBarcode.toLowerCase()
    );

    if (found) {
      addToCart(found);
    } else {
      // Try server lookup if online
      try {
        const p = await api.lookupBarcode(scannedBarcode, activeStoreId);
        addToCart(p);
      } catch (err) {
        alert(`Product with barcode "${scannedBarcode}" not found in catalog.`);
      }
    }
  };

  const getProductStock = (product: Product) =>
    product.currentStock ?? product.stockByStore?.[activeStoreId] ?? 0;

  const getCartQuantity = (productId: string) =>
    cart.find(item => item.product.id === productId)?.quantity ?? 0;

  const addToCart = (product: Product) => {
    const stock = getProductStock(product);
    const quantityInCart = getCartQuantity(product.id);
    if (quantityInCart >= stock) {
      setCheckoutError(`Only ${stock} ${stock === 1 ? 'unit is' : 'units are'} available for ${product.name}.`);
      return;
    }

    setCheckoutError(null);
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1, price: product.retailPrice }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(cartItem => cartItem.product.id === productId);
    if (item && delta > 0 && item.quantity + delta > getProductStock(item.product)) {
      setCheckoutError(`Only ${getProductStock(item.product)} ${getProductStock(item.product) === 1 ? 'unit is' : 'units are'} available for ${item.product.name}.`);
      return;
    }

    setCheckoutError(null);
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as any;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCheckoutError(null);
  };

  // Calculations
  const taxRate = 0.085; // Default 8.5%
  const subtotal = cart.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = discountedSubtotal * taxRate;
  const total = discountedSubtotal + tax;

  // Checkout sale (works seamlessly online OR offline)
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setCheckoutError(null);

    const saleItems = cart.map(it => ({
      productId: it.product.id,
      sku: it.product.sku,
      barcode: it.product.barcode,
      name: it.product.name,
      price: it.price,
      costPrice: it.product.costPrice,
      quantity: it.quantity,
      lineTotal: parseFloat((it.price * it.quantity).toFixed(2))
    }));

    const isOnline = syncManager.getOnlineStatus();

    if (isOnline) {
      try {
        const result = await api.recordSale({
          storeId: activeStoreId,
          items: saleItems,
          paymentMethod: selectedPayment,
          discountAmount: discount
        });
        setCompletedSale(result);
        clearCart();
        loadCatalog();
      } catch (err: any) {
        console.warn('Cloud checkout failed, falling back to local encrypted offline queue:', err);
        await processOfflineSale(saleItems);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Process 100% offline
      await processOfflineSale(saleItems);
      setSubmitting(false);
    }
  };

  const processOfflineSale = async (saleItems: any[]) => {
    const offlineId = 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const orderSeq = 90000 + Math.floor(Math.random() * 9000);
    const saleRecord = {
      offlineId,
      receiptNumber: `REC-OFFLINE-${orderSeq}`,
      timestamp: new Date().toISOString(),
      storeId: activeStoreId,
      cashierId: user?.id || 'usr_cashier',
      cashierName: user?.name || 'Staff Cashier',
      items: saleItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      paymentMethod: selectedPayment
    };

    await offlineDb.recordOfflineSale(saleRecord);
    await syncManager.refreshPendingCount();

    setCompletedSale({
      id: offlineId,
      receiptNumber: saleRecord.receiptNumber,
      timestamp: saleRecord.timestamp,
      storeId: activeStoreId,
      cashierId: saleRecord.cashierId,
      cashierName: saleRecord.cashierName,
      items: saleItems,
      subtotal: saleRecord.subtotal,
      discount: saleRecord.discount,
      tax: saleRecord.tax,
      total: saleRecord.total,
      paymentMethod: selectedPayment,
      status: 'COMPLETED',
      syncStatus: 'OFFLINE_BUFFERED',
      offlineGenerated: true
    });

    clearCart();
    loadCatalog();
  };

  // Filter products by category and search
  const categories = ['All', 'Beverages', 'Bakery', 'Grocery', 'Merchandise', 'Confectionery'];
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchQuery =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchCat && matchQuery;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="POS Barcode Scanner"
      />

      {/* Left Area: Catalog & Category Quick Select */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden bg-slate-100/50 dark:bg-slate-900/30">
        {/* Top Search & Barcode Button */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <Barcode className="h-4 w-4" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Loading inventory catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-sm font-medium text-slate-500">No products match your search or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const stock = getProductStock(prod);
                const availableStock = Math.max(0, stock - getCartQuantity(prod.id));
                const isLow = availableStock <= prod.minAlertThreshold;
                const isOutOfStock = availableStock <= 0;

                return (
                  <button
                    key={prod.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(prod)}
                    className={`group relative flex flex-col justify-between text-left rounded-2xl border p-3.5 transition-all ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:shadow-md dark:hover:border-indigo-500/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                          {prod.sku}
                        </span>
                        {isLow && !isOutOfStock && (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Low Stock
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="rounded bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.2 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                            {stock > 0 ? 'In Cart' : 'Sold Out'}
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        ${prod.retailPrice.toFixed(2)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Available: <span className="font-semibold text-slate-700 dark:text-slate-300">{availableStock}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Cart & Checkout Register */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shrink-0 shadow-lg">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-base">Current Sale</span>
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {cart.reduce((sum, it) => sum + it.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 space-y-2">
              <Barcode className="h-8 w-8 stroke-1 text-slate-300 dark:text-slate-600" />
              <p className="text-xs">Scan a barcode or click items to begin checkout</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5"
              >
                <div className="flex-1 pr-2">
                  <h5 className="font-medium text-xs text-slate-900 dark:text-white truncate">
                    {item.product.name}
                  </h5>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    ${item.price.toFixed(2)} each
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= getProductStock(item.product)}
                      className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="font-semibold text-xs text-slate-900 dark:text-white min-w-[50px] text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Payment Methods */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Sales Tax (8.5%)</span>
              <span className="font-medium text-slate-900 dark:text-white">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
              <span>Total Amount</span>
              <span className="text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Tender Method
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'CREDIT_CARD', label: 'Card / Chip', icon: CreditCard },
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'APPLE_PAY', label: 'Contactless', icon: Smartphone }
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedPayment === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedPayment(m.id as any)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkout Button */}
          {checkoutError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Processing Transaction...' : `Charge $${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto">
              <CheckCircle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Transaction Complete</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{completedSale.receiptNumber}</p>
              {completedSale.offlineGenerated && (
                <span className="inline-block mt-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5">
                  Saved Offline - Will Cloud Sync on Reconnect
                </span>
              )}
            </div>

            {/* Simulated Receipt Preview */}
            <div id="printable-receipt" className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 text-left font-mono text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
                <div className="font-bold text-sm">RETAILPULSE STORE</div>
                <div className="text-[10px] text-slate-500">{new Date(completedSale.timestamp).toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">Cashier: {completedSale.cashierName}</div>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-slate-300 dark:border-slate-700">
                {completedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>{it.quantity}x {it.name}</span>
                    <span>${it.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${completedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (8.5%):</span>
                  <span>${completedSale.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1">
                  <span>TOTAL PAID:</span>
                  <span>${completedSale.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Method:</span>
                  <span>{completedSale.paymentMethod}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-dashed border-slate-300 dark:border-slate-700">
                Thank you for your business!
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 text-xs shadow-md"
              >
                Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
