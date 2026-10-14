import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Audit storage file for persistence
const AUDIT_FILE = path.join(process.cwd(), 'src/data/audit_logs.json');

// Memory buffer of audit logs
let auditLogs = [];
let securityAlerts = [];

// Customizable security monitoring thresholds
export const SECURITY_THRESHOLDS = {
  maxFailedLoginsInWindow: 3,     // triggers brute force alert
  windowMinutes: 5,               // detection window
  highValueRefundLimit: 200,      // $200 threshold
  afterHoursStart: 23,            // 11 PM
  afterHoursEnd: 5                // 5 AM
};

// WebSocket broadcaster hook (set by server.js)
let wsBroadcaster = null;
export function setAuditWebSocketBroadcaster(broadcaster) {
  wsBroadcaster = broadcaster;
}

// Initialize and load persisted logs
export function initAuditService() {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, 'utf8');
      const parsed = JSON.parse(data);
      auditLogs = parsed.auditLogs || [];
      securityAlerts = parsed.securityAlerts || [];
    } else {
      seedInitialAuditLogs();
      saveAuditData();
    }
  } catch (err) {
    console.error('Error initializing audit logs, creating fresh seed:', err.message);
    seedInitialAuditLogs();
  }
}

function saveAuditData() {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify({ auditLogs, securityAlerts }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist audit logs:', err.message);
  }
}

/**
 * Log an audit/security event
 */
export function recordAuditEvent({
  eventType = 'USER_ACCESS',
  action,
  userId = 'anonymous',
  userEmail = 'anonymous',
  userRole = 'guest',
  ipAddress = '127.0.0.1',
  userAgent = 'Unknown Client',
  storeId = 'LOC-001',
  status = 'SUCCESS',
  details = {},
  severity = 'INFO'
}) {
  const logEntry = {
    id: 'aud_' + uuidv4().substring(0, 8),
    timestamp: new Date().toISOString(),
    eventType,
    action,
    userId,
    userEmail,
    userRole,
    ipAddress,
    userAgent,
    storeId,
    status,
    details,
    severity
  };

  auditLogs.unshift(logEntry);
  if (auditLogs.length > 5000) auditLogs.pop(); // keep last 5000

  // Run real-time threat detection
  evaluateThreatRules(logEntry);

  saveAuditData();

  if (wsBroadcaster) {
    wsBroadcaster({
      type: 'AUDIT_LOG_RECORDED',
      data: logEntry
    });
  }

  return logEntry;
}

/**
 * Real-time automated threat detection rules engine
 */
