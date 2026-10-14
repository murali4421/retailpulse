import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
// In production, ENCRYPTION_MASTER_KEY is loaded from secure KMS / Env var
const MASTER_SECRET = process.env.ENCRYPTION_MASTER_KEY || 'retailpulse-saas-enterprise-secure-key-2026-gdpr';

// Derive a 32-byte key using PBKDF2
function getKey(salt) {
  return crypto.pbkdf2Sync(MASTER_SECRET, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive text using AES-256-GCM (Authenticated Encryption)
 * @param {string} text - Plaintext to encrypt
 * @returns {string} - Formatted as salt:iv:tag:ciphertext (base64)
 */
export function encryptData(text) {
  if (text === null || text === undefined) return text;
  if (typeof text !== 'string') text = JSON.stringify(text);

  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    Buffer.from(encrypted, 'hex').toString('base64')
  ].join(':');
}

/**
 * Decrypt AES-256-GCM ciphertext
 * @param {string} encryptedString - Formatted as salt:iv:tag:ciphertext
 * @returns {string} - Decrypted plaintext
 */
export function decryptData(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') return encryptedString;
  const parts = encryptedString.split(':');
  if (parts.length !== 4) {
    // If not encrypted in this format, return as is (for backwards compatibility)
    return encryptedString;
  }

  try {
    const salt = Buffer.from(parts[0], 'base64');
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64').toString('hex');

    const key = getKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

/**
 * Hash data with SHA-256 (for checksums, audit integrity)
 */
export function hashData(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}
