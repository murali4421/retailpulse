import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import {
  Store,
  Shield,
  Key,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Zap,
  CheckCircle,
  HelpCircle,
  X,
  UserCheck
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login, loginWithSso } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('123456');
  const [mfaPromptOpen, setMfaPromptOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct credentials submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password, totpToken);
      if (res.mfaRequired) {
        setPendingEmail(email);
        setPendingPassword(password);
        setMfaPromptOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Login for Personas (passes demo totp code 123456 directly for instant authentication)
  const handleQuickLogin = async (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError(null);
    setLoading(true);

    try {
      // Pass demo TOTP code '123456' directly so 1-click test login is instant for all roles
      const res = await login(roleEmail, rolePass, '123456');
      if (res.mfaRequired) {
        setPendingEmail(roleEmail);
        setPendingPassword(rolePass);
        setTotpToken('123456');
        setMfaPromptOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate persona');
    } finally {
      setLoading(false);
    }
  };

  // MFA verification submission
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokenToVerify = totpToken.trim() || '123456';
      await login(pendingEmail || email, pendingPassword || password, tokenToVerify);
      setMfaPromptOpen(false);
    } catch (err: any) {
      setError(err.message || 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async (provider: 'okta' | 'auth0') => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSso(provider);
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 text-slate-100 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30 mb-2">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Retail<span className="text-indigo-400">Pulse</span> SaaS
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Small Shop Management, Real-Time Inventory & Barcode Tracking
          </p>
        </div>

        {/* Main Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick 1-Click Role Login Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-400" />
                <span>1-Click Test Personas</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-normal">Click to sign in</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Super Admin */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('admin@retailpulse.io', 'Admin123!')}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:border-purple-500/60 hover:bg-purple-950/20 text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Super Admin</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                </div>
                <div className="text-[10px] text-purple-400 font-mono mt-0.5">admin@retailpulse.io</div>
              </button>

              {/* Store Manager */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('manager@retailpulse.io', 'Manager123!')}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:border-blue-500/60 hover:bg-blue-950/20 text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Store Manager</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                </div>
                <div className="text-[10px] text-blue-400 font-mono mt-0.5">manager@retailpulse.io</div>
              </button>

              {/* Cashier Staff */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('cashier@retailpulse.io', 'Cashier123!')}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:border-emerald-500/60 hover:bg-emerald-950/20 text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Cashier Staff</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">cashier@retailpulse.io</div>
              </button>

              {/* Compliance Auditor */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('auditor@retailpulse.io', 'Auditor123!')}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:border-amber-500/60 hover:bg-amber-950/20 text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Compliance Auditor</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                </div>
                <div className="text-[10px] text-amber-400 font-mono mt-0.5">auditor@retailpulse.io</div>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-500 shrink-0 font-medium">
              or standard credentials
            </span>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/60 pl-10 pr-3.5 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/60 pl-10 pr-3.5 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 text-sm shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Enterprise OAuth2 / Single Sign-On (Okta / Auth0) */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-500 block text-center">
              Enterprise Single Sign-On (OAuth 2.0 / OIDC)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleSso('okta')}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 p-2 font-medium text-slate-300 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span>Okta SSO</span>
              </button>

              <button
                type="button"
                onClick={() => handleSso('auth0')}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 p-2 font-medium text-slate-300 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span>Auth0 Login</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-indigo-400" />
            <span>End-to-end encrypted session with TLS 1.3 & AES-256-GCM</span>
          </p>
          <p>GDPR & CCPA Compliant • SOC 2 Ready</p>
        </div>
      </div>

      {/* MFA TOTP Verification Modal */}
      {mfaPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 mx-auto">
              <Key className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Two-Factor Authentication</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter the 6-digit TOTP verification code for <strong className="text-white">{pendingEmail || email}</strong>
              </p>
            </div>

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <input
                type="text"
                autoFocus
                maxLength={6}
                placeholder="123456"
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-2 text-[11px] text-slate-400">
                <span>Demo evaluation code:</span>
                <button
                  type="button"
                  onClick={() => setTotpToken('123456')}
                  className="font-mono font-bold text-indigo-400 hover:underline"
                >
                  Use 123456
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMfaPromptOpen(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 text-xs shadow-md disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
