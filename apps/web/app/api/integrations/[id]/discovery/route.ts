import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../../lib/server/http";
import { discoverIntegration, ownedIntegration } from "../../../../../lib/server/integrations";
import { userContext } from "../../../../../lib/server/supabase";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const row = await ownedIntegration(context.database, context.user.id, (await params).id); if (!row || row.status !== "active") return apiError("NOT_FOUND", "Aktive Integration nicht gefunden", 404);
  try { return NextResponse.json({ resource: request.nextUrl.searchParams.get("resource"), data: await discoverIntegration(row, request.nextUrl.searchParams.get("resource") ?? "") }); }
  catch (error) { return apiError("DISCOVERY_FAILED", error instanceof Error ? error.message : "Discovery fehlgeschlagen", 502); }
}
