import { createHmac, timingSafeEqual } from "node:crypto";
const secret = () => process.env.SECRET_STORE_MASTER_KEY ?? "";
export function oauthState(integrationId: string, ownerId: string) {
  const payload = Buffer.from(JSON.stringify({ integrationId, ownerId, expires: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function parseOauthState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { integrationId: string; ownerId: string; expires: number };
  return parsed.expires > Date.now() ? parsed : null;
}
