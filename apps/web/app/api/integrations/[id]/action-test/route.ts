import { NextRequest, NextResponse } from "next/server";
import type { DashboardAction } from "../../../../../lib/dashboard";
import { apiError, jsonBody } from "../../../../../lib/server/http";
import { executeIntegrationAction, ownedIntegration } from "../../../../../lib/server/integrations";
import { userContext } from "../../../../../lib/server/supabase";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const integration = await ownedIntegration(context.database, context.user.id, (await params).id);
  if (!integration || integration.status !== "active") return apiError("INTEGRATION_UNAVAILABLE", "Aktive Integration nicht gefunden", 404);
  const body = await jsonBody(request); const action = body?.action as unknown as DashboardAction;
  if (!action || action.integrationId !== integration.id || action.provider !== integration.provider) return apiError("INVALID_ACTION", "Aktion passt nicht zur Integration");
  try {
    const result = await executeIntegrationAction(integration, { ...action, timeoutMs: Math.min(action.timeoutMs ?? 20_000, 20_000) }, { studioTest: true, timestamp: new Date().toISOString() });
    return NextResponse.json({ status: "success", httpStatus: result.status, value: result.value });
  } catch (error) { return apiError("ACTION_TEST_FAILED", error instanceof Error ? error.message : "Aktion fehlgeschlagen", 502); }
}
