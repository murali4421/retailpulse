import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../services/authContext';
import { MfaModal } from '../components/MfaModal';
import { COUNTRY_CONFIGS, usePosSettings } from '../services/posSettingsContext';
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  Database,
  DollarSign,
  Users,
  CheckCircle,
  HardDrive,
  Download,
  Plus,
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { settings, formatPrice, updateSettings } = usePosSettings();
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [isMfaOpen, setIsMfaOpen] = useState(false);

  const loadBackups = async () => {
    if (user?.role !== 'super_admin') return;
    try {
      setLoadingBackups(true);
      const data = await api.getBackups();
      setBackups(data);
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [user]);

  const handleTriggerBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.triggerBackup('MANUAL_ADMIN_SNAPSHOT');
      alert('AES-256 encrypted database snapshot created successfully!');
      loadBackups();
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  // RBAC Matrix
  const rbacRoles = [
    { name: 'Super Admin', role: 'super_admin', perms: ['All Permissions', 'Multi-Store HQ', 'Audit Trails', 'Backups', 'GDPR Erasure'] },
    { name: 'Store Manager', role: 'store_manager', perms: ['POS Access', 'Inventory CRUD', 'Replenishment PO', 'Sales Reports', 'Refunds'] },
    { name: 'Cashier Staff', role: 'cashier', perms: ['POS Checkout', 'Barcode Scanning', 'Inventory Read', 'Receipt Printing'] },
    { name: 'Compliance Auditor', role: 'compliance_auditor', perms: ['Audit Log Read', 'Export CSV/PDF', 'Threat Monitoring', 'GDPR DSAR'] }
  ];

  return (
    <div className="flex-1 min-h-full p-4 sm:p-6 lg:p-8 space-y-6 pb-10">
      <MfaModal isOpen={isMfaOpen} onClose={() => setIsMfaOpen(false)} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <SettingsIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <span>System Settings, Identity & Encryption</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Identity management (Okta/Auth0 OAuth2), TOTP Multi-Factor Authentication, and daily encrypted database backups
        </p>
      </div>

      {/* Currency Configuration */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Currency</h3>
            <p className="text-xs text-slate-500">Choose the currency symbol used for prices throughout RetailPulse.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="currency-select" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Display currency
          </label>
          <select
            id="currency-select"
            value={settings.currencyCode}
            disabled={user?.role !== 'super_admin'}
            onChange={event => {
              updateSettings({ currencyCode: event.target.value }).catch(error => {
                alert(`Failed to update currency: ${error.message}`);
              });
            }}
            className="w-full sm:w-auto min-w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
          >
            {COUNTRY_CONFIGS.map(currency => (
              <option key={currency.currencyCode} value={currency.currencyCode}>
                {currency.currencyCode} ({currency.currencySymbol}) — {currency.currencyName}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            Preview: {formatPrice(1234.56)}
            {user?.role !== 'super_admin' && ' · Only a super admin can change this setting'}
          </span>
        </div>
      </div>

      {/* Security & MFA Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Multi-Factor Authentication (MFA / TOTP)</h3>
              <p className="text-xs text-slate-500">Protect accounts against brute-force and unauthorized credential attacks</p>
            </div>
          </div>

          {user?.mfaEnabled ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="h-4 w-4" />
              <span>Enforced & Active</span>
            </span>
          ) : (
            <button
              onClick={() => setIsMfaOpen(true)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              Configure MFA
            </button>
          )}
        </div>
      </div>

      {/* Identity Providers (Okta / Auth0) OAuth 2.0 Integration */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">OAuth 2.0 & OpenID Connect (OIDC) Identity Gateway</h3>
            <p className="text-xs text-slate-500">Seamless integration with corporate Single Sign-On (SSO) providers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Okta Config */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
              <span>Okta Workforce Identity Cloud</span>
              <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 px-2 py-0.5 text-[10px]">OIDC 1.0</span>
            </div>
            <p className="text-slate-500 text-[11px]">Issuer: https://dev-retailpulse.okta.com/oauth2/default</p>
            <div className="font-mono text-[10px] text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
              Client ID: okta_client_retailpulse_saas
            </div>
          </div>

          {/* Auth0 Config */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
              <span>Auth0 Enterprise Universal Login</span>
              <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 px-2 py-0.5 text-[10px]">OAuth 2.0</span>
            </div>
            <p className="text-slate-500 text-[11px]">Issuer: https://retailpulse.auth0.com/</p>
            <div className="font-mono text-[10px] text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
              Client ID: auth0_client_retailpulse_saas
            </div>
          </div>
        </div>
      </div>

      {/* Automated Daily Database Backups */}
      {user?.role === 'super_admin' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Automated Database Backups (AES-256-GCM Encrypted)
                </h3>
                <p className="text-xs text-slate-500">Scheduled 24h cron cadence with immutable cryptographic SHA-256 checksums</p>
              </div>
            </div>

            <button
              onClick={handleTriggerBackup}
              disabled={creatingBackup}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-purple-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>{creatingBackup ? 'Creating...' : 'Trigger Manual Backup'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {backups.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">No backup archives found. Click "Trigger Manual Backup" to generate one.</div>
            ) : (
              backups.map((bkp) => (
                <div key={bkp.backupId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{bkp.filename}</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Checksum (SHA-256): {bkp.checksum?.substring(0, 24)}...
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-[11px] text-slate-500">
                      <div>{(bkp.sizeBytes / 1024).toFixed(1)} KB</div>
                      <div className="text-[10px] text-slate-400">{new Date(bkp.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span className="rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 px-2 py-0.5 text-[10px] font-bold">
                      AES-256
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Role-Based Access Control (RBAC) Permissions Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Role-Based Access Control (RBAC) Matrix</h3>
            <p className="text-xs text-slate-500">Granular permissions configured per security role</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {rbacRoles.map((r) => (
            <div key={r.role} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
              <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {r.perms.map((p, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
