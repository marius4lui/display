import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../../lib/server/http";
import { ownedIntegration } from "../../../../../lib/server/integrations";
import { parseOauthState } from "../../../../../lib/server/oauth-state";
import { limitedResponse, safeFetch } from "../../../../../lib/server/safe-fetch";
import { encryptSecret } from "../../../../../lib/server/secrets";
import { userContext } from "../../../../../lib/server/supabase";
export async function GET(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const state = parseOauthState(request.nextUrl.searchParams.get("state") ?? "");
  const code = request.nextUrl.searchParams.get("code");
  if (!state || state.ownerId !== context.user.id || !code) return apiError("INVALID_OAUTH_CALLBACK", "OAuth-Rückgabe ist ungültig", 400);
  const row = await ownedIntegration(context.database, context.user.id, state.integrationId);
  if (!row || row.provider !== "home_assistant") return apiError("NOT_FOUND", "Integration nicht gefunden", 404);
  const redirectUri = new URL("/api/integrations/oauth/callback", process.env.PUBLIC_APP_URL ?? request.url).toString();
  const form = new URLSearchParams({ grant_type: "authorization_code", code, client_id: new URL(process.env.PUBLIC_APP_URL ?? request.url).origin, redirect_uri: redirectUri });
  try {
    const response = await safeFetch(`${row.base_url}/auth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, expectedOrigin: new URL(row.base_url).origin });
    const { text } = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const token = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number };
    const encrypted = encryptSecret(JSON.stringify({ accessToken: token.access_token, refreshToken: token.refresh_token, tokenExpiresAt: token.expires_in ? new Date(Date.now()+token.expires_in*1000).toISOString() : undefined }));
    await context.database.from("integration_credentials").upsert({ integration_id: row.id, owner_id: context.user.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag, updated_at: new Date().toISOString() });
    await context.database.from("integrations").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", row.id);
    return NextResponse.redirect(new URL("/?integration=connected", process.env.PUBLIC_APP_URL ?? request.url));
  } catch (error) { return apiError("OAUTH_EXCHANGE_FAILED", error instanceof Error ? error.message : "Token-Austausch fehlgeschlagen", 502); }
}
