# n8n und Home Assistant

Integrationen werden im Studio accountgebunden angelegt. Zugangsdaten sind AES-256-GCM-verschlüsselt und werden ausschließlich auf dem Server verwendet. Player erhalten nur die veröffentlichte Action-ID und darstellbare Button-Eigenschaften.

## n8n

1. Einen Workflow mit **Webhook Trigger** anlegen, Authentifizierung wählen und den Workflow veröffentlichen.
2. Die öffentliche HTTPS-Basisadresse als n8n-Integration verbinden. Optional einen API-Key für Workflow- und Execution-Erkennung hinterlegen.
3. Production-Webhook, Methode, statischen JSON-Payload und gegebenenfalls Header-, Basic- oder JWT-Authentifizierung konfigurieren.
4. Eine Dashboard-Action anlegen, einem Button zuweisen und das Dashboard veröffentlichen.

`/webhook-test/...` und der **Manual Trigger** sind nicht für Displays geeignet. Der Button ruft ausschließlich `/webhook/...` auf. Enterprise-Schlüssel sollten nur `workflow:list`, `workflow:read`, `execution:list` und `execution:read` besitzen. Community-API-Keys können deutlich weiter reichende Instanzrechte haben.

## Home Assistant

1. Home Assistant über eine vom Backend erreichbare öffentliche HTTPS-Adresse bereitstellen.
2. Bevorzugt OAuth verbinden. Alternativ kann ein Long-Lived Access Token eines minimal berechtigten Benutzers hinterlegt werden.
3. Entitäten, Zustände und Services ermitteln, eine Datenquelle beziehungsweise Service-Action auswählen und das Dashboard veröffentlichen.

Geräte werden nur über `/api/services/{domain}/{service}` gesteuert. Das Studio verwendet `POST /api/states` nicht zur Gerätesteuerung. Private LAN-Adressen sind ohne einen späteren Outbound-Connector nicht unterstützt.

## Sicherheit und Fehlerhilfe

- TLS ist Pflicht. Tokens und n8n-Schlüssel regelmäßig widerrufen beziehungsweise rotieren.
- `401`: Token, OAuth-Verbindung oder Webhook-Authentifizierung prüfen und erneut verbinden.
- n8n `404`: Workflow veröffentlichen und den Production- statt Test-Webhook verwenden.
- Home Assistant nicht erreichbar: öffentliche DNS-Auflösung, TLS-Zertifikat und Backend-Erreichbarkeit prüfen.
- Timeout: Zielsystem und Workflow-Laufzeit prüfen; Actions enden standardmäßig nach 20 Sekunden.
- Widerrufene Zugangsdaten: Integration aktualisieren beziehungsweise OAuth erneut verbinden und Verbindungstest ausführen.

Antworten sind auf 1 MB und JSON/Text begrenzt. Private IPs, unsichere Protokolle, Cross-Origin-Redirects und DNS-Auflösungswechsel werden blockiert. Actions nutzen standardmäßig Bestätigung, zwei Sekunden Cooldown, Idempotency-Key, persistentes Rate-Limiting und Audit-Logging.
