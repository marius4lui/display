# Architektur

`display` besteht aus drei Laufzeitkomponenten:

- **Studio und API:** Next.js verwaltet Accounts, Dashboard-Entwürfe, Releases, Geräte und Integrationen.
- **Web-Player:** `dis.bz3.eu` liefert nur Pairing, Player-API und den APK-Download. Host-Routing sperrt Studio-Routen auf diesem Host.
- **Android-Player:** Eine native Compose-App lädt veröffentlichte Dokumente, hält den letzten Stand verschlüsselt offline und prüft GitHub Releases auf Updates.

PostgreSQL, Authentifizierung und Row-Level Security kommen aus einer selbst gehosteten Supabase-Instanz. Secrets werden serverseitig mit AES-256-GCM verschlüsselt. Web-Geräte verwenden hostgebundene HttpOnly-Cookies; Android-Geräte widerrufbare Bearer-Tokens im Android Keystore.

## Datenfluss

1. Das Studio speichert einen Entwurf und veröffentlicht daraus eine unveränderliche Version.
2. Ein Gerät wird per kurzlebigem Einmalcode autorisiert.
3. Der Player lädt ausschließlich die aktive Version und sendet Heartbeats.
4. Datenquellen und Aktionen laufen über serverseitig validierte Proxys; Zugangsdaten gelangen nicht in den Web-Player.

Das aktuelle Dokumentformat ist Schema v6. Es unterstützt neben dem klassischen Widget-Grid ein optionales, deklaratives `customUi`: Ohne `pages` wirkt es als Theme auf das bestehende Grid, mit Page-Definitionen als vollständiges Layout. Beides wird strikt validiert und von Web und Android ohne ausführbares HTML oder JavaScript gerendert. Ältere gespeicherte Dokumente werden beim Laden migriert, aber nicht neu erzeugt.
