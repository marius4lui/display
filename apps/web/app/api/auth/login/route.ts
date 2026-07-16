import { NextResponse } from "next/server";
import { apiError, jsonBody, setSessionCookies } from "../../../../lib/server/http";
import { authClient } from "../../../../lib/server/supabase";

export async function POST(request: Request) {
  const body = await jsonBody(request); const email = String(body?.email ?? "").trim().toLowerCase(); const password = String(body?.password ?? "");
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return apiError("INVALID_CREDENTIALS", "Anmeldedaten sind ungültig", 401);
  return setSessionCookies(NextResponse.json({ user: { id: data.user.id, email: data.user.email } }), data.session);
}
