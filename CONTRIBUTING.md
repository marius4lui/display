# Contributing

Danke für dein Interesse an `display`.

## Entwicklung

1. Repository forken und einen kleinen, thematisch klaren Branch anlegen.
2. Node.js 22, JDK 17, Android SDK 35, Docker und die Supabase CLI installieren.
3. `npm ci`, `npm run supabase:start` und `npm run supabase:reset` ausführen.
4. Änderungen mit `npm run check`, `npm test` und bei Android-Code mit `npm run mobile:build` prüfen.
5. Einen Pull Request mit Problem, Lösung, Auswirkungen und Prüfschritten öffnen.

Keine Secrets, lokalen `.env`-Dateien, Keystores oder generierten Build-Ausgaben committen. Sicherheitslücken bitte nicht öffentlich melden; dafür gilt [SECURITY.md](SECURITY.md).
