import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { X, FileDown, Printer, Calendar, DollarSign, TrendingUp, Layers } from 'lucide-react';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: any;
  storeName: string;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  summaryData,
  storeName
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen || !summaryData) return null;

  const { summary, topSellingProducts, paymentBreakdown } = summaryData;

  const exportPdf = () => {
    const doc = new jsPDF();

    // Brand Header
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RetailPulse SaaS - Daily Sales & Financial Report', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Store: ${storeName} | Date: ${selectedDate} | Generated: ${new Date().toLocaleTimeString()}`, 14, 26);

    // Summary Financial KPI Boxes
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Financial Summary', 14, 44);

    const kpiData = [
      ['Total Gross Revenue', `$${summary.totalRevenue.toFixed(2)}`],
      ["Today's Revenue", `$${summary.todayRevenue.toFixed(2)}`],
      ['Total Completed Orders', `${summary.totalOrders}`],
      ['Average Order Value (AOV)', `$${summary.averageOrderValue.toFixed(2)}`],
      ['Estimated Gross Profit', `$${summary.grossProfit.toFixed(2)} (${summary.grossMarginPercentage}%)`],
      ['Sales Tax Collected', `$${summary.totalTaxCollected.toFixed(2)}`]
    ];

    autoTable(doc, {
      startY: 48,
      head: [['Financial Metric', 'Value']],
      body: kpiData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 10 }
    });

    // Top Selling Items Table
    const lastY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.text('Top Selling Products & Velocity', 14, lastY);

    const topItemsData = topSellingProducts.map((it: any) => [
      it.sku,
      it.name,
      it.quantity.toString(),
      `$${it.revenue.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: lastY + 4,
      head: [['SKU', 'Product Name', 'Units Sold', 'Total Revenue']],
      body: topItemsData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 }
    });

    // Payment Methods Breakdown
    const paymentY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.text('Tender & Payment Breakdown', 14, paymentY);

    const paymentRows = paymentBreakdown.map((p: any) => [
      p.method.replace('_', ' '),
      `$${p.amount.toFixed(2)}`,
      `${p.percentage}%`
    ]);

    autoTable(doc, {
      startY: paymentY + 4,
      head: [['Payment Tender', 'Amount Collected', 'Share']],
      body: paymentRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 9 }
    });

    // Sign-off section
    const signY = (doc as any).lastAutoTable.finalY + 24;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Store Manager Signature: _______________________      Date: ______________', 14, signY);
    doc.text('RetailPulse SaaS Cloud Accounting Engine - Compliant with GAAP & Tax Records', 14, signY + 10);

    doc.save(`RetailPulse_Daily_Report_${storeName.replace(/\s+/g, '_')}_${selectedDate}.pdf`);
  };

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Store', storeName],
      ['Date', selectedDate],
      ['Total Gross Revenue', summary.totalRevenue],
      ["Today's Revenue", summary.todayRevenue],
      ['Total Completed Orders', summary.totalOrders],
      ['Average Order Value', summary.averageOrderValue],
      ['Gross Profit', summary.grossProfit],
      ['Gross Margin %', summary.grossMarginPercentage],
      ['Tax Collected', summary.totalTaxCollected],
      [],
      ['Top Product SKU', 'Product Name', 'Units Sold', 'Revenue'],
      ...topSellingProducts.map((p: any) => [p.sku, `"${p.name}"`, p.quantity, p.revenue]),
      [],
      ['Payment Method', 'Amount', 'Percentage'],
      ...paymentBreakdown.map((b: any) => [b.method, b.amount, `${b.percentage}%`])
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RetailPulse_Daily_Summary_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Daily Sales & Financial Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official store performance summary for {storeName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Date Picker Bar */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span>Reporting Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <FileDown className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={exportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Download PDF Report</span>
              </button>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Gross Sales (Today)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                ${summary.todayRevenue.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                {summary.todayOrders} completed transactions
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Gross Margin</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {summary.grossMarginPercentage}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                ${summary.grossProfit.toFixed(2)} net profit
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Avg. Order Value</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                ${summary.averageOrderValue.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                ${summary.totalTaxCollected.toFixed(2)} sales tax
              </div>
            </div>
          </div>

          {/* Top Selling Products List */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span>Top Performing Products</span>
            </h4>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-center">SKU</th>
                    <th className="py-2.5 px-3 text-right">Units</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {topSellingProducts.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-200">{p.name}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">{p.sku}</td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">{p.quantity}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        ${p.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-3.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
