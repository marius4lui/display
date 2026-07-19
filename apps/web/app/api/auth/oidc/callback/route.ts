import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { oidcEnabled, oidcSignupEnabled } from "../../../../../lib/server/auth-config";
import { setSessionCookies } from "../../../../../lib/server/http";
import { discoverOidc, oidcClientId, oidcClientSecret, oidcRedirectUri, verifyIdToken } from "../../../../../lib/server/oidc";
import { adminClient, authClient } from "../../../../../lib/server/supabase";

function equal(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function finish(request: NextRequest, error?: string) {
  const target = new URL("/", process.env.PUBLIC_APP_URL?.trim() || request.url); if (error) target.searchParams.set("auth_error", error);
  const response = NextResponse.redirect(target);
  for (const name of ["display-oidc-state", "display-oidc-nonce", "display-oidc-verifier"]) response.cookies.set(name, "", { path: "/api/auth/oidc/callback", maxAge: 0 });
  return response;
}
async function findUserByEmail(email: string) {
  const admin = adminClient();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email); if (match) return match; if (data.users.length < 1000) return null;
  }
  throw new Error("Supabase user lookup exceeded pagination limit");
}

export async function GET(request: NextRequest) {
  if (!oidcEnabled()) return finish(request, "oidc_disabled");
  const state = request.nextUrl.searchParams.get("state") ?? ""; const expectedState = request.cookies.get("display-oidc-state")?.value ?? ""; const nonce = request.cookies.get("display-oidc-nonce")?.value ?? ""; const verifier = request.cookies.get("display-oidc-verifier")?.value ?? ""; const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!state || !expectedState || !equal(state, expectedState) || !nonce || !verifier || !code) return finish(request, "invalid_oidc_response");
  try {
    const discovery = await discoverOidc();
    const tokenResponse = await fetch(discovery.token_endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${oidcClientId()}:${oidcClientSecret()}`).toString("base64")}` }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: oidcRedirectUri(request.url), code_verifier: verifier }), signal: AbortSignal.timeout(10_000) });
    if (!tokenResponse.ok) throw new Error(`OIDC token exchange failed (${tokenResponse.status})`);
    const tokens = await tokenResponse.json() as { id_token?: string }; if (!tokens.id_token) throw new Error("OIDC response has no ID token");
    const claims = await verifyIdToken(tokens.id_token, nonce); const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || claims.email_verified !== true) throw new Error("OIDC provider did not return a verified email address");
    let user = await findUserByEmail(email);
    if (!user) {
      if (!oidcSignupEnabled()) return finish(request, "account_not_found");
      const created = await adminClient().auth.admin.createUser({ email, email_confirm: true, user_metadata: { oidc_subject: claims.sub, oidc_issuer: claims.iss } });
      if (created.error) { user = await findUserByEmail(email); if (!user) throw created.error; } else user = created.data.user;
    }
    const link = await adminClient().auth.admin.generateLink({ type: "magiclink", email }); if (link.error) throw link.error;
    const verified = await authClient().auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); if (verified.error || !verified.data.session) throw verified.error ?? new Error("Supabase did not create a session");
    return setSessionCookies(finish(request), verified.data.session);
  } catch (error) { console.error("OIDC callback failed", error); return finish(request, "oidc_failed"); }
}
