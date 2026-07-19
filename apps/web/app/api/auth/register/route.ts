import { NextResponse } from "next/server";
import { apiError, jsonBody, setSessionCookies } from "../../../../lib/server/http";
import { authClient } from "../../../../lib/server/supabase";
import { localAuthEnabled } from "../../../../lib/server/auth-config";

export async function POST(request: Request) {
  if (!localAuthEnabled()) return apiError("LOCAL_AUTH_DISABLED", "Lokale Registrierung ist deaktiviert", 403);
  const body = await jsonBody(request); const email = String(body?.email ?? "").trim().toLowerCase(); const password = String(body?.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return apiError("INVALID_CREDENTIALS", "Gültige E-Mail und Passwort mit mindestens 10 Zeichen erforderlich");
  const { data, error } = await authClient().auth.signUp({ email, password });
  if (error || !data.user) return apiError("REGISTER_FAILED", error?.message ?? "Registrierung fehlgeschlagen", 409);
  if (!data.session) return apiError("EMAIL_CONFIRMATION_ENABLED", "E-Mail-Bestätigung muss in Supabase deaktiviert sein", 503);
  return setSessionCookies(NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { status: 201 }), data.session);
}
