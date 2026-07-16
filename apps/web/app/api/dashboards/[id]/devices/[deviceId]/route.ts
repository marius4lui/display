import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../../lib/server/display";
import { apiError } from "../../../../../../lib/server/http";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; deviceId: string }> }) {
  const values = await params; const found = await ownedDisplay(request, values.id); if (found.error) return found.error;
  const { error } = await found.context.database.from("display_devices").update({ revoked_at: new Date().toISOString() }).eq("id", values.deviceId).eq("display_id", found.display.id);
  return error ? apiError("REVOKE_FAILED", "Gerät konnte nicht widerrufen werden", 500) : new NextResponse(null, { status: 204 });
}
