import React, { useState, useEffect } from 'react';
import { api, type SaleTransaction, type Store } from '../services/api';
import { useAuth } from '../services/authContext';
import { usePosSettings } from '../services/posSettingsContext';
import { DailyReportModal } from '../components/DailyReportModal';
import {
  Receipt,
  Search,
  Download,
  RotateCcw,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  X
} from 'lucide-react';

export const SalesHistory: React.FC = () => {
  const { activeStoreId, hasPermission } = useAuth();
  const { formatPrice } = usePosSettings();
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected sale details modal
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null);

  // Refund modal state
  const [refundModalSale, setRefundModalSale] = useState<SaleTransaction | null>(null);
  const [refundReason, setRefundReason] = useState('Customer return item in original condition');

  // Daily Report Modal
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const loadSales = async () => {
    try {
      setLoading(true);
      const [list, storeList, analytics] = await Promise.all([
        api.getSales(activeStoreId, 100),
        api.getStores(),
        api.getSalesAnalyticsSummary(activeStoreId)
      ]);
      setSales(list);
      setStores(storeList);
      setReportData(analytics);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();

    const unsub = api.subscribeToLiveEvents((event) => {
      if (event.type === 'SALE_COMPLETED' || event.type === 'SALE_REFUNDED' || event.type === 'BATCH_SALES_SYNCED') {
        loadSales();
      }
    });

    return () => unsub();
  }, [activeStoreId]);

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalSale) return;

    try {
      await api.refundSale(refundModalSale.id, refundReason);
      setRefundModalSale(null);
      loadSales();
    } catch (err: any) {
      alert('Refund failed: ' + err.message);
    }
  };

  const exportSalesCsv = () => {
    const headers = ['Order ID', 'Receipt #', 'Timestamp', 'Store', 'Cashier', 'Items Count', 'Subtotal', 'Tax', 'Total Amount', 'Payment Method', 'Status', 'Refund Reason'];
    const rows = sales.map(s => [
      `"${s.id}"`,
      `"${s.receiptNumber}"`,
      `"${s.timestamp}"`,
      `"${s.storeId}"`,
      `"${s.cashierName}"`,
      s.items.length,
      s.subtotal,
      s.tax,
      s.total,
      `"${s.paymentMethod}"`,
      `"${s.status}"`,
      `"${s.refundReason || ''}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RetailPulse_Sales_Export_${Date.now()}.csv`;
    link.click();
  };

  const filteredSales = sales.filter(s => {
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchQuery =
      search === '' ||
      s.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.cashierName.toLowerCase().includes(search.toLowerCase()) ||
      s.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchQuery;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Daily Report Export Modal */}
      {reportData && (
        <DailyReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          summaryData={reportData}
          storeName={stores.find(s => s.id === activeStoreId)?.name || 'Downtown Store'}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>Sales History & Financial Reporting</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete transaction ledger, refunds management, and daily financial statements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
            <span>Daily Financial Summary</span>
          </button>

          <button
            onClick={exportSalesCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20"
          >
            <Download className="h-4 w-4" />
            <span>Export Transactions (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipt #, order ID, cashier, or items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'COMPLETED', 'REFUNDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Receipt Number</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Tender</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Loading sales records...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      <div>{sale.receiptNumber}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{sale.id}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      <div>{new Date(sale.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">{new Date(sale.timestamp).toLocaleTimeString()}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {sale.cashierName}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {sale.items.reduce((sum, it) => sum + it.quantity, 0)} units
                      </span>
                      <span className="text-slate-400 text-[11px] block truncate max-w-[140px]">
                        {sale.items.map(i => i.name).join(', ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatPrice(sale.subtotal)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatPrice(sale.tax)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatPrice(sale.total)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {sale.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {sale.status === 'COMPLETED' ? (
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Paid</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          <span>Refunded</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        title="View Receipt Breakdown"
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {sale.status === 'COMPLETED' && hasPermission('sales:refund') && (
                        <button
                          onClick={() => setRefundModalSale(sale)}
                          title="Issue Refund & Restock Items"
                          className="rounded-lg border border-rose-200 dark:border-rose-900/60 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Receipt Breakdown</h3>
                <span className="font-mono text-xs text-slate-400">{selectedSale.receiptNumber}</span>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Store:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSale.storeId}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Cashier:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSale.cashierName}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tender:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSale.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Timestamp:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(selectedSale.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Purchased Items</div>
                {selectedSale.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white">{it.quantity}x {it.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 block">{it.sku}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{formatPrice(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatPrice(selectedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatPrice(selectedSale.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Total:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatPrice(selectedSale.total)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <RotateCcw className="h-5 w-5" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Process Refund & Restock</h3>
              </div>
              <button onClick={() => setRefundModalSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRefund} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Refunding <strong className="text-slate-900 dark:text-white font-mono">{refundModalSale.receiptNumber}</strong> will return <strong>{formatPrice(refundModalSale.total)}</strong> to the customer and restock all line items back into the active store inventory.
              </p>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reason for Refund:</label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalSale(null)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 shadow-md"
                >
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
