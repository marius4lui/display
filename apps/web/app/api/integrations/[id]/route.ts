import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../../lib/server/http";
import { encryptSecret } from "../../../../lib/server/secrets";
import { userContext } from "../../../../lib/server/supabase";
import { assertPublicHttps } from "../../../../lib/server/safe-fetch";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request); if (!body) return apiError("INVALID_BODY", "Ungültige Anfrage");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.status === "string" && ["pending","active","error","disabled"].includes(body.status)) update.status = body.status;
  if (typeof body.baseUrl === "string") { try { await assertPublicHttps(body.baseUrl); update.base_url = body.baseUrl.replace(/\/+$/, ""); } catch (error) { return apiError("UNSAFE_BASE_URL", error instanceof Error ? error.message : "Unsichere Adresse"); } }
  if (body.metadata && typeof body.metadata === "object") update.metadata = body.metadata;
  if (body.credentials && typeof body.credentials === "object") {
    const encrypted = encryptSecret(JSON.stringify(body.credentials));
    const { error } = await context.database.from("integration_credentials").upsert({ integration_id: (await params).id, owner_id: context.user.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag, updated_at: new Date().toISOString() });
    if (error) return apiError("CREDENTIAL_UPDATE_FAILED", "Credentials konnten nicht gespeichert werden", 409);
  }
  const { data, error } = await context.database.from("integrations").update(update).eq("id", (await params).id).select("id,provider,name,base_url,status,metadata,last_tested_at,last_test_status,last_test_error").maybeSingle();
  return error || !data ? apiError("INTEGRATION_UPDATE_FAILED", error?.message ?? "Integration nicht gefunden", error ? 409 : 404) : NextResponse.json(data);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const { error, count } = await context.database.from("integrations").delete({ count: "exact" }).eq("id", (await params).id);
  return error || !count ? apiError("INTEGRATION_DELETE_FAILED", error?.message ?? "Integration nicht gefunden", error ? 409 : 404) : new NextResponse(null, { status: 204 });
}
