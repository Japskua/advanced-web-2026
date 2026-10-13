/**
 * Client-side encryption with the Web Crypto API (crypto.subtle).
 *
 * Files are encrypted in the browser before they are uploaded, and decrypted
 * in the browser after they are downloaded. The server, the database and the
 * object storage only ever see ciphertext. This is "end-to-end" encryption:
 * even someone with full access to the server cannot read the files.
 *
 * AES-GCM with a 256-bit key:
 * - AES is the standard symmetric cipher; GCM is a mode that also
 *   *authenticates*: decryption fails if a single bit of the ciphertext was
 *   changed, so tampering is detected, not just hidden.
 * - Every encryption needs a fresh random 12-byte IV (nonce). Reusing an IV with
 *   the same key breaks GCM's security. The IV is not secret; it is stored with
 *   the file's metadata.
 *
 * Base64/hex conversion uses Uint8Array.toBase64(), fromBase64() and toHex(),
 * built into current browsers and Bun.
 */
import { AES_GCM_IV_BYTES } from "@shared/limits";

const KEY_BYTES = 32; // 256 bits

export async function generateKey(): Promise<CryptoKey> {
  // extractable: true, so the key can be shown to the user (to save it) and
  // hashed into a fingerprint.
  return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key)).toBase64();
}

export async function importKey(base64: string): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = Uint8Array.fromBase64(base64.replace(/\s+/g, ""));
  } catch {
    throw new Error("That is not a valid key (it must be Base64 text).");
  }
  if (raw.length !== KEY_BYTES) {
    throw new Error("That is not a valid key (it must be 256 bits long).");
  }
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
}

// The SHA-256 hash of the key, in hex. It identifies the key without revealing
// it: a hash cannot be turned back into its input.
export async function fingerprintOf(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", raw)).toHex();
}

export async function encryptFile(file: File, key: CryptoKey): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());
  return { ciphertext: new Uint8Array(ciphertext), iv: iv.toBase64() };
}

export async function decryptBytes(ciphertext: ArrayBuffer, key: CryptoKey, ivBase64: string): Promise<ArrayBuffer> {
  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.fromBase64(ivBase64) }, key, ciphertext);
  } catch {
    // GCM's authentication check failed: wrong key, or the data was changed.
    throw new Error("Decryption failed: wrong key, or the file was modified.");
  }
}
