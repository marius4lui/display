# display

Monorepo-Grundgerüst für das System **display**: Next.js-Webapp, Node.js-Backend, MySQL-Datenbank und native Android-App mit Kotlin Compose.

## Struktur

```text
display/
├── apps/
│   ├── web/        # Next.js, Port 3000
│   ├── backend/    # Express + TypeScript, Port 4000
│   └── mobile/     # Android/Kotlin Compose, com.kmuc.display
├── packages/
│   └── database/   # MySQL-Migrationen
├── .kmc/           # lokale KMC-Workflows
├── compose.yml
├── kmc.json
└── package.json
```

## Voraussetzungen

- Node.js 22 oder neuer
- Docker mit Docker Compose
- KMC (`npm install -g @marius4lui/kmc`)
- Für Android: JDK 17+ und Android SDK 35

## Einrichtung

```bash
cp .env.example .env
kmc run display.install
kmc run display.database
kmc run display.dev
```

Danach sind die Webapp unter `http://localhost:3000`, das Backend unter `http://localhost:4000` und dessen Datenbank-Healthcheck unter `http://localhost:4000/health` erreichbar.

## KMC-Befehle

| ID | Zweck |
| --- | --- |
| `display.install` | npm-Abhängigkeiten installieren |
| `display.database` | MySQL starten |
| `display.dev` | Webapp und Backend starten |
| `display.web` | nur Webapp starten |
| `display.backend` | nur Backend starten |
| `display.check` | TypeScript prüfen |
| `display.build` | Webapp und Backend bauen |
| `display.mobile` | Android-Debug-App bauen |

Der Workflow `kmc run checks --dry-run` zeigt die kombinierten Prüf- und Build-Schritte. Änderungen an KMC-Dateien werden mit `kmc validate` und `kmc scripts validate` geprüft.

## Datenbank

MySQL 8.4 läuft über Docker Compose. Beim ersten Erstellen des Volumes werden die SQL-Dateien aus `packages/database/migrations` automatisch ausgeführt. Für einen vollständigen lokalen Reset:

```bash
docker compose down -v
kmc run display.database
```

Dieser Befehl löscht lokale Daten und sollte nur bewusst ausgeführt werden.

## Android

`apps/mobile` kann direkt in Android Studio geöffnet werden. Paketname und Application ID sind `com.kmuc.display`. Ein CLI-Build läuft über:

```bash
kmc run display.mobile
```

## Umgebungsvariablen

Die Vorlage `.env.example` enthält alle lokalen Standardwerte. `.env` wird nicht versioniert. Für Produktion müssen insbesondere die MySQL-Passwörter ersetzt und CORS/Netzwerkzugriffe eingeschränkt werden.
