import { createBackup, listBackups } from '../services/backupService.js';
import { recordAuditEvent } from '../services/auditService.js';

export function getBackups(req, res) {
  const backups = listBackups();
  return res.json(backups);
}

export function triggerBackup(req, res) {
  const { reason = 'MANUAL_TRIGGER' } = req.body;
  const initiator = req.user?.email || 'admin@retailpulse.io';

  try {
    const backupMetadata = createBackup(reason, initiator);
    return res.status(201).json({
      message: 'Encrypted database backup created successfully',
      backup: backupMetadata
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
}
