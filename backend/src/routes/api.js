import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/authCheck.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';

// Controllers
import * as authCtrl from '../controllers/authController.js';
import * as invCtrl from '../controllers/inventoryController.js';
import * as salesCtrl from '../controllers/salesController.js';
import * as auditCtrl from '../controllers/auditController.js';
import * as compCtrl from '../controllers/complianceController.js';
import * as backupCtrl from '../controllers/backupController.js';
import * as storeCtrl from '../controllers/storeController.js';

const router = Router();

// ==========================================
// 1. Authentication & OAuth 2.0 / OIDC
// ==========================================
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.getMe);
router.get('/auth/oauth/:provider/authorize', authCtrl.oauthAuthorize);
router.post('/auth/oauth/token', authCtrl.oauthTokenExchange);
router.get('/.well-known/openid-configuration', authCtrl.getOidcMetadata);

// MFA Endpoints
router.post('/auth/mfa/setup', authenticate, authCtrl.setupMfa);
router.post('/auth/mfa/confirm', authenticate, authCtrl.confirmMfa);

// ==========================================
// 2. Inventory & Barcode Tracking
// ==========================================
router.get('/inventory', authenticate, requirePermission('inventory:read'), invCtrl.getInventory);
router.get('/inventory/barcode/:barcode', authenticate, requirePermission('inventory:read'), invCtrl.lookupBarcode);
router.post('/inventory', authenticate, requirePermission('inventory:write'), invCtrl.saveProduct);
router.put('/inventory/:id/stock', authenticate, requirePermission('inventory:write'), invCtrl.adjustStock);
router.get('/inventory/replenishment', authenticate, requirePermission('inventory:reorder'), invCtrl.getReplenishmentRecommendations);
router.post('/inventory/reorder', authenticate, requirePermission('inventory:reorder'), invCtrl.createReorderOrder);
router.post('/inventory/transfer', authenticate, requirePermission('inventory:write'), invCtrl.transferStock);

// ==========================================
// 3. Sales, POS & Offline Sync
// ==========================================
router.post('/sales', authenticate, requirePermission('sales:create'), salesCtrl.createSale);
router.post('/sales/batch-sync', authenticate, requirePermission('sales:create'), salesCtrl.batchSyncSales);
router.get('/sales', authenticate, requirePermission('sales:read'), salesCtrl.getSales);
router.post('/sales/:id/refund', authenticate, requirePermission('sales:refund'), salesCtrl.refundSale);
router.get('/sales/analytics/summary', authenticate, requirePermission('reports:view'), salesCtrl.getSalesDashboardSummary);

// ==========================================
// 4. Security Auditing & Threat Monitoring
// ==========================================
router.get('/audit/logs', authenticate, requirePermission('audit:read'), auditCtrl.listAuditLogs);
router.get('/audit/logs/export/csv', authenticate, requirePermission('audit:export'), auditCtrl.exportAuditLogsCsv);
router.get('/audit/alerts', authenticate, requirePermission('audit:read'), auditCtrl.listSecurityAlerts);
router.put('/audit/alerts/:id', authenticate, requirePermission('security:manage'), auditCtrl.handleUpdateAlert);
router.get('/audit/thresholds', authenticate, requirePermission('security:manage'), auditCtrl.getThreatThresholds);
router.put('/audit/thresholds', authenticate, requirePermission('security:manage'), auditCtrl.updateThreatThresholds);

// ==========================================
// 5. GDPR & CCPA Compliance
// ==========================================
router.get('/compliance/records', authenticate, requirePermission('compliance:read'), compCtrl.getComplianceRecords);
router.get('/compliance/summary', authenticate, requirePermission('compliance:read'), compCtrl.generateComplianceSummary);
router.post('/compliance/export-subject', authenticate, requirePermission('compliance:export'), compCtrl.exportDataSubjectRecord);
router.post('/compliance/erasure', authenticate, requireRole('super_admin'), compCtrl.processErasureRequest);

// ==========================================
// 6. Multi-Store Management & Cloud Sync
// ==========================================
router.get('/stores', authenticate, storeCtrl.getStores);
router.post('/stores', authenticate, requireRole('super_admin'), storeCtrl.createStore);
router.post('/stores/:storeId/sync', authenticate, storeCtrl.syncStoreHeartbeat);

// ==========================================
// 7. Automated Backups & System Admin
// ==========================================
router.get('/backups', authenticate, requireRole('super_admin'), backupCtrl.getBackups);
router.post('/backups/trigger', authenticate, requireRole('super_admin'), backupCtrl.triggerBackup);

export default router;
