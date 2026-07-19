# display

[![License: MIT](https://img.shields.io/badge/license-MIT-7c5cff.svg)](LICENSE)

Ein Dashboard-Studio mit Web- und Android-Playern, das ausschließlich für den Betrieb auf eigener Infrastruktur gedacht ist. Dieses Repository stellt keinen gehosteten Dienst bereit.

## Funktionen

- Dashboards mit Rasterlayout, mehreren Seiten, Widgets, Regeln und Animationen erstellen
- Versionen veröffentlichen, aktivieren und zurückrollen
- Web- und Android-Geräte per kurzlebigem Einmalcode koppeln und widerrufen
- HTTP-APIs, Home Assistant, Immich und n8n anbinden
- Letzte Werte offline anzeigen und Gerätezustände über Heartbeats überwachen
- Eine selbst signierte Android-App über die eigene Installation verteilen

Studio und Player laufen in derselben Next.js-Anwendung, werden in Produktion aber über zwei eigene Hosts getrennt. PostgreSQL, Auth und Row-Level Security kommen aus einer ebenfalls selbst betriebenen Supabase-Installation.

## Schnellstart für die Entwicklung

Voraussetzungen: Node.js 22+, Docker und Supabase CLI; für Android zusätzlich JDK 17 und Android SDK.

```bash
cp .env.example .env.local
npm ci
npm run supabase:start
npm run supabase:reset
npm run dev
```

Die vom Supabase CLI ausgegebenen lokalen Schlüssel in `.env.local` eintragen. Standardmäßig läuft das Studio unter `http://localhost:3000`, der Player kann über `http://display.localhost:3000` getestet werden.

## Self-hosted Deployment

Für Produktion werden benötigt:

- ein Linux-Host mit Docker und Docker Compose
- eine selbst gehostete Supabase-Instanz
- zwei eigene DNS-Namen für Studio und Player
- ein Reverse Proxy mit TLS
- persistente Backups für Datenbank, Konfiguration und Schlüssel

Die vollständige Anleitung inklusive Umgebungsvariablen, Reverse-Proxy-Beispiel, Start, Updates und Backups steht in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Entwicklung und Prüfungen

```bash
npm run check
npm test
npm run mobile:build
```

Der Android-Debugbuild liegt unter `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`.

## Projektstruktur

```text
apps/web/       Next.js Studio, Web-Player und API
apps/mobile/    Native Android-App mit Jetpack Compose
supabase/       Lokale Konfiguration und SQL-Migrationen
docs/           Architektur, Deployment und Integrationen
```

Weitere Dokumentation:

- [Architektur](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Integrationen](docs/integrations.md)
- [Beitragen](CONTRIBUTING.md)
- [Sicherheitsrichtlinie](SECURITY.md)

## Lizenz

[MIT](LICENSE)
