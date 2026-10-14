import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileCheck2,
  Lock,
  UserCheck,
  UserX,
  Download,
  Shield,
  FileText,
  CheckCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

export const Compliance: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subject export state
  const [exportEmail, setExportEmail] = useState('');
  const [exportResult, setExportResult] = useState<any>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Erasure state
  const [erasureEmail, setErasureEmail] = useState('');
  const [erasureJustification, setErasureJustification] = useState('Customer invoked GDPR Article 17 right to be forgotten');
  const [erasureLoading, setErasureLoading] = useState(false);

  const loadCompliance = async () => {
    try {
      setLoading(true);
      const [sum, recs] = await Promise.all([
        api.getComplianceSummary(),
        api.getComplianceRecords()
      ]);
      setSummary(sum);
      setRecords(recs);
    } catch (err) {
      console.error('Failed to load compliance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompliance();
  }, []);

  const handleExportSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportEmail.trim()) return;
    setExportLoading(true);
    try {
      const res = await api.exportSubjectData(exportEmail);
      setExportResult(res);
    } catch (err: any) {
      alert('Subject export error: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!erasureEmail.trim()) return;
    if (!confirm(`Are you certain you want to securely pseudonymize and erase personal data for ${erasureEmail}? This action cannot be reversed.`)) {
      return;
    }

    setErasureLoading(true);
    try {
      const res = await api.processErasureRequest(erasureEmail, erasureJustification);
      alert(res.message);
      setErasureEmail('');
      loadCompliance();
    } catch (err: any) {
      alert('Erasure error: ' + err.message);
    } finally {
      setErasureLoading(false);
    }
  };

  const downloadComplianceCertificate = () => {
    if (!summary) return;
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF REGULATORY COMPLIANCE', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RetailPulse SaaS Cloud Architecture - GDPR (EU 2016/679) & CCPA Verified', 14, 28);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compliance Assessment Summary', 14, 50);

    const alignmentData = summary.standardAlignments.map((a: any) => [
      a.standard,
      a.scope,
      a.status
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Standard Framework', 'Regulatory Scope', 'Status']],
      body: alignmentData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 10 }
    });

    const metricsData = [
      ['Data Protection Officer (DPO)', 'dpo@retailpulse.io'],
      ['Encryption at Rest', summary.metrics.encryptionAtRest],
      ['Encryption in Transit', summary.metrics.encryptionInTransit],
      ['Multi-Factor Authentication Adoption', summary.metrics.mfaAdoptionRate],
      ['Audit Trail Immutable Retention', summary.metrics.auditTrailRetention],
      ['Automated Backups Cadence', summary.metrics.dailyAutomatedBackups]
    ];

    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.text('Technical and Organizational Safeguards (TOMs)', 14, nextY);

    autoTable(doc, {
      startY: nextY + 5,
      head: [['Control Safeguard', 'Implementation Parameter']],
      body: metricsData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 }
    });

    const signY = (doc as any).lastAutoTable.finalY + 25;
    doc.text('Authorized Compliance Officer: ______________________     Date: ____________', 14, signY);

    doc.save(`RetailPulse_GDPR_CCPA_Certificate_${Date.now()}.pdf`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileCheck2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>GDPR & CCPA Data Privacy Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise regulatory compliance, data subject access requests (DSAR), and immutable right-to-erasure workflows
          </p>
        </div>

        <button
          onClick={downloadComplianceCertificate}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20"
        >
          <Download className="h-4 w-4" />
          <span>Download Audit Certificate (PDF)</span>
        </button>
      </div>

      {/* Compliance Standard Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summary.standardAlignments.map((std: any, idx: number) => (
            <div key={idx} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-white">{std.standard.split(' ')[0]}</span>
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {std.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {std.scope}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Data Protection Technical Controls */}
      {summary && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <Shield className="h-4 w-4 text-indigo-500" />
            <span>Technical & Organizational Measures (TOMs)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Encryption at Rest</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{summary.metrics.encryptionAtRest}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Encryption in Transit</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{summary.metrics.encryptionInTransit}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">MFA Adoption Rate</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{summary.metrics.mfaAdoptionRate}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Audit Log Retention</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{summary.metrics.auditTrailRetention}</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Operations Panels: Right of Access (Export) & Right to Erasure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Right of Access */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Right of Access (GDPR Art. 15 / CCPA § 1798.100)
              </h3>
              <p className="text-xs text-slate-400">Generate complete machine-readable customer export</p>
            </div>
          </div>

          <form onSubmit={handleExportSubject} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Data Subject Email Address:
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@retailpulse.io or customer@example.com"
                  value={exportEmail}
                  onChange={(e) => setExportEmail(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={exportLoading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 shrink-0 shadow-sm"
                >
                  {exportLoading ? 'Exporting...' : 'Generate Packet'}
                </button>
              </div>
            </div>
          </form>

          {exportResult && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span>Export Generated for {exportResult.dataSubject}</span>
                <span className="text-[10px] text-emerald-500 font-mono">ENCRYPTED JSON</span>
              </div>
              <pre className="p-2 rounded bg-slate-900 text-slate-300 font-mono text-[10px] max-h-36 overflow-y-auto">
                {JSON.stringify(exportResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right to Erasure */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Right to Erasure (GDPR Art. 17 / CCPA § 1798.105)
              </h3>
              <p className="text-xs text-slate-400">Cryptographic pseudonymization of personal records</p>
            </div>
          </div>

          <form onSubmit={handleErasure} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Data Subject Email to Anonymize:
              </label>
              <input
                type="email"
                required
                placeholder="customer@example.com"
                value={erasureEmail}
                onChange={(e) => setErasureEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Regulatory Justification:
              </label>
              <input
                type="text"
                value={erasureJustification}
                onChange={(e) => setErasureJustification(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={erasureLoading}
              className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 shadow-md shadow-rose-600/20"
            >
              {erasureLoading ? 'Pseudonymizing...' : 'Execute Compliant Erasure'}
            </button>
          </form>
        </div>
      </div>

      {/* Compliance Log Register */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          Compliance Request Register (DSAR Log)
        </h3>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{r.requestType}</span>
                <span className="text-slate-400 font-mono text-[11px] ml-2">({r.subjectEmail})</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">{r.notes}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  {r.status}
                </span>
                <div className="text-[10px] text-slate-400 mt-1">{new Date(r.requestedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
