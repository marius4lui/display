import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../../lib/server/http";
import { ownedIntegration, testIntegration } from "../../../../../lib/server/integrations";
import { userContext } from "../../../../../lib/server/supabase";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const row = await ownedIntegration(context.database, context.user.id, (await params).id); if (!row) return apiError("NOT_FOUND", "Integration nicht gefunden", 404);
  try {
    const metadata = await testIntegration(row); const now = new Date().toISOString();
    await context.database.from("integrations").update({ status: "active", last_tested_at: now, last_test_status: "success", last_test_error: null, metadata: { ...row.metadata, ...metadata } }).eq("id", row.id);
    return NextResponse.json({ status: "success", testedAt: now, metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verbindung fehlgeschlagen"; const now = new Date().toISOString();
    await context.database.from("integrations").update({ status: "error", last_tested_at: now, last_test_status: "failed", last_test_error: message }).eq("id", row.id);
    return apiError("CONNECTION_FAILED", message, 502);
  }
}
