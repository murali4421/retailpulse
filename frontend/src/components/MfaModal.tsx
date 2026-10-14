import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../services/authContext';
import { X, ShieldCheck, Copy, Check, KeyRound, AlertCircle } from 'lucide-react';

interface MfaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MfaModal: React.FC<MfaModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mfaData, setMfaData] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      setSuccess(false);
      api.setupMfa()
        .then(data => {
          setMfaData({
            secret: data.secret,
            qrCode: data.qrCode,
            backupCodes: data.backupCodes
          });
        })
        .catch(err => {
          setError(err.message || 'Failed to initialize MFA setup');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setError(null);
    try {
      await api.confirmMfa(tokenInput);
      setSuccess(true);
      if (user) {
        user.mfaEnabled = true;
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the 6-digit code.');
    }
  };

  const copySecret = () => {
    if (mfaData?.secret) {
      navigator.clipboard.writeText(mfaData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Multi-Factor Authentication (MFA)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enhance account security with TOTP Authenticator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                <Check className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                MFA Activated Successfully
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Your account is now protected against unauthorized logins. Next time you sign in, you will be prompted for your 6-digit TOTP code.
              </p>
              <button
                onClick={onClose}
                className="mt-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-10 text-xs text-slate-500">Generating secure cryptographic key...</div>
          ) : mfaData ? (
            <>
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 dark:text-slate-300">
                1. Scan this QR code with Google Authenticator, Authy, or 1Password:
              </p>

              <div className="flex justify-center p-3 rounded-xl bg-white border border-slate-200 w-fit mx-auto shadow-sm">
                <img src={mfaData.qrCode} alt="TOTP QR Code" className="h-44 w-44" />
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Or enter secret key manually:
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {mfaData.secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Verify form */}
              <form onSubmit={handleVerify} className="space-y-3 pt-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  2. Enter 6-digit code from your app to verify:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-center text-sm font-mono tracking-widest text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 transition-colors shadow"
                  >
                    Activate MFA
                  </button>
                </div>
              </form>

              {/* Emergency Backup Codes */}
              {mfaData.backupCodes?.length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900 text-xs">
                  <div className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1 mb-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Emergency Recovery Codes</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">
                    Save these one-time codes in a safe place in case you lose access to your device:
                  </p>
                  <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-800 dark:text-slate-200">
                    {mfaData.backupCodes.map((code, i) => (
                      <span key={i} className="bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 text-center">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
