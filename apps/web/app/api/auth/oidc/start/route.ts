import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { oidcEnabled } from "../../../../../lib/server/auth-config";
import { randomToken } from "../../../../../lib/server/http";
import { discoverOidc, oidcClientId, oidcRedirectUri } from "../../../../../lib/server/oidc";

export async function GET(request: NextRequest) {
  if (!oidcEnabled()) return NextResponse.json({ error: { code: "OIDC_DISABLED", message: "OIDC ist nicht konfiguriert" } }, { status: 404 });
  try {
    const discovery = await discoverOidc(); const state = randomToken(); const nonce = randomToken(); const verifier = randomToken(64);
    const authorization = new URL(discovery.authorization_endpoint);
    for (const [key, value] of Object.entries({ client_id: oidcClientId(), redirect_uri: oidcRedirectUri(request.url), response_type: "code", scope: "openid profile email", state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })) authorization.searchParams.set(key, value);
    const response = NextResponse.redirect(authorization);
    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/api/auth/oidc/callback", maxAge: 600 };
    response.cookies.set("display-oidc-state", state, options); response.cookies.set("display-oidc-nonce", nonce, options); response.cookies.set("display-oidc-verifier", verifier, options);
    return response;
  } catch (error) {
    console.error("OIDC authorization failed", error);
    return NextResponse.redirect(new URL("/?auth_error=oidc_unavailable", process.env.PUBLIC_APP_URL?.trim() || request.url));
  }
}
