import React, { useState, useEffect } from 'react';
import { api, type Product, type Store } from '../services/api';
import { useAuth } from '../services/authContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import {
  Boxes,
  Barcode,
  Search,
  Plus,
  ArrowUpDown,
  Download,
  AlertTriangle,
  RefreshCw,
  Truck,
  CheckCircle,
  X,
  FileCheck,
  Edit2
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { activeStoreId, hasPermission } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Partial<Product> | null>(null);

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustData, setAdjustData] = useState<{ product: Product | null; delta: number; reason: string }>({
    product: null,
    delta: 10,
    reason: 'Vendor delivery restock'
  });

  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [replenishData, setReplenishData] = useState<any>(null);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    productId: '',
    fromStoreId: 'LOC-003',
    toStoreId: activeStoreId || 'LOC-001',
    quantity: 10
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [inv, storeList] = await Promise.all([
        api.getInventory(activeStoreId, lowStockFilter, search, categoryFilter),
        api.getStores()
      ]);
      setProducts(inv);
      setStores(storeList);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsub = api.subscribeToLiveEvents((event) => {
      if (event.type === 'STOCK_CHANGED' || event.type === 'INVENTORY_UPDATED' || event.type === 'STOCK_TRANSFERRED') {
        loadData();
      }
    });

    return () => unsub();
  }, [activeStoreId, lowStockFilter, categoryFilter]);

  const handleBarcodeScanned = (scannedCode: string) => {
    setSearch(scannedCode);
  };

  const handleOpenAdd = () => {
    setSelectedProduct({
      name: '',
      sku: 'SKU-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      barcode: '89012' + Math.floor(1000000 + Math.random() * 9000000),
      category: 'Beverages',
      description: '',
      costPrice: 5.0,
      retailPrice: 9.99,
      minAlertThreshold: 10
    });
    setIsAddEditOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await api.saveProduct(selectedProduct);
      setIsAddEditOpen(false);
      loadData();
    } catch (err: any) {
      alert('Error saving product: ' + err.message);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.product) return;
    try {
      await api.adjustStock(adjustData.product.id, activeStoreId, adjustData.delta, adjustData.reason);
      setIsAdjustOpen(false);
      loadData();
    } catch (err: any) {
      alert('Stock adjustment error: ' + err.message);
    }
  };

  const handleOpenReplenishment = async () => {
    try {
      const recs = await api.getReplenishment(activeStoreId);
      setReplenishData(recs);
      setIsReplenishOpen(true);
    } catch (err: any) {
      alert('Failed to load replenishment recommendations: ' + err.message);
    }
  };

  const handleCreateReplenishmentPO = async () => {
    if (!replenishData || !replenishData.items?.length) return;
    try {
      await api.createReorderOrder({
        storeId: activeStoreId,
        supplier: 'Consolidated Distributors',
        items: replenishData.items.map((i: any) => ({
          productId: i.productId,
          sku: i.sku,
          name: i.name,
          quantity: i.suggestedReorderQty,
          unitCost: i.costPrice
        }))
      });
      alert('Automated Replenishment Purchase Order submitted successfully!');
      setIsReplenishOpen(false);
      loadData();
    } catch (err: any) {
      alert('PO submission error: ' + err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.transferStock(
        transferData.productId,
        transferData.fromStoreId,
        transferData.toStoreId,
        transferData.quantity
      );
      alert('Stock transfer completed successfully!');
      setIsTransferOpen(false);
      loadData();
    } catch (err: any) {
      alert('Transfer error: ' + err.message);
    }
  };

  const exportInventoryCsv = () => {
    const headers = ['SKU', 'Barcode', 'Product Name', 'Category', 'Store Stock', 'Cost Price', 'Retail Price', 'Min Alert Threshold', 'Status'];
    const rows = products.map(p => {
      const stock = p.currentStock ?? 0;
      const status = stock <= 0 ? 'OUT_OF_STOCK' : stock <= p.minAlertThreshold ? 'LOW_STOCK' : 'HEALTHY';
      return [
        `"${p.sku}"`,
        `"${p.barcode}"`,
        `"${p.name}"`,
        `"${p.category}"`,
        stock,
        p.costPrice,
        p.retailPrice,
        p.minAlertThreshold,
        status
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RetailPulse_Inventory_${activeStoreId}_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Inventory Barcode Lookup"
      />

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Boxes className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>Real-Time Inventory & Barcode Tracking</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track multi-store stock, monitor low-threshold alerts, and streamline replenishment
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenReplenishment}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-3.5 py-2 text-xs font-bold hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Replenishment Manager</span>
          </button>

          <button
            onClick={() => {
              if (products.length > 0) {
                setTransferData(prev => ({ ...prev, productId: products[0].id }));
              }
              setIsTransferOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750"
          >
            <Truck className="h-4 w-4 text-indigo-500" />
            <span>Inter-Store Transfer</span>
          </button>

          <button
            onClick={exportInventoryCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {hasPermission('inventory:write') && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, Barcode, or Product Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            title="Scan with Camera / Barcode Reader"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          >
            <Barcode className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Beverages">Beverages</option>
            <option value="Bakery">Bakery</option>
            <option value="Grocery">Grocery</option>
            <option value="Merchandise">Merchandise</option>
            <option value="Confectionery">Confectionery</option>
          </select>

          {/* Low Stock Toggle Pill */}
          <button
            onClick={() => setLowStockFilter(prev => !prev)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              lowStockFilter
                ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Low Stock Alerts Only</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4 text-center">Min Threshold</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading inventory records...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  const stock = item.currentStock ?? 0;
                  const isLow = stock <= item.minAlertThreshold;
                  const isOut = stock <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.sku}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Barcode className="h-3 w-3 inline text-slate-400" />
                          <span>{item.barcode}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                          {stock}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {item.minAlertThreshold}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-500 font-mono">
                        ${item.costPrice.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                        ${item.retailPrice.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                            Low Stock Alert
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            In Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => {
                            setAdjustData({ product: item, delta: 10, reason: 'Stock delivery arrival' });
                            setIsAdjustOpen(true);
                          }}
                          title="Restock or Adjust Units"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedProduct(item);
                            setIsAddEditOpen(true);
                          }}
                          title="Edit Details"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustOpen && adjustData.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Restock / Adjust Inventory Units
              </h3>
              <button onClick={() => setIsAdjustOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500">Product:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">{adjustData.product.name}</span>
                <div className="font-mono text-slate-400 text-[10px]">
                  Current store stock: {adjustData.product.currentStock} units
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Quantity Adjustment (positive to add stock, negative to reduce):
                </label>
                <input
                  type="number"
                  value={adjustData.delta}
                  onChange={(e) => setAdjustData(prev => ({ ...prev, delta: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Reason for Adjustment:
                </label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 shadow-md"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddEditOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {selectedProduct.id ? 'Edit Product' : 'Add New Inventory Item'}
              </h3>
              <button onClick={() => setIsAddEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={selectedProduct.sku}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, sku: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Barcode (UPC/EAN)</label>
                  <input
                    type="text"
                    required
                    value={selectedProduct.barcode}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, barcode: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={selectedProduct.name}
                  onChange={(e) => setSelectedProduct(p => ({ ...p!, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={selectedProduct.category}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, category: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="Beverages">Beverages</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Grocery">Grocery</option>
                    <option value="Merchandise">Merchandise</option>
                    <option value="Confectionery">Confectionery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Supplier</label>
                  <input
                    type="text"
                    value={selectedProduct.supplier || ''}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, supplier: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedProduct.costPrice}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, costPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedProduct.retailPrice}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, retailPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Min Alert Qty</label>
                  <input
                    type="number"
                    value={selectedProduct.minAlertThreshold}
                    onChange={(e) => setSelectedProduct(p => ({ ...p!, minAlertThreshold: parseInt(e.target.value) || 10 }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-md"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replenishment Manager Modal */}
      {isReplenishOpen && replenishData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Automated Replenishment Generator
                  </h3>
                  <p className="text-xs text-slate-500">
                    {replenishData.itemsToReorderCount} items below threshold. Est. Total: ${replenishData.totalEstimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsReplenishOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {replenishData.items.map((it: any) => (
                <div key={it.productId} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">{it.name}</h5>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Current Stock: <span className="text-rose-500 font-bold">{it.currentStock}</span> (Threshold: {it.minAlertThreshold})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                      Reorder: +{it.suggestedReorderQty} units
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Est. Cost: ${it.estimatedCost.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => setIsReplenishOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReplenishmentPO}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 text-xs shadow-md"
              >
                Submit Purchase Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inter-Store Transfer Modal */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Inter-Store Stock Transfer
                </h3>
              </div>
              <button onClick={() => setIsTransferOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Select Product:</label>
                <select
                  value={transferData.productId}
                  onChange={(e) => setTransferData(p => ({ ...p, productId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">From Location:</label>
                  <select
                    value={transferData.fromStoreId}
                    onChange={(e) => setTransferData(p => ({ ...p, fromStoreId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">To Location:</label>
                  <select
                    value={transferData.toStoreId}
                    onChange={(e) => setTransferData(p => ({ ...p, toStoreId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Transfer Quantity Units:</label>
                <input
                  type="number"
                  min="1"
                  value={transferData.quantity}
                  onChange={(e) => setTransferData(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 shadow-md"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
