import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { parseDashboardDocument } from "../../../../../lib/server/document";
import { apiError, jsonBody } from "../../../../../lib/server/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { data } = await found.context.database.from("display_drafts").select("document, updated_at").eq("display_id", found.display.id).maybeSingle();
  return data?.document ? NextResponse.json({ id: found.display.public_id, document: data.document, updatedAt: data.updated_at }) : apiError("LEGACY_DRAFT", "Dieser alte Entwurf verwendet ein nicht mehr unterstütztes Format", 409);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const body = await jsonBody(request); let document; try { document = parseDashboardDocument(body?.document); } catch (e) { return apiError("INVALID_DOCUMENT", (e as Error).message); }
  const { error } = await found.context.database.from("display_drafts").upsert({ display_id: found.display.id, document, envelope: null, updated_at: new Date().toISOString() });
  if (!error) await found.context.database.from("displays").update({ updated_at: new Date().toISOString(), name: String(body?.name ?? found.display.name).slice(0,160) }).eq("id", found.display.id);
  return error ? apiError("SAVE_FAILED", "Entwurf konnte nicht gespeichert werden", 500) : new NextResponse(null, { status: 204 });
}
