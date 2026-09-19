# Privacy

Display does not contain analytics, crash reporting, advertising, telemetry, or an account system.

Depending on enabled features, the app contacts:

- `api.open-meteo.com` for weather;
- `geocoding-api.open-meteo.com` for manual place search;
- the configured Home Assistant server;
- `api.github.com` and GitHub release asset hosts for update checks.

Weather coordinates and configuration are stored locally. The Home Assistant token is encrypted through Android Keystore. Android application backups are disabled. Secrets are not included in diagnostics or logs.
