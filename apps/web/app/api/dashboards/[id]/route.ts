import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../../lib/server/http";
import { ownedDisplay } from "../../../../lib/server/display";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  return NextResponse.json({ dashboard: { id: found.display.public_id, name: found.display.name, activeVersion: found.display.active_version, createdAt: found.display.created_at, updatedAt: found.display.updated_at } });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const body = await jsonBody(request); const name = String(body?.name ?? "").trim(); if (!name || name.length > 160) return apiError("INVALID_NAME", "Name ist ungültig");
  const { error } = await found.context.database.from("displays").update({ name, updated_at: new Date().toISOString() }).eq("id", found.display.id);
  return error ? apiError("UPDATE_FAILED", "Dashboard konnte nicht aktualisiert werden", 500) : NextResponse.json({ ok: true });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { error } = await found.context.database.from("displays").delete().eq("id", found.display.id);
  return error ? apiError("DELETE_FAILED", "Dashboard konnte nicht gelöscht werden", 500) : new NextResponse(null, { status: 204 });
}
