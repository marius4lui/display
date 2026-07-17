import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../lib/server/http";
import { userContext } from "../../../lib/server/supabase";
import { encryptSecret } from "../../../lib/server/secrets";

export async function GET(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const { data, error } = await context.database.from("secrets").select("id,name,created_at,updated_at").order("name");
  return error ? apiError("DATABASE_ERROR", "Secrets konnten nicht geladen werden", 500) : NextResponse.json({ secrets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request); const name = String(body?.name ?? ""); const value = String(body?.value ?? "");
  if (!/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(name) || !value) return apiError("INVALID_SECRET", "Name oder Wert ist ungültig");
  const encrypted = encryptSecret(value);
  const { data, error } = await context.database.from("secrets").upsert({ owner_id: context.user.id, name, ...encrypted, updated_at: new Date().toISOString() }, { onConflict: "owner_id,name" }).select("id,name,created_at,updated_at").single();
  return error ? apiError("SAVE_FAILED", "Secret konnte nicht gespeichert werden", 500) : NextResponse.json({ secret: data }, { status: 201 });
}

