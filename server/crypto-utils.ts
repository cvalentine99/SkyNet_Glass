/**
 * crypto-utils.ts — AES-256-GCM encryption for sensitive fields at rest.
 *
 * Uses JWT_SECRET (already in env) as the key derivation seed.
 * This is not a substitute for a proper secrets manager, but it
 * prevents plaintext passwords from sitting in MySQL rows.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT = "skynet-glass-v1"; // static salt is fine — key is already high-entropy

let _derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_derivedKey) return _derivedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required for password encryption");
  }
  _derivedKey = scryptSync(secret, SALT, 32);
  return _derivedKey;
}

/**
 * Encrypt a plaintext string.
 * Returns a hex-encoded string: iv + ciphertext + authTag
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: iv (16) + tag (16) + ciphertext (variable)
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

/**
 * Decrypt a hex-encoded string produced by encryptField().
 * Returns null if decryption fails (wrong key, corrupted data, or plaintext input).
 */
export function decryptField(hex: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(hex, "hex");
    if (buf.length < IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like it was encrypted by encryptField().
 * Simple heuristic: must be hex and at least (IV + TAG + 1 byte) * 2 chars.
 */
export function isEncrypted(value: string): boolean {
  if (value.length < (IV_LEN + TAG_LEN) * 2) return false;
  return /^[0-9a-f]+$/i.test(value);
}
