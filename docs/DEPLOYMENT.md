# Self-hosted Deployment

`display` ist ausschließlich für den Betrieb auf eigener Infrastruktur ausgelegt. Es gibt keinen zentralen Dienst und keine vorgegebenen Produktionsdomains. Alle öffentlichen URLs, Schlüssel, Images und Android-Downloads gehören zur jeweiligen Installation.

## Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose v2
- selbst gehostete Supabase-Installation mit PostgreSQL, Auth und PostgREST
- zwei DNS-Namen, zum Beispiel `studio.example.com` und `player.example.com`
- Reverse Proxy wie Caddy, Traefik oder nginx mit gültigem TLS-Zertifikat
- zuverlässiges Backup-Ziel außerhalb des Servers

Studio und Player müssen getrennte Hosts verwenden. Beide Hosts zeigen auf denselben Web-Container; die Anwendung beschränkt die verfügbaren Routen anhand des Hosts.

## 1. Supabase bereitstellen

Supabase wird getrennt von diesem Compose-Stack betrieben. Die offizielle Self-hosting-Anleitung verwenden, anschließend alle Dateien aus `supabase/migrations` in lexikographischer Reihenfolge anwenden.

Benötigt werden:

- interne Supabase-URL, die der Web-Container erreichen kann
- Anon-Key
- Service-Role-Key

Supabase Studio, PostgreSQL und der Service-Role-Key dürfen nicht ungeschützt öffentlich erreichbar sein.

## 2. Konfiguration anlegen

```bash
cp .env.example .env
openssl rand -base64 32
openssl rand -hex 32
```

Den ersten Wert als `SECRET_STORE_MASTER_KEY`, den zweiten als `COLLECTOR_TOKEN` eintragen. Beispiel:

```dotenv
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_ANON_KEY=replace-me
SUPABASE_SERVICE_ROLE_KEY=replace-me

PUBLIC_APP_URL=https://studio.example.com
PUBLIC_DISPLAY_URL=https://player.example.com
WEB_PORT=3000

SECRET_STORE_MASTER_KEY=replace-me
COLLECTOR_TOKEN=replace-me

# Optional: signierte APK aus der eigenen Release-Pipeline
ANDROID_APK_URL=https://downloads.example.com/display.apk
```

Produktionswerte gehören nur in `.env` oder einen Secret Manager. `.env`, Service-Role-Key, Collector-Token, Master-Key und Android-Keystore niemals committen.

Der Master-Key verschlüsselt gespeicherte Integrations-Secrets. Sein Verlust macht diese Daten unlesbar; eine unkoordinierte Änderung ebenfalls. Den Schlüssel deshalb verschlüsselt sichern und Rotationen geplant durchführen.

## 3. Web-Anwendung starten

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web collector
```

Der Web-Port sollte nach Möglichkeit nur für den Reverse Proxy oder das private Container-Netz erreichbar sein. Der Collector ruft einen internen Endpunkt mit `COLLECTOR_TOKEN` auf und darf nicht separat veröffentlicht werden.

## 4. Reverse Proxy und TLS

Beispiel für Caddy, wenn der Container-Port nur auf dem Host erreichbar ist:

```caddyfile
studio.example.com {
    reverse_proxy 127.0.0.1:3000
}

player.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Bei nginx oder Traefik müssen mindestens `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` und eine vertrauenswürdige Client-IP-Kette korrekt gesetzt beziehungsweise bereinigt werden. Direkten Internetzugriff auf Port 3000 per Firewall verhindern und HTTP dauerhaft auf HTTPS umleiten.

## 5. Installation prüfen

Nach dem Start:

1. Studio-Host öffnen und den ersten Account anlegen.
2. Dashboard erstellen und veröffentlichen.
3. Player-Host öffnen und mit einem kurzlebigen Code koppeln.
4. Prüfen, dass Studio-Routen auf dem Player-Host und Player-Routen auf dem Studio-Host mit `404` antworten.
5. Collector-Logs auf erfolgreiche Abfragen kontrollieren.

