# display

`display` erstellt verschlüsselte, lokal gerenderte Android-Dashboards. Der Next.js-Builder veröffentlicht nur Ciphertext; URL und PIN/Passphrase werden einmalig im Android-Client eingetragen. API-Aufrufe laufen anschließend direkt auf dem Gerät und können daher auch Dienste im lokalen Netzwerk erreichen.

## Enthalten

- Visueller Landscape-Builder mit 12×8-Raster, Live-Preview, Text, Bild, Uhr, API-Wert und Wetter
- REST-Datenquellen mit allen üblichen Methoden, Headern, JSON-Body, API-Key, Bearer und Basic Auth
- JSON-Pfad-Mapping, Zahlen-/Datumsformatierung, Animationen und Fehlerstrategien
- Mitgelieferte und eigene Templates; eigene Templates übernehmen keine Credentials
- Ende-zu-Ende-verschlüsselte Entwürfe und unveränderliche Veröffentlichungen
- Stabile Client-URL, ETag-basierte Versionsprüfung, Versionsverlauf und Rollback-API
- Anonyme Bearbeitungstokens sowie Konto-, Session- und Claim-API
- Android-Renderer mit Keystore, Offline-Cache, globalem/lokalem Polling und letztem gültigen Stand
- Gemeinsamer Managed-/Self-hosted-Kern über Docker Compose

## Lokal entwickeln

Voraussetzungen sind Node.js 22+, Docker sowie für Android JDK 17 und Android SDK 35.

```bash
cp .env.example .env
kmc run display.install
kmc run display.database
kmc run display.dev
```

Builder: `http://localhost:3000`

Backend: `http://localhost:3001`

Healthcheck: `http://localhost:3001/health`

Falls Port 3306 bereits belegt ist, in `.env` beispielsweise `MYSQL_PORT=3307` setzen und `DATABASE_URL` entsprechend anpassen.

## Self-hosting

```bash
cp .env.example .env
docker compose up -d --build
```

Für Produktion müssen mindestens Datenbankpasswörter, `PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL` und `CORS_ORIGIN` angepasst sowie TLS vor Web und Backend geschaltet werden. `NEXT_PUBLIC_API_URL` ist eine Build-Time-Variable; nach einer Änderung muss das Web-Image neu gebaut werden.

MySQL führt `packages/database/migrations/001_initial.sql` nur beim ersten Erstellen des Volumes aus. Bei einem bereits vorhandenen Entwicklungsvolume ist ein bewusster Reset mit `docker compose down -v` nötig; dabei werden alle lokalen Daten gelöscht.

## Ablauf

1. Dashboard gestalten und eine mindestens acht Zeichen lange PIN/Passphrase setzen.
2. Entwurf speichern oder veröffentlichen. Der Browser verschlüsselt das Dokument per AES-256-GCM; der Server erhält nur Ciphertext und technische Versionsdaten.
3. Die angezeigte `/d/{id}`-URL und dieselbe Passphrase in Android eintragen.
4. Android entschlüsselt lokal, speichert die Passphrase Keystore-geschützt und behält die letzte gültige Konfiguration offline.

Es gibt keine PIN-Wiederherstellung. Ohne die aktuelle Passphrase kann der Inhalt nicht entschlüsselt werden. Kurze oder leicht erratbare Geheimnisse bleiben trotz PBKDF2 anfällig für Offline-Versuche.

## API-Kern

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/dashboards` | Verschlüsselten Entwurf anlegen |
| `GET/PUT` | `/api/dashboards/:id/draft` | Entwurf mit `X-Edit-Token` lesen/speichern |
| `POST` | `/api/dashboards/:id/publish` | Unveränderliche Version veröffentlichen |
| `GET` | `/d/:id` | Aktive Version öffentlich als Ciphertext abrufen |
| `GET` | `/api/dashboards/:id/versions` | Versionsverlauf abrufen |
| `POST` | `/api/dashboards/:id/versions/:version/activate` | Rollback/Aktivierung |
| `POST` | `/api/auth/register`, `/api/auth/login` | Konten und 30-Tage-Sessions |
| `POST` | `/api/dashboards/:id/claim` | Anonymes Dashboard einem Konto zuordnen |

Kontoinhaber können statt `X-Edit-Token` ein `Authorization: Bearer …` verwenden. Secrets, Passphrases und Authorization-Header dürfen nicht protokolliert werden.

## Prüfungen

```bash
kmc run display.check
npm test
kmc run display.build
kmc run display.mobile
kmc run checks --dry-run
```

Der Android-Debug-Build liegt anschließend unter `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`.
