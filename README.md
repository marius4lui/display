# display

`display` erstellt Android-Dashboards. Next.js liefert Studio und API; eine selbst gehostete Supabase-Instanz übernimmt PostgreSQL und E-Mail/Passwort-Accounts. Ein separater Backend-Dienst und MySQL werden nicht benötigt.

Das Studio speichert Dashboard-Dokumente direkt in Supabase. Android führt konfigurierte Datenquellen auf dem Gerät aus und hält den letzten gültigen Stand offline. Der Zugriff auf Studio und Gerätefreigabe wird über Account-Sessions und widerrufbare Geräte-Tokens geschützt.

## Voraussetzungen

- Node.js 22+
- Docker
- Supabase CLI
- Für Android: JDK 17 und Android SDK 35

## Lokal entwickeln

```bash
cp .env.example .env.local
npm install
npm run supabase:start
```

Die vom CLI ausgegebenen `API URL`, `anon key` und `service_role key` in `.env.local` eintragen. Danach:

```bash
npm run supabase:reset
npm run dev
```

Studio und API laufen unter `http://localhost:3000`. Supabase Studio läuft standardmäßig unter `http://localhost:54323`.

## Ablauf

1. Account mit E-Mail und mindestens zehn Zeichen langem Passwort erstellen. In der vorgesehenen Self-hosted-Konfiguration ist keine E-Mail-Bestätigung nötig.
2. Dashboard gestalten, speichern und veröffentlichen.
3. In Android nur die `/d/{id}`-URL eingeben und **Im Browser anmelden** wählen.
4. Im Browser mit dem Besitzer-Account anmelden; die Freigabe führt automatisch zurück zur App.
5. Falls Browser oder Rückleitung nicht funktionieren, unter **Setup → Fallback-Code erzeugen** einen sechsstelligen, zehn Minuten gültigen Einmalcode erstellen und in Android eingeben.
6. Android speichert den Geräte-Token Keystore-geschützt. Die Freigabe kann im Account widerrufen werden.

## Self-hosting

Für Produktion wird die [offizielle selbst gehostete Supabase-Distribution](https://supabase.com/docs/guides/self-hosting/docker) separat betrieben. Vor dem Start der Web-Anwendung müssen die SQL-Migrationen aus `supabase/migrations` angewendet und E-Mail-Bestätigungen in GoTrue deaktiviert werden.

Die Web-Anwendung benötigt ausschließlich:

```dotenv
SUPABASE_URL=https://supabase.example.org
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PUBLIC_APP_URL=https://display.example.org
WEB_PORT=3000
```

`SUPABASE_SERVICE_ROLE_KEY` ist ausschließlich serverseitig erlaubt. `PUBLIC_APP_URL` ist die von Geräten und Browsern erreichbare öffentliche Basis-URL der Web-Anwendung; sie verhindert interne Hostnamen in erzeugten Display- und Asset-URLs. TLS ist vor Next.js und Supabase Pflicht. `docker compose up -d --build` startet nur die Web-Anwendung und verbindet sie mit der bereits laufenden Supabase-Installation.

## API-Kern

Account-Routen verwenden sichere HttpOnly-Session-Cookies. Geräte verwenden ein widerrufbares Bearer-Token.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Account und Session |
| `GET/POST` | `/api/dashboards` | Eigene Displays auflisten/anlegen |
| `GET/PUT` | `/api/dashboards/{id}/draft` | Entwurf lesen/speichern |
| `POST` | `/api/dashboards/{id}/publish` | Unveränderliche Version veröffentlichen |
| `GET` | `/api/dashboards/{id}/versions` | Versionsverlauf |
| `POST` | `/api/dashboards/{id}/versions/{version}/activate` | Version aktivieren |
| `POST` | `/api/dashboards/{id}/pairings` | Einmaligen Pairing-Code erzeugen |
| `POST` | `/api/device/pair` | Pairing-Code gegen Geräte-Token tauschen |
| `GET` | `/d/{id}` | Aktive Version mit Geräte-Token und ETag abrufen |

## Prüfungen

```bash
kmc validate
npm run check
npm run build
npm run mobile:build
```

Der Android-Debug-Build liegt unter `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`.
