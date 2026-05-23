const DB_NAME = 'voxspend-crypto';
const KEY_STORE = 'crypto-keys';
const CRYPTO_KEY_ID = 'main';
const V2_PREFIX = 'v2:';

// Kept for migrating old XOR-encrypted values stored by the previous implementation.
const LEGACY_XOR_ID = import.meta.env.VITE_APP_ID || 'vox-spend-default-v1';

function openCryptoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KEY_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openCryptoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    const store = tx.objectStore(KEY_STORE);
    const getReq = store.get(CRYPTO_KEY_ID);
    getReq.onsuccess = async () => {
      if (getReq.result) {
        resolve(getReq.result as CryptoKey);
        return;
      }
      try {
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable: JS cannot read raw key bytes
          ['encrypt', 'decrypt'],
        );
        const putReq = store.put(key, CRYPTO_KEY_ID);
        putReq.onsuccess = () => resolve(key);
        putReq.onerror = () => reject(putReq.error);
      } catch (err) {
        reject(err);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function encrypt(text: string): Promise<string> {
  if (!text) return '';
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return V2_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decrypt(stored: string): Promise<string> {
  if (!stored) return '';
  // Plaintext key — pre-encryption era, return as-is
  if (stored.startsWith('gsk_')) return stored;
  // New Web Crypto format
  if (stored.startsWith(V2_PREFIX)) {
    const key = await getOrCreateKey();
    const combined = Uint8Array.from(atob(stored.slice(V2_PREFIX.length)), (c) =>
      c.charCodeAt(0),
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      key,
      combined.slice(12),
    );
    return new TextDecoder().decode(decrypted);
  }
  // Legacy XOR-encoded value — migrate silently
  return xorDecrypt(stored);
}

function xorDecrypt(encoded: string): string {
  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ LEGACY_XOR_ID.charCodeAt(i % LEGACY_XOR_ID.length),
      );
    }
    return result;
  } catch {
    return '';
  }
}