import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError, jsonBody, randomToken, sha256 } from "../../../../../lib/server/http";
import { publicUrl } from "../../../../../lib/server/public-url";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const body = await jsonBody(request); const state = String(body?.state ?? "");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) return apiError("INVALID_STATE", "Verbindungsanfrage ist ungültig");
  const token = randomToken();
  const { data: device, error } = await found.context.database.from("display_devices").insert({ display_id: found.display.id, name: "Android Browser-Login", token_hash: sha256(token) }).select("id").single();
  if (error || !device) return apiError("CONNECT_FAILED", "Gerät konnte nicht freigegeben werden", 500);
  const displayUrl = publicUrl(request, `/d/${found.display.public_id}`);
  const deepLink = new URL("display://paired");
  deepLink.searchParams.set("state", state); deepLink.searchParams.set("url", displayUrl); deepLink.searchParams.set("token", token);
  return NextResponse.json({ deepLink: deepLink.toString() });
}
