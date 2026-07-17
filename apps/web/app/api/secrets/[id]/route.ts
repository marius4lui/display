import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../lib/server/http";
import { userContext } from "../../../../lib/server/supabase";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const { error } = await context.database.from("secrets").delete().eq("id", (await params).id);
  return error ? apiError("DELETE_FAILED", "Secret konnte nicht gelöscht werden", 500) : new NextResponse(null, { status: 204 });
}
