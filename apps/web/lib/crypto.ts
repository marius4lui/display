export interface EncryptedEnvelope {
  schemaVersion: number;
  encryptionVersion: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  contentHash: string;
  byteSize: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptDocument(document: unknown, passphrase: string): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) throw new Error("Die PIN/Passphrase muss mindestens 8 Zeichen lang sein.");
  const plaintext = encoder.encode(JSON.stringify(document));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 310_000;
  const key = await deriveKey(passphrase, salt, iterations);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { schemaVersion: 1, encryptionVersion: 1, kdf: "PBKDF2-SHA256", iterations, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)), contentHash: toHex(await crypto.subtle.digest("SHA-256", encrypted)), byteSize: encrypted.byteLength };
}

export async function decryptDocument<T>(envelope: EncryptedEnvelope, passphrase: string): Promise<T> {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as T;
}
