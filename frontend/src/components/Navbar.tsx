import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { useTheme } from '../services/themeContext';
import { syncManager } from '../services/syncManager';
import { api, type Store, type SecurityAlert } from '../services/api';
import {
  Store as StoreIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Sun,
  Moon,
  LogOut,
  Shield,
  ShieldAlert,
  CheckCircle2,
  Menu
} from 'lucide-react';

interface NavbarProps {
  onOpenAlerts?: () => void;
  onOpenMfaSetup?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAlerts, onOpenMfaSetup, onOpenMobileMenu }) => {
  const { user, logout, activeStoreId, setActiveStoreId } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [stores, setStores] = useState<Store[]>([]);
  const [syncState, setSyncState] = useState({
    isOnline: true,
    pendingSyncCount: 0,
    syncInProgress: false,
    message: ''
  });
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState(false);

  useEffect(() => {
    // Load stores
    api.getStores().then(setStores).catch(console.error);

    // Subscribe to sync manager
    const unsubSync = syncManager.subscribe((state) => {
      setSyncState({
        isOnline: state.isOnline,
        pendingSyncCount: state.pendingSyncCount,
        syncInProgress: state.syncInProgress,
        message: state.message || ''
      });
      if (state.message && state.message.includes('reconciled')) {
        setShowSyncSuccessToast(true);
        setTimeout(() => setShowSyncSuccessToast(false), 4000);
      }
    });

    // Load active security alerts if user has audit:read permission
    const canReadAudit = user?.role === 'super_admin' || user?.permissions?.includes('audit:read') || user?.permissions?.includes('*');
    const loadAlerts = () => {
      if (!canReadAudit) return;
      api.getSecurityAlerts()
        .then(alerts => {
          const active = alerts.filter(a => a.status === 'ACTIVE').length;
          setActiveAlertsCount(active);
        })
        .catch(() => {});
    };

    if (canReadAudit) {
      loadAlerts();
    }

    // Subscribe to live websocket alerts
    const unsubWs = api.subscribeToLiveEvents((event) => {
      if (canReadAudit && (event.type === 'SECURITY_ALERT_TRIGGERED' || event.type === 'LOW_STOCK_ALERT')) {
        loadAlerts();
      }
    });

    return () => {
      unsubSync();
      unsubWs();
    };
  }, [user]);

  const handleManualSync = async () => {
    await syncManager.triggerAutoSync();
  };

  const roleLabelMap: Record<string, { label: string; color: string }> = {
    super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    store_manager: { label: 'Store Manager', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    cashier: { label: 'Cashier Staff', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    compliance_auditor: { label: 'Compliance Auditor', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
  };

  const userRoleInfo = user ? roleLabelMap[user.role] || { label: user.role, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' } : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur transition-colors dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        {/* Brand & Multi-Store Selector */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4">
          <button
            onClick={onOpenMobileMenu}
            className="shrink-0 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 sm:h-10 sm:w-10">
              <StoreIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Retail<span className="text-indigo-600 dark:text-indigo-400">Pulse</span>
              </span>
              <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400">
                SaaS
              </span>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800 md:flex">
            <label htmlFor="store-select" className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Active Store:
            </label>
            <select
              id="store-select"
              value={activeStoreId}
              onChange={(e) => setActiveStoreId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            >
              {user?.role === 'super_admin' || user?.role === 'compliance_auditor' ? (
                <option value="ALL">All Store Locations (HQ Aggregate)</option>
              ) : null}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Actions: Sync State, Alerts, Dark Mode, Profile */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <div className="hidden items-center sm:flex">
            {syncState.isOnline ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden lg:inline">Cloud Synced</span>
                {syncState.pendingSyncCount > 0 && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncState.syncInProgress}
                    className="ml-1 flex items-center gap-1 text-[10px] underline hover:text-emerald-300"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncState.syncInProgress ? 'animate-spin' : ''}`} />
                    Sync ({syncState.pendingSyncCount})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                <span>Offline</span>
                {syncState.pendingSyncCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-900">
                    {syncState.pendingSyncCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {(user?.role === 'super_admin' || user?.permissions?.includes('audit:read') || user?.permissions?.includes('*')) && (
            <button
              onClick={onOpenAlerts}
              title="Real-time Security & Threat Monitoring"
              className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {activeAlertsCount > 0 ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {activeAlertsCount}
                  </span>
                </>
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </button>
          )}

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-700" />}
          </button>

          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="hidden text-right lg:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{user.name}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium ${userRoleInfo?.color}`}>
                    {userRoleInfo?.label}
                  </span>
                  {user.mfaEnabled ? (
                    <span title="Multi-Factor Authentication Active" className="text-emerald-500">
                      <Shield className="h-3 w-3 inline" />
                    </span>
                  ) : (
                    <button
                      onClick={onOpenMfaSetup}
                      title="Setup MFA for enhanced protection"
                      className="text-[10px] text-amber-500 hover:underline"
                    >
                      +Enable MFA
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={logout}
                title="Log out of session"
                aria-label="Log out"
                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-slate-400 dark:hover:bg-rose-950/30"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Success Toast notification */}
      {showSyncSuccessToast && (
        <div className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4" />
          <span>Offline sales synchronized with cloud. All records and stock levels reconciled.</span>
        </div>
      )}
    </header>
  );
};
