import { describe, it, expect, beforeAll } from "vitest";
import { encryptField, decryptField, isEncrypted } from "./crypto-utils";

// Set a test JWT_SECRET before running
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-vitest-only-32chars!!";
});

describe("crypto-utils", () => {
  it("encrypts and decrypts a password round-trip", () => {
    const plaintext = "MyRouterP@ssw0rd!";
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(isEncrypted(encrypted)).toBe(true);
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "samePassword";
    const a = encryptField(plaintext);
    const b = encryptField(plaintext);
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(plaintext);
    expect(decryptField(b)).toBe(plaintext);
  });

  it("returns null for garbage input", () => {
    expect(decryptField("not-hex-at-all")).toBe(null);
    expect(decryptField("abcdef")).toBe(null);
    expect(decryptField("")).toBe(null);
  });

  it("returns null for truncated ciphertext", () => {
    const encrypted = encryptField("test");
    const truncated = encrypted.slice(0, 20);
    expect(decryptField(truncated)).toBe(null);
  });

  it("isEncrypted returns false for short strings", () => {
    expect(isEncrypted("admin")).toBe(false);
    expect(isEncrypted("short")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("isEncrypted returns false for plaintext passwords", () => {
    // Typical router passwords are short and contain non-hex chars
    expect(isEncrypted("MyP@ssword123")).toBe(false);
    expect(isEncrypted("admin")).toBe(false);
  });

  it("handles unicode passwords", () => {
    const plaintext = "пароль-密码-パスワード";
    const encrypted = encryptField(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it("handles empty string password", () => {
    const encrypted = encryptField("");
    // Empty string encrypts to IV + tag + 0 bytes of ciphertext
    // decryptField returns empty string for valid 0-byte ciphertext
    const result = decryptField(encrypted);
    expect(result).toBe("");
  });
});
