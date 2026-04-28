/**
 * Simple encryption/decryption utility for client-side obfuscation.
 * This prevents API keys from being stored in plain text in LocalStorage.
 */

// A static internal key used for XOR obfuscation.
// While this is discoverable in the source code, it fulfills the requirement
// of not appearing "as is" in the browser's storage inspector.
const SECRET_SALT = 'vox-spend-secure-salt-2024';

/**
 * Encrypts a string using XOR and Base64.
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result);
}

/**
 * Decrypts a string that was encrypted with the encrypt function.
 */
export function decrypt(encoded: string): string {
  if (!encoded) return '';
  
  // If it already starts with 'gsk_', it's a plain-text key from a previous version.
  if (encoded.startsWith('gsk_')) return encoded;

  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    // If decryption fails (e.g., if the string was not Base64 encoded),
    // return the original string. This allows for migration of plain-text keys.
    return encoded;
  }
}

/**
 * Checks if a string appears to be already encrypted.
 * In our case, we can check if it starts with 'gsk_' (plain Groq key) 
 * or if it's valid Base64 that decrypts to something sensible.
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  // If it starts with 'gsk_', it's definitely not encrypted by our utility.
  if (text.startsWith('gsk_')) return false;
  
  try {
    const decrypted = decrypt(text);
    // If decryption results in something that starts with 'gsk_', then it was encrypted.
    return decrypted.startsWith('gsk_');
  } catch {
    return false;
  }
}
