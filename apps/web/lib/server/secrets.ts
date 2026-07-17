import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type SecretRow = { ciphertext: string; iv: string; auth_tag: string };
const key = () => {
  const value = process.env.SECRET_STORE_MASTER_KEY ?? "";
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("SECRET_STORE_MASTER_KEY muss ein Base64-kodierter 32-Byte-Schlüssel sein");
  return decoded;
};

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(row: SecretRow) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

const token = /\{\{(secret|var)\.([A-Za-z][A-Za-z0-9_]{1,63})\}\}/g;
export async function resolveTemplate(input: string, ownerId: string, variables: Record<string, string>, database: SupabaseClient) {
  const names = [...input.matchAll(token)].filter((item) => item[1] === "secret").map((item) => item[2]);
  const secrets = new Map<string, string>();
  if (names.length) {
    const { data, error } = await database.from("secrets").select("name,ciphertext,iv,auth_tag").eq("owner_id", ownerId).in("name", [...new Set(names)]);
    if (error) throw new Error("Secrets konnten nicht geladen werden");
    for (const row of data ?? []) secrets.set(row.name, decryptSecret(row));
  }
  return input.replace(token, (_, kind: string, name: string) => {
    const value = kind === "secret" ? secrets.get(name) : variables[name];
    if (value === undefined) throw new Error(`${kind === "secret" ? "Secret" : "Variable"} ${name} fehlt`);
    return value;
  });
}

