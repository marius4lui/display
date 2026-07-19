import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../../lib/server/http";
import { ownedIntegration } from "../../../../../lib/server/integrations";
import { oauthState } from "../../../../../lib/server/oauth-state";
import { userContext } from "../../../../../lib/server/supabase";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const row = await ownedIntegration(context.database, context.user.id, (await params).id);
  if (!row || row.provider !== "home_assistant") return apiError("NOT_FOUND", "Home-Assistant-Integration nicht gefunden", 404);
  const redirectUri = new URL("/api/integrations/oauth/callback", process.env.PUBLIC_APP_URL ?? request.url).toString();
  const url = new URL("/auth/authorize", row.base_url);
  url.searchParams.set("client_id", new URL(process.env.PUBLIC_APP_URL ?? request.url).origin);
  url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("state", oauthState(row.id, context.user.id));
  return NextResponse.json({ authorizationUrl: url.toString() });
}
