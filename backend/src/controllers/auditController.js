import { getAuditLogs, getSecurityAlerts, updateAlertStatus, updateThresholds, SECURITY_THRESHOLDS } from '../services/auditService.js';
import { recordAuditEvent } from '../services/auditService.js';

export function listAuditLogs(req, res) {
  const { limit, eventType, severity, status, search } = req.query;
  const logs = getAuditLogs({ limit, eventType, severity, status, search });
  return res.json(logs);
}

export function listSecurityAlerts(req, res) {
  const alerts = getSecurityAlerts();
  return res.json(alerts);
}

export function handleUpdateAlert(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const updated = updateAlertStatus(id, status);
  if (!updated) return res.status(404).json({ error: 'Alert not found' });

  recordAuditEvent({
    eventType: 'SECURITY_EVENT',
    action: 'SECURITY_ALERT_STATUS_CHANGE',
    userEmail: req.user?.email || 'admin@retailpulse.io',
    details: { alertId: id, newStatus: status }
  });

  return res.json(updated);
}

export function getThreatThresholds(req, res) {
  return res.json(SECURITY_THRESHOLDS);
}

export function updateThreatThresholds(req, res) {
  const { maxFailedLoginsInWindow, highValueRefundLimit, afterHoursStart, afterHoursEnd } = req.body;
  const updated = updateThresholds({
    ...(maxFailedLoginsInWindow && { maxFailedLoginsInWindow: parseInt(maxFailedLoginsInWindow) }),
    ...(highValueRefundLimit && { highValueRefundLimit: parseFloat(highValueRefundLimit) }),
    ...(afterHoursStart !== undefined && { afterHoursStart: parseInt(afterHoursStart) }),
    ...(afterHoursEnd !== undefined && { afterHoursEnd: parseInt(afterHoursEnd) })
  });

  recordAuditEvent({
    eventType: 'SECURITY_EVENT',
    action: 'SECURITY_THRESHOLDS_CONFIGURED',
    userEmail: req.user?.email || 'admin@retailpulse.io',
    details: updated
  });

  return res.json(updated);
}

// Export Audit Logs as CSV
export function exportAuditLogsCsv(req, res) {
  const logs = getAuditLogs({ limit: 1000 });

  const headers = ['Timestamp', 'ID', 'Event Type', 'Action', 'Severity', 'User Email', 'Role', 'IP Address', 'Store ID', 'Status'];
  const rows = logs.map(l => [
    `"${l.timestamp}"`,
    `"${l.id}"`,
    `"${l.eventType}"`,
    `"${l.action}"`,
    `"${l.severity}"`,
    `"${l.userEmail}"`,
    `"${l.userRole}"`,
    `"${l.ipAddress}"`,
    `"${l.storeId}"`,
    `"${l.status}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  recordAuditEvent({
    eventType: 'COMPLIANCE_EVENT',
    action: 'DATA_EXPORT_CSV',
    userEmail: req.user?.email || 'auditor@retailpulse.io',
    details: { type: 'AUDIT_TRAIL_CSV', rowCount: rows.length }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="retailpulse_audit_logs_${Date.now()}.csv"`);
  return res.send(csvContent);
}
