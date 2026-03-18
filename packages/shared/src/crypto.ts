import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(keyHex?: string): Buffer {
  const hex = keyHex ?? process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY environment variable is required");
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return buf;
}

export function encrypt(
  plaintext: string,
  keyHex?: string
): { encrypted: string; iv: string } {
  const key = getKey(keyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(
  encryptedBase64: string,
  ivBase64: string,
  keyHex?: string
): string {
  const key = getKey(keyHex);
  const iv = Buffer.from(ivBase64, "base64");
  const encryptedWithTag = Buffer.from(encryptedBase64, "base64");

  const authTag = encryptedWithTag.subarray(encryptedWithTag.length - AUTH_TAG_LENGTH);
  const encrypted = encryptedWithTag.subarray(0, encryptedWithTag.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}
