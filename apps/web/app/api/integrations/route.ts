import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../lib/server/http";
import { encryptSecret } from "../../../lib/server/secrets";
import { userContext } from "../../../lib/server/supabase";
import { assertPublicHttps } from "../../../lib/server/safe-fetch";

const select = "id,provider,name,base_url,status,metadata,last_tested_at,last_test_status,last_test_error,created_at,updated_at";
export async function GET(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const { data, error } = await context.database.from("integrations").select(select).order("updated_at", { ascending: false });
  return error ? apiError("INTEGRATIONS_READ_FAILED", error.message, 500) : NextResponse.json({ integrations: data });
}
export async function POST(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request); const provider = body?.provider; const name = String(body?.name ?? "").trim();
  const baseUrl = String(body?.baseUrl ?? "").replace(/\/+$/, "");
  if (!["n8n", "home_assistant", "immich"].includes(String(provider)) || !name) return apiError("INVALID_INTEGRATION", "Provider und Name sind erforderlich");
  if (provider === "immich" && (!body?.credentials || typeof body.credentials !== "object" || !String((body.credentials as Record<string, unknown>).apiKey ?? "").trim())) return apiError("INVALID_CREDENTIALS", "Für Immich ist ein API-Key erforderlich");
  try { await assertPublicHttps(baseUrl); } catch (error) { return apiError("UNSAFE_BASE_URL", error instanceof Error ? error.message : "Unsichere Adresse"); }
  const encrypted: Partial<ReturnType<typeof encryptSecret>> = body?.credentials && typeof body.credentials === "object" ? encryptSecret(JSON.stringify(body.credentials)) : {};
  const { data, error } = await context.database.from("integrations").insert({
    owner_id: context.user.id, provider, name, base_url: baseUrl, metadata: body?.metadata ?? {},
  }).select(select).single();
  if (error || !data) return apiError("INTEGRATION_CREATE_FAILED", error?.message ?? "Integration konnte nicht angelegt werden", 409);
  if (encrypted.ciphertext && encrypted.iv && encrypted.auth_tag) {
    const { error: credentialError } = await context.database.from("integration_credentials").insert({ integration_id: data.id, owner_id: context.user.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag });
    if (credentialError) { await context.database.from("integrations").delete().eq("id", data.id); return apiError("CREDENTIAL_CREATE_FAILED", "Credentials konnten nicht verschlüsselt gespeichert werden", 500); }
  }
  return NextResponse.json(data, { status: 201 });
}
