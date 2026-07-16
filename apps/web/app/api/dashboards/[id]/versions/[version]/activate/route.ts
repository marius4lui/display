import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../../../lib/server/display";
import { apiError } from "../../../../../../../lib/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const values = await params; const found = await ownedDisplay(request, values.id); if (found.error) return found.error;
  const version = Number(values.version); if (!Number.isInteger(version) || version < 1) return apiError("INVALID_VERSION", "Version ist ungültig");
  const { error } = await found.context.database.rpc("activate_display_version", { target_display: found.display.id, target_version: version });
  return error ? apiError("NOT_FOUND", "Version nicht gefunden", 404) : new NextResponse(null, { status: 204 });
}
