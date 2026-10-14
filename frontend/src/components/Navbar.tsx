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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur transition-colors">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand & Multi-Store Selector */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Hamburger menu button — visible only on mobile */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Retail<span className="text-indigo-600 dark:text-indigo-400">Pulse</span>
              </span>
              <span className="ml-1.5 rounded bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                SaaS
              </span>
            </div>
          </div>

          {/* Active Store Switcher */}
          <div className="hidden md:flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
            <label htmlFor="store-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Store:
            </label>
            <select
              id="store-select"
              value={activeStoreId}
              onChange={(e) => setActiveStoreId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Sync Status Indicator */}
          <div className="flex items-center">
            {syncState.isOnline ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Cloud Synced</span>
                {syncState.pendingSyncCount > 0 && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncState.syncInProgress}
                    className="ml-1 flex items-center gap-1 text-[11px] underline hover:text-emerald-300"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncState.syncInProgress ? 'animate-spin' : ''}`} />
                    Sync ({syncState.pendingSyncCount})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                <span>Offline Mode</span>
                {syncState.pendingSyncCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-900">
                    {syncState.pendingSyncCount} queued
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Security Threat Alerts Pill / Bell (Auditor & Admin only) */}
          {(user?.role === 'super_admin' || user?.permissions?.includes('audit:read') || user?.permissions?.includes('*')) && (
            <button
              onClick={onOpenAlerts}
              title="Real-time Security & Threat Monitoring"
              className="relative rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {activeAlertsCount > 0 ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {activeAlertsCount}
                  </span>
                </>
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-700" />}
          </button>

          {/* User Profile & Role Info */}
          {user && (
            <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-800 pl-3">
              <div className="hidden lg:block text-right">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{user.name}</div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
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
                className="rounded-lg p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="h-5 w-5" />
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