function evaluateThreatRules(logEntry) {
  const now = new Date(logEntry.timestamp);
  const hour = now.getHours();

  // Rule 1: Brute Force Login Detection
  if (logEntry.action === 'AUTH_LOGIN' && logEntry.status === 'FAILURE') {
    const windowStart = new Date(now.getTime() - SECURITY_THRESHOLDS.windowMinutes * 60 * 1000);
    const recentFailures = auditLogs.filter(
      l => l.action === 'AUTH_LOGIN' &&
           l.status === 'FAILURE' &&
           (l.ipAddress === logEntry.ipAddress || l.userEmail === logEntry.userEmail) &&
           new Date(l.timestamp) >= windowStart
    );

    if (recentFailures.length >= SECURITY_THRESHOLDS.maxFailedLoginsInWindow) {
      triggerSecurityAlert({
        threatType: 'BRUTE_FORCE_ATTEMPT',
        severity: 'CRITICAL',
        title: 'Potential Brute-Force Authentication Detected',
        description: `Multiple (${recentFailures.length}) consecutive failed login attempts detected from IP ${logEntry.ipAddress} targeting email ${logEntry.userEmail}.`,
        affectedUser: logEntry.userEmail,
        ipAddress: logEntry.ipAddress,
        recommendedAction: 'Enforce MFA / Temporarily throttle IP address'
      });
    }
  }

  // Rule 2: High Value Refund or Unusual Cash Out
  if (logEntry.action === 'SALE_REFUND' && logEntry.details?.amount > SECURITY_THRESHOLDS.highValueRefundLimit) {
    triggerSecurityAlert({
      threatType: 'HIGH_VALUE_REFUND',
      severity: 'WARNING',
      title: 'High-Value Refund Processed',
      description: `Refund of $${logEntry.details.amount.toFixed(2)} was processed by ${logEntry.userEmail} at store ${logEntry.storeId}. Threshold is $${SECURITY_THRESHOLDS.highValueRefundLimit}.`,
      affectedUser: logEntry.userEmail,
      ipAddress: logEntry.ipAddress,
      recommendedAction: 'Verify transaction against physical receipt and manager approval'
    });
  }

  // Rule 3: After-hours Store Access
  if (hour >= SECURITY_THRESHOLDS.afterHoursStart || hour < SECURITY_THRESHOLDS.afterHoursEnd) {
    if (logEntry.action === 'AUTH_LOGIN' && logEntry.status === 'SUCCESS' && logEntry.userRole !== 'super_admin') {
      triggerSecurityAlert({
        threatType: 'AFTER_HOURS_ACCESS',
        severity: 'WARNING',
        title: 'Unusual After-Hours System Access',
        description: `User ${logEntry.userEmail} (${logEntry.userRole}) authenticated at ${now.toLocaleTimeString()} outside standard operating window.`,
        affectedUser: logEntry.userEmail,
        ipAddress: logEntry.ipAddress,
        recommendedAction: 'Verify employee schedule or alert store supervisor'
      });
    }
  }

  // Rule 4: Bulk Data Export
  if (logEntry.action === 'DATA_EXPORT_CSV' || logEntry.action === 'GDPR_DATA_EXPORT') {
    triggerSecurityAlert({
      threatType: 'BULK_DATA_EXPORT',
      severity: 'INFO',
      title: 'Sensitive Data Export Triggered',
      description: `User ${logEntry.userEmail} downloaded data export (${logEntry.action}). GDPR/CCPA accountability logged.`,
      affectedUser: logEntry.userEmail,
      ipAddress: logEntry.ipAddress,
      recommendedAction: 'Ensure compliance with organization privacy policy'
    });
  }
}

/**
 * Trigger & persist automated security alert
 */
export function triggerSecurityAlert(alertData) {
  const alert = {
    id: 'alt_' + uuidv4().substring(0, 8),
    timestamp: new Date().toISOString(),
    status: 'ACTIVE', // ACTIVE | RESOLVED | ACKNOWLEDGED
    ...alertData
  };

  securityAlerts.unshift(alert);
  if (securityAlerts.length > 500) securityAlerts.pop();

  saveAuditData();

  if (wsBroadcaster) {
    wsBroadcaster({
      type: 'SECURITY_ALERT_TRIGGERED',
      data: alert
    });
  }

  return alert;
}

export function getAuditLogs({ limit = 100, eventType, severity, status, search }) {
  let filtered = [...auditLogs];

  if (eventType) filtered = filtered.filter(l => l.eventType === eventType);
  if (severity) filtered = filtered.filter(l => l.severity === severity);
  if (status) filtered = filtered.filter(l => l.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(l => 
      l.action.toLowerCase().includes(s) ||
      l.userEmail.toLowerCase().includes(s) ||
      l.ipAddress.includes(s) ||
      l.storeId.toLowerCase().includes(s)
    );
  }

  return filtered.slice(0, parseInt(limit));
}

export function getSecurityAlerts() {
  return securityAlerts;
}

export function updateAlertStatus(alertId, newStatus) {
  const alert = securityAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.status = newStatus;
    saveAuditData();
    return alert;
  }
  return null;
}

export function updateThresholds(newThresholds) {
  Object.assign(SECURITY_THRESHOLDS, newThresholds);
  return SECURITY_THRESHOLDS;
}

/**
 * Seed realistic audit logs for dashboard visualization
 */
