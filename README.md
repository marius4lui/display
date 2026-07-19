# display

[![CI](https://github.com/marius4lui/display/actions/workflows/ci.yml/badge.svg)](https://github.com/marius4lui/display/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/marius4lui/display)](https://github.com/marius4lui/display/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-7c5cff.svg)](LICENSE)

Self-hosted Dashboard-Studio mit sicheren Web- und Android-Playern.

[Studio](https://display.qhrd.online) · [Web-Player / Preview](https://dis.bz3.eu) · [Neueste Android-App](https://dis.bz3.eu/download/android) · [Releases](https://github.com/marius4lui/display/releases)

## Was display kann

- Dashboards mit Rasterlayout, mehreren Seiten, Widgets, Regeln und Animationen erstellen
- Versionen unveränderlich veröffentlichen, aktivieren und zurückrollen
- Web- und Android-Geräte per kurzlebigem Einmalcode koppeln und zentral widerrufen
- HTTP-APIs, Home Assistant und n8n anbinden, ohne Secrets an den Web-Player auszuliefern
- Letzte Werte offline anzeigen und Gerätezustand über Heartbeats überwachen
- Android-Updates aus GitHub Releases empfehlen, direkt installieren oder als APK herunterladen

Studio und Player laufen in derselben Next.js-Anwendung, werden aber über getrennte Hosts isoliert. PostgreSQL, Auth und Row-Level Security werden von einer selbst gehosteten Supabase-Instanz bereitgestellt.

## Schnellstart

Voraussetzungen: Node.js 22+, Docker, Supabase CLI; für Android zusätzlich JDK 17 und Android SDK 35.

```bash
cp .env.example .env.local
npm ci
npm run supabase:start
npm run supabase:reset
npm run dev
```

Die vom Supabase CLI ausgegebenen Schlüssel in `.env.local` eintragen. Das Studio läuft danach unter `http://localhost:3000`, der Player unter `http://display.localhost:3000` und Supabase Studio unter `http://localhost:54323`.

## Produktion

Die vollständige Anleitung steht in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Für Produktion gelten diese öffentlichen Ursprünge:

```dotenv
PUBLIC_APP_URL=https://display.qhrd.online
PUBLIC_DISPLAY_URL=https://dis.bz3.eu
```

Zusätzlich werden `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_STORE_MASTER_KEY` und `COLLECTOR_TOKEN` benötigt. Niemals Service-Role-Keys, Collector-Tokens, Keystores oder `.env`-Dateien committen.

## Entwicklung und Prüfungen

```bash
kmc validate
kmc scripts validate
npm run check
npm test
npm run mobile:build
```

Alternativ stehen alle häufigen Befehle über `kmc` bereit. Der Android-Debugbuild liegt unter `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`.

## Projektstruktur

```text
apps/web/       Next.js Studio, Web-Player und API
apps/mobile/    Native Android-App mit Jetpack Compose
supabase/       Lokale Konfiguration und SQL-Migrationen
docs/           Architektur, Deployment und Integrationen
.github/        CI, Releases und Dependency-Updates
```

Weitere Dokumentation:

- [Architektur](docs/ARCHITECTURE.md)
- [Deployment und Releases](docs/DEPLOYMENT.md)

## KI-Skill für Custom UI

Das Repository enthält den Skill `design-display-ui` zum Erstellen, Überarbeiten und Validieren von Custom-UI-JSON. Installation über [skills.sh](https://skills.sh):

```sh
npx skills add https://github.com/marius4lui/display --skill design-display-ui
```

Danach kann der Skill beispielsweise mit `$design-display-ui` aufgerufen werden.
- [n8n- und Home-Assistant-Integrationen](docs/integrations.md)
- [Beitragen](CONTRIBUTING.md)
- [Sicherheitsrichtlinie](SECURITY.md)

## Lizenz

[MIT](LICENSE) © Marius
