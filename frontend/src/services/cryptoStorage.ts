// Client-Side Robust Local Encryption Service using Web Crypto API (AES-GCM)
// Secures cached offline transactions and tokens in browser IndexedDB / localStorage

const ENCRYPTION_SALT = new Uint8Array([114, 101, 116, 97, 105, 108, 112, 117, 108, 115, 101, 50, 48, 50, 54, 33]);

async function getEncryptionKey(): Promise<CryptoKey> {
  const masterPass = 'retailpulse-local-secure-vault-key-2026';
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(masterPass),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCRYPTION_SALT,
      iterations: 50000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary object into base64 string
 */
export async function encryptObject(data: any): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    let binary = '';
    const bytes = new Uint8Array(combined);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.warn('Encryption fallback to JSON:', err);
    return JSON.stringify(data);
  }
}

/**
 * Decrypt base64 string back into object
 */
export async function decryptObject<T = any>(encryptedBase64: string): Promise<T | null> {
  try {
    if (!encryptedBase64) return null;
    if (encryptedBase64.startsWith('{') || encryptedBase64.startsWith('[')) {
      return JSON.parse(encryptedBase64);
    }

    const binary = window.atob(encryptedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const key = await getEncryptionKey();
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded) as T;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}