function seedInitialAuditLogs() {
  const baseTime = Date.now();
  const sampleUsers = [
    { email: 'admin@retailpulse.io', role: 'super_admin' },
    { email: 'manager.downtown@retailpulse.io', role: 'store_manager' },
    { email: 'cashier.alex@retailpulse.io', role: 'cashier' },
    { email: 'auditor.compliance@retailpulse.io', role: 'compliance_auditor' }
  ];

  auditLogs = [
    {
      id: 'aud_seed_01',
      timestamp: new Date(baseTime - 12 * 60 * 1000).toISOString(),
      eventType: 'AUTH_EVENT',
      action: 'AUTH_LOGIN',
      userId: 'usr_admin',
      userEmail: 'admin@retailpulse.io',
      userRole: 'super_admin',
      ipAddress: '198.51.100.24',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0',
      storeId: 'LOC-001',
      status: 'SUCCESS',
      severity: 'INFO',
      details: { method: 'OAuth2/OIDC', idp: 'Okta' }
    },
    {
      id: 'aud_seed_02',
      timestamp: new Date(baseTime - 25 * 60 * 1000).toISOString(),
      eventType: 'INVENTORY_EVENT',
      action: 'STOCK_RESTOCK',
      userId: 'usr_mgr',
      userEmail: 'manager.downtown@retailpulse.io',
      userRole: 'store_manager',
      ipAddress: '198.51.100.89',
      userAgent: 'RetailPulse Desktop v1.0 (Electron)',
      storeId: 'LOC-001',
      status: 'SUCCESS',
      severity: 'INFO',
      details: { sku: 'SKU-COF-01', quantityAdded: 50, supplier: 'Pacific Roasters Co.' }
    },
    {
      id: 'aud_seed_03',
      timestamp: new Date(baseTime - 45 * 60 * 1000).toISOString(),
      eventType: 'SECURITY_EVENT',
      action: 'AUTH_LOGIN',
      userId: 'anonymous',
      userEmail: 'manager.downtown@retailpulse.io',
      userRole: 'guest',
      ipAddress: '203.0.113.195',
      userAgent: 'Python-Requests/2.31',
      storeId: 'LOC-001',
      status: 'FAILURE',
      severity: 'WARNING',
      details: { reason: 'Invalid TOTP MFA token', attempt: 1 }
    },
    {
      id: 'aud_seed_04',
      timestamp: new Date(baseTime - 70 * 60 * 1000).toISOString(),
      eventType: 'SALES_EVENT',
      action: 'SALE_TRANSACTION',
      userId: 'usr_cashier',
      userEmail: 'cashier.alex@retailpulse.io',
      userRole: 'cashier',
      ipAddress: '10.0.4.15',
      userAgent: 'RetailPulse POS Terminal (Touch/Scanner)',
      storeId: 'LOC-001',
      status: 'SUCCESS',
      severity: 'INFO',
      details: { orderId: 'ORD-9842', totalAmount: 48.50, itemsCount: 3, paymentMethod: 'NFC_CARD' }
    },
    {
      id: 'aud_seed_05',
      timestamp: new Date(baseTime - 110 * 60 * 1000).toISOString(),
      eventType: 'COMPLIANCE_EVENT',
      action: 'GDPR_CONSENT_UPDATE',
      userId: 'usr_admin',
      userEmail: 'admin@retailpulse.io',
      userRole: 'super_admin',
      ipAddress: '198.51.100.24',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0',
      storeId: 'LOC-001',
      status: 'SUCCESS',
      severity: 'INFO',
      details: { policyVersion: 'v2.4-2026', type: 'Customer Loyalty Data Retention' }
    }
  ];

  securityAlerts = [
    {
      id: 'alt_seed_01',
      timestamp: new Date(baseTime - 45 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      threatType: 'SUSPICIOUS_MFA_FAILURE',
      severity: 'WARNING',
      title: 'MFA Verification Anomaly Detected',
      description: 'Repeated TOTP MFA failure attempt for account manager.downtown@retailpulse.io from untrusted IP 203.0.113.195.',
      affectedUser: 'manager.downtown@retailpulse.io',
      ipAddress: '203.0.113.195',
      recommendedAction: 'Verify user credentials or reset password'
    }
  ];
}