## Updates

Vor jedem Update Datenbank und `.env` sichern. Danach:

```bash
git pull --ff-only
docker compose build --pull web
docker compose up -d
docker compose ps
```

Neue SQL-Migrationen vor dem Neustart in Reihenfolge anwenden. Für reproduzierbare Installationen ein festes Git-Tag oder ein versioniertes Container-Image verwenden, nicht einen beweglichen `latest`-Tag.

## Backup und Wiederherstellung

Regelmäßig sichern:

- vollständigen PostgreSQL-Dump
- `.env` beziehungsweise die Werte des Secret Managers
- `SECRET_STORE_MASTER_KEY` separat und verschlüsselt
- Android-Signing-Keystore und dessen Zugangsdaten
- Reverse-Proxy-Konfiguration

Backups sind erst belastbar, wenn die Wiederherstellung auf einem getrennten System getestet wurde. Datenbank und Master-Key müssen aus demselben Sicherungsstand stammen.

## Authentik über OIDC

In Authentik einen OAuth2/OpenID-Provider mit Authorization Code, einer vertraulichen Client-ID samt Secret und den Scopes openid, profile und email anlegen. Als Redirect-URI exakt folgende URL hinterlegen:

```text
https://display.qhrd.online/api/auth/oidc/callback
```

Danach display konfigurieren:

```dotenv
OIDC_ISSUER=https://auth.example.com/application/o/display/
OIDC_CLIENT_ID=display
OIDC_CLIENT_SECRET=replace-me
OIDC_PROVIDER_NAME=Authentik
LOCAL_AUTH_ENABLED=false
OIDC_ALLOW_SIGNUP=true
```

LOCAL_AUTH_ENABLED=false deaktiviert sowohl Passwort-Login als auch Registrierung in UI und API. OIDC-Benutzer werden ausschließlich anhand einer von Authentik als verifiziert gemeldeten, normalisierten E-Mail einem vorhandenen Supabase-Benutzer zugeordnet. Mit OIDC_ALLOW_SIGNUP=false wird kein neuer Supabase-Benutzer angelegt, wenn noch kein Account mit dieser E-Mail existiert.

## Android-Release

Release-APKs müssen für jede Installation dauerhaft mit demselben Schlüssel signiert werden. Gradle erwartet:

```text
DISPLAY_SIGNING_STORE_FILE
DISPLAY_SIGNING_STORE_PASSWORD
DISPLAY_SIGNING_KEY_ALIAS
DISPLAY_SIGNING_KEY_PASSWORD
DISPLAY_API_URL
DISPLAY_RELEASES_API_URL
```

`DISPLAY_API_URL` zeigt auf den eigenen Studio-Host. `DISPLAY_RELEASES_API_URL` zeigt optional auf einen kompatiblen JSON-Release-Endpunkt. Ohne eigene Release-Infrastruktur kann die Update-Prüfung auf eine nicht erreichbare URL gesetzt und die APK manuell verteilt werden.

```bash
export DISPLAY_API_URL=https://studio.example.com
export DISPLAY_RELEASES_API_URL=https://api.example.com/releases/latest
npm run mobile:release
```

Die signierte APK kann an einer eigenen HTTPS-Adresse veröffentlicht und über `ANDROID_APK_URL` im Player angeboten werden. Vor jedem Release `versionCode` und `versionName` in `apps/mobile/app/build.gradle.kts` erhöhen.

## Betriebshinweise

- Logs dürfen keine Tokens, Secrets oder vollständigen Authorization-Header enthalten.
- Betriebssystem, Docker, Reverse Proxy, Supabase und Anwendung regelmäßig aktualisieren.
- Pairing nur bei Bedarf durchführen und nicht mehr benötigte Geräte widerrufen.
- Datenquellen nur auf ausdrücklich benötigte Ziele und Rechte beschränken.
- Öffentliche Erreichbarkeit regelmäßig von außerhalb des eigenen Netzes testen.
