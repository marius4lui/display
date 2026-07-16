"use client";
import { useEffect, useState, type FormEvent } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email?: string } | null>(null); const [loading, setLoading] = useState(true); const [register, setRegister] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/auth/session").then(async r => { if (r.ok) setUser((await r.json()).user); }).finally(() => setLoading(false)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const result = await response.json(); if (!response.ok) return setError(result.error?.message ?? "Anmeldung fehlgeschlagen"); setUser(result.user);
  }
  if (loading) return <main className="auth-screen"><p>Session wird geprüft …</p></main>;
  if (!user) return <main className="auth-screen"><form className="auth-card" onSubmit={submit}><div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Dashboard Studio</small></div></div><h1>{register ? "Account erstellen" : "Anmelden"}</h1><p>Für das Dashboard Studio ist ein Account erforderlich.</p><input name="email" type="email" required placeholder="E-Mail" autoComplete="email"/><input name="password" type="password" required minLength={10} placeholder="Passwort (min. 10 Zeichen)" autoComplete={register ? "new-password" : "current-password"}/>{error && <div className="notice error">{error}</div>}<button className="button primary" type="submit">{register ? "Registrieren" : "Anmelden"}</button><button className="text-button" type="button" onClick={() => { setRegister(v => !v); setError(""); }}>{register ? "Schon registriert? Anmelden" : "Noch kein Account? Registrieren"}</button></form></main>;
  return <><div className="account-strip"><span>{user.email}</span><button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}>Abmelden</button></div>{children}</>;
}
