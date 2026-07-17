import { NextRequest, NextResponse } from "next/server";
import { apiError, sha256 } from "../../../../lib/server/http";
import { adminClient } from "../../../../lib/server/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const database = adminClient(); const publicId = (await params).id;
  const { data: display } = await database.from("displays").select("id").eq("public_id", publicId).maybeSingle();
  if (!display) return apiError("NOT_FOUND", "Dashboard nicht gefunden", 404);
  const { data: device } = await database.from("display_devices").select("id").eq("display_id", display.id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null).maybeSingle();
  if (!device) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const since = new Date(Date.now() - Math.min(7, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 1))) * 86400_000).toISOString();
  const [{ data: runtime }, { data: samples }] = await Promise.all([
    database.from("data_source_runtime").select("source_id,value,checked_at,succeeded_at,error").eq("display_id", display.id),
    database.from("data_source_samples").select("source_id,sampled_at,value").eq("display_id", display.id).gte("sampled_at", since).order("sampled_at"),
  ]);
  return NextResponse.json({ runtime: runtime ?? [], samples: samples ?? [] });
}

