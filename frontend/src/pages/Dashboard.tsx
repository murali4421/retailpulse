import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../services/authContext';
import { usePosSettings } from '../services/posSettingsContext';
import { DailyReportModal } from '../components/DailyReportModal';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Percent,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Store
} from 'lucide-react';

interface DashboardProps {
  onNavigateToTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToTab }) => {
  const { activeStoreId, hasPermission } = useAuth();
  const { formatPrice } = usePosSettings();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('Store');

  // Check permission
  if (!hasPermission('reports:view')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h3 className="font-bold text-slate-800 dark:text-white text-base">Sales Trends Restricted</h3>
        <p className="text-xs text-slate-500 mt-1">Your account is assigned a role without executive reports access.</p>
        <button
          onClick={() => onNavigateToTab && onNavigateToTab('pos')}
          className="mt-4 rounded-xl bg-indigo-600 text-white px-4 py-2 text-xs font-bold shadow-md"
        >
          Open POS Terminal
        </button>
      </div>
    );
  }

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const summaryRes = await api.getSalesAnalyticsSummary(activeStoreId);
      setData(summaryRes);

      const stores = await api.getStores();
      const current = stores.find(s => s.id === activeStoreId);
      setStoreName(current ? current.name : 'All Stores (Aggregate)');
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Listen for live sales or inventory events
    const unsub = api.subscribeToLiveEvents((event) => {
      if (event.type === 'SALE_COMPLETED' || event.type === 'STOCK_CHANGED') {
        loadDashboard();
      }
    });

    return () => unsub();
  }, [activeStoreId]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
        <RefreshCw className="h-5 w-5 animate-spin mr-2 text-indigo-500" />
        Loading real-time sales & inventory metrics...
      </div>
    );
  }

  const { summary, topSellingProducts, hourlyTrends, dailyTrends, paymentBreakdown } = data || {
    summary: { totalRevenue: 0, todayRevenue: 0, totalOrders: 0, averageOrderValue: 0, grossProfit: 0, grossMarginPercentage: 0, lowStockCount: 0 },
    topSellingProducts: [],
    hourlyTrends: [],
    dailyTrends: [],
    paymentBreakdown: []
  };

  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Daily Report Export Modal */}
      <DailyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        summaryData={data}
        storeName={storeName}
      />

      {/* Top Header & Report Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <Store className="h-3.5 w-3.5" />
            <span>{storeName} Overview</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Sales Performance & Trends
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-bold shadow-md hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Generate Daily Sales Report</span>
          </button>
        </div>
      </div>

      {/* Low-stock Automated Alert Banner */}
      {summary.lowStockCount > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Automated Low-Stock Replenishment Warning
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-400">
                {summary.lowStockCount} product(s) have fallen below minimum threshold. Replenishment orders recommended.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('inventory')}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 shrink-0 transition-colors shadow-sm"
          >
            View Low-Stock Items
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Today's Sales</span>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-1.5 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatPrice(summary.todayRevenue)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>{summary.todayOrders} orders processed today</span>
          </div>
        </div>

        {/* Gross Profit Margin */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Gross Profit Margin</span>
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 p-1.5 text-indigo-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.grossMarginPercentage}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Est. gross profit: {formatPrice(summary.grossProfit)}
          </div>
        </div>

        {/* Average Order Value */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Average Order Value</span>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-1.5 text-blue-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatPrice(summary.averageOrderValue)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {summary.totalOrders} total sales
          </div>
        </div>

        {/* Total Gross Revenue */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Gross Revenue</span>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/60 p-1.5 text-purple-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatPrice(summary.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Tax collected: {formatPrice(summary.totalTaxCollected)}
          </div>
        </div>
      </div>

      {/* Main Charts: 7-Day Revenue Trend & Hourly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Trend Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">7-Day Sales Revenue Trend</h3>
              <p className="text-xs text-slate-400">Daily gross performance and order volume</p>
            </div>
            <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Past 7 Days
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrends}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => formatPrice(Number(val))} />
                <Tooltip
                  formatter={(val: any) => [formatPrice(Number(val)), 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown Donut */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Payment Distribution</h3>
            <p className="text-xs text-slate-400">Tenders processed by share</p>
          </div>
          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="amount"
                >
                  {paymentBreakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatPrice(Number(val)), 'Amount']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {paymentBreakdown.map((item: any, i: number) => (
              <div key={item.method} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                  <span className="text-slate-600 dark:text-slate-400">{item.method.replace('_', ' ')}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(item.amount)} ({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Sales Velocity & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Velocity */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">Today's Hourly Sales Velocity</h3>
          <p className="text-xs text-slate-400 mb-4">Customer transaction peaks throughout business hours</p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => formatPrice(Number(v))} />
                <Tooltip
                  formatter={(val: any) => [formatPrice(Number(val)), 'Sales']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products Leaderboard */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Top Selling Products</h3>
              <p className="text-xs text-slate-400">Highest grossing inventory by revenue</p>
            </div>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>

          <div className="space-y-3">
            {topSellingProducts.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    #{idx + 1}
                  </span>
                  <div>
                    <h5 className="font-semibold text-xs text-slate-900 dark:text-white">{p.name}</h5>
                    <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{formatPrice(p.revenue)}</div>
                  <div className="text-[10px] text-slate-500">{p.quantity} units sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
