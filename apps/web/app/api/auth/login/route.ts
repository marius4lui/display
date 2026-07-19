import { NextResponse } from "next/server";
import { apiError, jsonBody, setSessionCookies } from "../../../../lib/server/http";
import { authClient } from "../../../../lib/server/supabase";
import { localAuthEnabled } from "../../../../lib/server/auth-config";

export async function POST(request: Request) {
  if (!localAuthEnabled()) return apiError("LOCAL_AUTH_DISABLED", "Lokale Anmeldung ist deaktiviert", 403);
  const body = await jsonBody(request); const email = String(body?.email ?? "").trim().toLowerCase(); const password = String(body?.password ?? "");
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return apiError("INVALID_CREDENTIALS", "Anmeldedaten sind ungültig", 401);
  return setSessionCookies(NextResponse.json({ user: { id: data.user.id, email: data.user.email } }), data.session);
}
