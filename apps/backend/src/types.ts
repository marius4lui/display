export interface EncryptedEnvelope {
  schemaVersion: number;
  encryptionVersion: number;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  contentHash: string;
  byteSize: number;
}

export function parseEnvelope(value: unknown): EncryptedEnvelope {
  if (!value || typeof value !== "object") throw new Error("Envelope fehlt");
  const item = value as Record<string, unknown>;
  const requiredStrings = ["salt", "iv", "ciphertext", "contentHash"] as const;
  for (const key of requiredStrings) {
    if (typeof item[key] !== "string" || item[key].length === 0) throw new Error(`${key} ist ungültig`);
  }
  if (item.kdf !== "PBKDF2-SHA256") throw new Error("KDF wird nicht unterstützt");
  for (const key of ["schemaVersion", "encryptionVersion", "iterations", "byteSize"] as const) {
    if (!Number.isInteger(item[key]) || Number(item[key]) < 1) throw new Error(`${key} ist ungültig`);
  }
  if (Number(item.iterations) < 200_000) throw new Error("KDF-Iterationszahl ist zu niedrig");
  if (!/^[a-f0-9]{64}$/i.test(String(item.contentHash))) throw new Error("contentHash ist ungültig");
  return item as unknown as EncryptedEnvelope;
}
