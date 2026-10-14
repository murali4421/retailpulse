import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { database, saveDatabase } from '../data/store.js';
import { encryptData, hashData } from './encryptionService.js';
import { recordAuditEvent } from './auditService.js';

const BACKUP_DIR = path.join(process.cwd(), 'src/data/backups');

export function initBackupService() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Schedule automated daily backup (every 24 hours)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    try {
      console.log('[Automated Backup] Running scheduled daily database backup...');
      createBackup('AUTOMATED_DAILY_CRON', 'system');
    } catch (err) {
      console.error('[Automated Backup] Failed scheduled backup:', err.message);
    }
  }, TWENTY_FOUR_HOURS);
}

/**
 * Create a new encrypted database backup
 */
export function createBackup(reason = 'MANUAL_TRIGGER', initiatedBy = 'admin@retailpulse.io') {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `bkp_${uuidv4().substring(0, 8)}_${timestamp}`;
  const filename = `${backupId}.enc.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  const snapshot = {
    backupId,
    createdAt: new Date().toISOString(),
    version: '1.0.0',
    reason,
    initiatedBy,
    data: database
  };

  const rawJson = JSON.stringify(snapshot, null, 2);
  const integrityChecksum = hashData(rawJson);

  // Encrypt with AES-256-GCM
  const encryptedPayload = encryptData(rawJson);

  const metadata = {
    backupId,
    filename,
    createdAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(encryptedPayload, 'utf8'),
    storesCount: database.stores.length,
    productsCount: database.inventory.length,
    salesCount: database.sales.length,
    checksum: integrityChecksum,
    encrypted: true,
    reason,
    initiatedBy
  };

  fs.writeFileSync(filePath, JSON.stringify({ metadata, payload: encryptedPayload }, null, 2), 'utf8');

  recordAuditEvent({
    eventType: 'BACKUP_EVENT',
    action: 'BACKUP_CREATED',
    userEmail: initiatedBy,
    status: 'SUCCESS',
    details: { backupId, filename, reason, checksum: integrityChecksum }
  });

  return metadata;
}

/**
 * List all existing backups
 */
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.enc.json'));
  const backups = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.metadata) {
        backups.push(parsed.metadata);
      }
    } catch (err) {
      // ignore corrupted file
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
