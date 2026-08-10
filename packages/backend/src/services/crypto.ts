import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) return scryptSync(envKey, "sonect-salt", 32);

  const keyPath = process.env.ENCRYPTION_KEY_FILE ?? "./data/encryption.key";
  if (existsSync(keyPath)) {
    return Buffer.from(readFileSync(keyPath, "utf-8"), "hex");
  }

  const key = randomBytes(32);
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(encrypted: string): string | null {
  try {
    const key = getKey();
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const data = Buffer.from(parts[2], "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return (
      decipher.update(data, undefined as any, "utf-8") + decipher.final("utf-8")
    );
  } catch {
    return null;
  }
}
