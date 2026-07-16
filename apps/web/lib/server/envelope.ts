export interface EncryptedEnvelope {
  schemaVersion: number; encryptionVersion: number; kdf: "PBKDF2-SHA256"; iterations: number;
  salt: string; iv: string; ciphertext: string; contentHash: string; byteSize: number;
}

export function parseEnvelope(value: unknown): EncryptedEnvelope {
  if (!value || typeof value !== "object") throw new Error("Envelope fehlt");
  const item = value as Record<string, unknown>;
  for (const key of ["salt", "iv", "ciphertext", "contentHash"])
    if (typeof item[key] !== "string" || !item[key]) throw new Error(`${key} ist ungültig`);
  if (item.kdf !== "PBKDF2-SHA256") throw new Error("KDF wird nicht unterstützt");
  for (const key of ["schemaVersion", "encryptionVersion", "iterations", "byteSize"])
    if (!Number.isInteger(item[key]) || Number(item[key]) < 1) throw new Error(`${key} ist ungültig`);
  if (Number(item.iterations) < 200_000) throw new Error("KDF-Iterationszahl ist zu niedrig");
  if (Number(item.byteSize) > 12 * 1024 * 1024) throw new Error("Envelope ist zu groß");
  if (!/^[a-f0-9]{64}$/i.test(String(item.contentHash))) throw new Error("contentHash ist ungültig");
  return item as unknown as EncryptedEnvelope;
}
