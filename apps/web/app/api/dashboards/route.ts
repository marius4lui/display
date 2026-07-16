import { NextRequest, NextResponse } from "next/server";
import { parseEnvelope } from "../../../lib/server/envelope";
import { apiError, jsonBody, publicId } from "../../../lib/server/http";
import { publicUrl } from "../../../lib/server/public-url";
import { userContext } from "../../../lib/server/supabase";

export async function GET(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const { data, error } = await context.database.from("displays").select("public_id, name, active_version, created_at, updated_at").order("updated_at", { ascending: false });
  if (error) return apiError("DATABASE_ERROR", "Displays konnten nicht geladen werden", 500);
  return NextResponse.json({ dashboards: (data ?? []).map(d => ({ id: d.public_id, name: d.name, activeVersion: d.active_version, createdAt: d.created_at, updatedAt: d.updated_at })) });
}

export async function POST(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request); let envelope; try { envelope = parseEnvelope(body?.envelope); } catch (e) { return apiError("INVALID_ENVELOPE", (e as Error).message); }
  const name = String(body?.name ?? "Mein Dashboard").trim().slice(0, 160) || "Mein Dashboard"; const id = publicId();
  const { data: display, error } = await context.database.from("displays").insert({ public_id: id, owner_id: context.user.id, name }).select("id").single();
  if (error || !display) return apiError("CREATE_FAILED", "Dashboard konnte nicht erstellt werden", 500);
  const draft = await context.database.from("display_drafts").insert({ display_id: display.id, envelope });
  if (draft.error) { await context.database.from("displays").delete().eq("id", display.id); return apiError("CREATE_FAILED", "Entwurf konnte nicht erstellt werden", 500); }
  return NextResponse.json({ id, displayUrl: publicUrl(request, `/d/${id}`) }, { status: 201 });
}
