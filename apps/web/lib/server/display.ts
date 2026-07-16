import type { NextRequest } from "next/server";
import { apiError } from "./http";
import { userContext } from "./supabase";

export async function ownedDisplay(request: NextRequest, id: string) {
  const context = await userContext(request);
  if (!context) return { error: apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401) };
  const { data, error } = await context.database.from("displays").select("id, public_id, name, active_version, created_at, updated_at").eq("public_id", id).maybeSingle();
  if (error || !data) return { error: apiError("NOT_FOUND", "Dashboard nicht gefunden", 404) };
  return { context, display: data };
}
