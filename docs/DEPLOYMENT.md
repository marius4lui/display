# Deployment

## Web

1. Eine selbst gehostete Supabase-Instanz bereitstellen und alle Migrationen aus `supabase/migrations` anwenden.
2. `.env.example` kopieren und alle Platzhalter ersetzen.
3. Studio/API unter `https://display.qhrd.online` und denselben Container zusätzlich unter `https://dis.bz3.eu` routen.
4. `docker compose up -d --build` ausführen und TLS am Reverse Proxy erzwingen.

`PUBLIC_APP_URL` muss auf `https://display.qhrd.online`, `PUBLIC_DISPLAY_URL` auf `https://dis.bz3.eu` zeigen. Supabase und der Collector dürfen nicht öffentlich ungeschützt erreichbar sein.

## Android-Release

Release-APKs müssen immer mit demselben Schlüssel signiert werden. Lokal erwartet Gradle:

```text
DISPLAY_SIGNING_STORE_FILE
DISPLAY_SIGNING_STORE_PASSWORD
DISPLAY_SIGNING_KEY_ALIAS
DISPLAY_SIGNING_KEY_PASSWORD
```

Für GitHub Actions werden zusätzlich die gleichnamigen Repository-Secrets und `DISPLAY_SIGNING_KEY_BASE64` benötigt. Ein Tag wie `v0.1.1` baut und veröffentlicht `display.apk`. Der stabile Download ist:

`https://github.com/marius4lui/display/releases/latest/download/display.apk`

Vor jedem Release `versionCode` und `versionName` in `apps/mobile/app/build.gradle.kts` erhöhen. Die App vergleicht `versionName` mit dem neuesten GitHub-Tag.
