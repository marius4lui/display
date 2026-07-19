import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
let cachedDiscovery: Promise<Discovery> | undefined;

function configuredIssuer() {
  const value = process.env.OIDC_ISSUER?.trim();
  if (!value) throw new Error("OIDC_ISSUER is not configured");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("OIDC_ISSUER must use HTTPS in production");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

export function oidcClientId() { const value = process.env.OIDC_CLIENT_ID?.trim(); if (!value) throw new Error("OIDC_CLIENT_ID is not configured"); return value; }
export function oidcClientSecret() { const value = process.env.OIDC_CLIENT_SECRET?.trim(); if (!value) throw new Error("OIDC_CLIENT_SECRET is not configured"); return value; }
export function oidcRedirectUri(requestUrl: string) { return new URL("/api/auth/oidc/callback", process.env.PUBLIC_APP_URL?.trim() || requestUrl).toString(); }

export function discoverOidc() {
  cachedDiscovery ??= (async () => {
    const issuer = configuredIssuer();
    const response = await fetch(new URL(".well-known/openid-configuration", issuer), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`OIDC discovery failed (${response.status})`);
    const value = await response.json() as Partial<Discovery>;
    if (value.issuer !== issuer.toString() && value.issuer !== issuer.toString().replace(/\/$/, "")) throw new Error("OIDC discovery returned an unexpected issuer");
    for (const key of ["authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
      if (!value[key]) throw new Error(`OIDC discovery is missing ${key}`);
      if (process.env.NODE_ENV === "production" && new URL(value[key]).protocol !== "https:") throw new Error(`OIDC ${key} must use HTTPS in production`);
    }
    return value as Discovery;
  })().catch((error) => { cachedDiscovery = undefined; throw error; });
  return cachedDiscovery;
}

export async function verifyIdToken(idToken: string, nonce: string): Promise<JWTPayload> {
  const discovery = await discoverOidc();
  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL(discovery.jwks_uri)), { issuer: discovery.issuer, audience: oidcClientId() });
  if (payload.nonce !== nonce) throw new Error("OIDC nonce does not match");
  return payload;
}
