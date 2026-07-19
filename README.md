# display

`display` erstellt Android- und Web-Dashboards. Next.js liefert Studio, Player und API; eine selbst gehostete Supabase-Instanz übernimmt PostgreSQL und E-Mail/Passwort-Accounts. Der Web-Player lädt Datenquellen über einen abgesicherten Next.js-Proxy, damit Zielsysteme kein Browser-CORS bereitstellen müssen.

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

Studio und API laufen unter `http://localhost:3000`, der Web-Player unter `http://display.localhost:3000`. Supabase Studio läuft standardmäßig unter `http://localhost:54323`.

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
PUBLIC_APP_URL=https://kmuc.app
PUBLIC_DISPLAY_URL=https://dis.bz3.eu
WEB_PORT=3000
SECRET_STORE_MASTER_KEY=...
COLLECTOR_TOKEN=...
```

`SUPABASE_SERVICE_ROLE_KEY` ist ausschließlich serverseitig erlaubt. `SECRET_STORE_MASTER_KEY` verschlüsselt API-Secrets mit AES-256-GCM und muss dauerhaft gesichert werden; `COLLECTOR_TOKEN` schützt den internen Collector-Aufruf. `PUBLIC_APP_URL` ist die öffentliche Studio- und Android-Basis-URL. `PUBLIC_DISPLAY_URL` ist der getrennte Web-Player-Host; in Produktion ist er `https://dis.bz3.eu`. TLS ist vor Next.js und Supabase Pflicht. `docker compose up -d --build` startet Web-Anwendung und Collector und verbindet sie mit der bereits laufenden Supabase-Installation.

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
| `POST` | `/api/player/pair` | Web-Browser per sechsstelligen Code koppeln |
| `GET` | `/api/player/config` | Aktive Version und bereinigte Datenquellen-Metadaten |
| `POST` | `/api/player/data/{sourceId}` | Veröffentlichte Datenquelle serverseitig abrufen |
| `POST` | `/api/player/heartbeat`, `/api/player/disconnect` | Web-Gerätestatus und Trennen |
| `GET` | `/d/{id}` | Aktive Version mit Geräte-Token und ETag abrufen |
| `GET` | `/d/{id}/runtime` | Aktuelle Werte und bis zu sieben Tage Historie |
| `POST` | `/d/{id}/heartbeat` | Geräteversion und Diagnosezustand melden |
| `GET/POST/DELETE` | `/api/secrets` | Write-only Secret Store verwalten |
| `GET/POST/PATCH/DELETE` | `/api/integrations` | n8n-/Home-Assistant-Integrationen verwalten |
| `POST/GET` | `/api/integrations/{id}/test`, `/discovery` | Verbindung und Provider-Ressourcen prüfen |
| `POST` | `/api/player/actions/{actionId}` | Veröffentlichte Geräteaktion idempotent ausführen |

Die Einrichtung und Sicherheitsanforderungen stehen in [docs/integrations.md](docs/integrations.md).

## Prüfungen

```bash
kmc validate
npm run check
npm run build
npm run mobile:build
```

Der Android-Debug-Build liegt unter `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`.
