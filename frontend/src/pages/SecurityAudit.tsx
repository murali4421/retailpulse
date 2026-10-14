import React, { useState, useEffect } from 'react';
import { api, type AuditLog, type SecurityAlert } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
  Activity,
  Terminal,
  X
} from 'lucide-react';

export const SecurityAudit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [thresholds, setThresholds] = useState<any>({
    maxFailedLoginsInWindow: 3,
    windowMinutes: 5,
    highValueRefundLimit: 200,
    afterHoursStart: 23,
    afterHoursEnd: 5
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  // Modals
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({ ...thresholds });

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      const [logsData, alertsData, thresh] = await Promise.all([
        api.getAuditLogs({ limit: 150 }),
        api.getSecurityAlerts(),
        api.getThreatThresholds()
      ]);
      setLogs(logsData);
      setAlerts(alertsData);
      setThresholds(thresh);
      setThresholdForm(thresh);
    } catch (err) {
      console.error('Failed to load security audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();

    // Real-time WebSocket feed for security events and logs
    const unsub = api.subscribeToLiveEvents((event) => {
      if (event.type === 'AUDIT_LOG_RECORDED') {
        setLogs(prev => [event.data, ...prev.slice(0, 149)]);
      } else if (event.type === 'SECURITY_ALERT_TRIGGERED') {
        setAlerts(prev => [event.data, ...prev]);
      }
    });

    return () => unsub();
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.updateAlertStatus(alertId, 'RESOLVED');
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'RESOLVED' } : a));
    } catch (err: any) {
      alert('Failed to resolve alert: ' + err.message);
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateThreatThresholds(thresholdForm);
      setThresholds(updated);
      setIsThresholdModalOpen(false);
      alert('Security anomaly thresholds updated successfully!');
    } catch (err: any) {
      alert('Failed to update thresholds: ' + err.message);
    }
  };

  const exportSecurityPdf = () => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RetailPulse SaaS - Formal Security Audit Log Report', 14, 18);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toISOString()} | Standard: SOC 2 & GDPR Art. 30`, 14, 25);

    const logRows = logs.slice(0, 50).map(l => [
      new Date(l.timestamp).toLocaleTimeString(),
      l.action,
      l.userEmail,
      l.ipAddress,
      l.severity,
      l.status
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Time', 'Action', 'User Email', 'IP Address', 'Severity', 'Status']],
      body: logRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 }
    });

    doc.save(`RetailPulse_Security_Audit_${Date.now()}.pdf`);
  };

  const filteredLogs = logs.filter(l => {
    const matchSev = severityFilter === 'ALL' || l.severity === severityFilter;
    const matchType = eventTypeFilter === 'ALL' || l.eventType === eventTypeFilter;
    const matchQuery =
      search === '' ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      l.ipAddress.includes(search) ||
      l.id.includes(search);
    return matchSev && matchType && matchQuery;
  });

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>Security Auditing & Threat Monitoring</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time access events, anomaly detection, threshold configuration, and SOC 2 / GDPR compliance trails
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsThresholdModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            <Sliders className="h-4 w-4 text-indigo-500" />
            <span>Threat Thresholds</span>
          </button>

          <a
            href={api.getAuditExportCsvUrl()}
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={exportSecurityPdf}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF Audit</span>
          </button>
        </div>
      </div>

      {/* Active Security Threat Alerts Banner */}
      {activeAlerts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            <span>Active Security Anomalies ({activeAlerts.length} Action Required)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-4 space-y-2 relative"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-600 text-white px-1.5 py-0.5 text-[9px] font-bold">
                      {alert.severity}
                    </span>
                    <h4 className="font-bold text-xs text-rose-950 dark:text-rose-200">{alert.title}</h4>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-rose-900/80 dark:text-rose-300 leading-relaxed">
                  {alert.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-rose-200 dark:border-rose-900/40 text-[11px]">
                  <span className="text-rose-700 dark:text-rose-400">
                    Target: <strong className="font-mono">{alert.affectedUser}</strong>
                  </span>
                  <button
                    onClick={() => handleResolveAlert(alert.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-[11px] font-bold shadow-sm"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Acknowledge & Dismiss</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <strong className="font-semibold">Threat Detection Engine Active:</strong> No active security anomalies detected. System operating normally under strict zero-trust thresholds.
          </div>
        </div>
      )}

      {/* Audit Log Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, email, IP, or log ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Event Types</option>
            <option value="AUTH_EVENT">Authentication</option>
            <option value="SALES_EVENT">Sales & Refunds</option>
            <option value="INVENTORY_EVENT">Inventory</option>
            <option value="SECURITY_EVENT">Security Anomalies</option>
            <option value="COMPLIANCE_EVENT">GDPR / Privacy</option>
          </select>
        </div>
      </div>

      {/* Real-Time Live Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Live Immutable Audit Trail
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {filteredLogs.length} events logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Event & Action</th>
                <th className="py-2.5 px-4">User Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Source IP</th>
                <th className="py-2.5 px-4 text-center">Severity</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading audit stream...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No audit records match the filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                        {log.action}
                      </div>
                      <div className="text-[10px] text-slate-400">{log.eventType}</div>
                    </td>

                    <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {log.userEmail}
                    </td>

                    <td className="py-2.5 px-4">
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        {log.userRole}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {log.ipAddress}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400'
                            : log.severity === 'WARNING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          log.status === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threat Threshold Configuration Modal */}
      {isThresholdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Threat Detection Thresholds
                </h3>
              </div>
              <button onClick={() => setIsThresholdModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveThresholds} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Brute Force Max Failed Logins:
                </label>
                <input
                  type="number"
                  value={thresholdForm.maxFailedLoginsInWindow}
                  onChange={(e) => setThresholdForm(p => ({ ...p, maxFailedLoginsInWindow: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400">Triggers critical alert when exceeded within 5-min window</span>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  High-Value Refund Alert Threshold ($):
                </label>
                <input
                  type="number"
                  value={thresholdForm.highValueRefundLimit}
                  onChange={(e) => setThresholdForm(p => ({ ...p, highValueRefundLimit: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    After-Hours Start (Hour 0-23):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={thresholdForm.afterHoursStart}
                    onChange={(e) => setThresholdForm(p => ({ ...p, afterHoursStart: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    After-Hours End (Hour 0-23):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={thresholdForm.afterHoursEnd}
                    onChange={(e) => setThresholdForm(p => ({ ...p, afterHoursEnd: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-md"
                >
                  Save Thresholds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
