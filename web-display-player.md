# Web-Display-Player auf `dis.bz3.eu`

## Zusammenfassung

`dis.bz3.eu` wird der eigenständige browserbasierte Display-Client. Beim ersten Aufruf gibt der Nutzer einen im Studio erzeugten, sechsstelligen und zehn Minuten gültigen Kopplungscode ein. Danach speichert der Client eine widerrufbare Gerätefreigabe als hostgebundenes HttpOnly-Cookie und startet bei späteren Aufrufen direkt den Player.

Der Player zeigt ausschließlich die aktive veröffentlichte Dashboard-Version, führt alle Datenquellen-Requests direkt im Browser aus und verhält sich funktional wie die Android-App. Studio und Player laufen im selben Next.js-Deployment, sind aber über Host-Routing, getrennte Oberflächen und getrennte Cookies isoliert.

## Implementierung

### Host- und Zugriffstrennung

- `dis.bz3.eu` liefert ausschließlich Code-Eingabe, Player und zugehörige Client-API-Routen; Studio-, Account- und Verwaltungsseiten sind auf diesem Host nicht erreichbar.
- Das bestehende Studio bleibt auf seinem bisherigen Host.
- Eine neue Konfiguration `PUBLIC_DISPLAY_URL=https://dis.bz3.eu` trennt die Player-Adresse von `PUBLIC_APP_URL`.
- Das Player-Cookie wird ohne `Domain`-Attribut gesetzt und gilt damit ausschließlich für `dis.bz3.eu`.
- Produktion verwendet ein Cookie wie `__Host-display-player`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Das Cookie enthält nur einen zufälligen Geräte-Token, keine Account-Session und keine Dashboard-Daten.

### Kopplung

- Der bestehende Studio-Flow erzeugt weiterhin einen gemeinsamen sechsstelligen Code für Android und Web.
- Pairing-Codes erhalten zusätzlich einen globalen Lookup-Hash, damit `dis.bz3.eu` das zugehörige Display ohne vorherige Dashboard-ID bestimmen kann.
- Bei der Erzeugung werden aktive Kollisionen geprüft und gegebenenfalls neue Codes generiert.
- Der Code bleibt einmalig, zehn Minuten gültig und wird beim erfolgreichen Einlösen atomar verbraucht.
- Der Web-Pairing-Endpunkt legt ein Gerät mit Plattform `web` und einem sinnvollen Browsernamen an, setzt das Player-Cookie und gibt keinen Roh-Token an JavaScript zurück.
- Persistentes Rate-Limiting begrenzt fehlgeschlagene Codeversuche pro Client/IP-Fingerprint, beispielsweise auf zehn Versuche in zehn Minuten.
- Browser-Geräte erscheinen in der bestehenden Geräteverwaltung und können dort widerrufen werden.
- Ein unauffälliges Player-Menü, erreichbar über eine definierte Ecke und eine Tastenkombination, bietet „Vollbild“ und „Verbindung trennen“. Trennen widerruft beziehungsweise entfernt die lokale Freigabe und führt zur Code-Eingabe zurück.

### Player und gemeinsamer Renderer

- Die reine Widget-Darstellung wird aus dem Editor-Canvas in einen gemeinsamen React-Renderer extrahiert.
- Studio-Vorschau und Web-Player verwenden denselben Renderer; Drag-and-drop, Auswahl und Resize bleiben ausschließlich in der Editor-Hülle.
- Der Renderer unterstützt funktional dieselben Inhalte wie Android:
  - sämtliche Widget-Typen, Formatierungen und bedingten Regeln
  - Animationen, Fehlerverhalten und Stale-Zustände
  - mehrere Seiten, Navigation und horizontale Wischgesten
  - responsive Skalierung auf Basis von Grid, Seitenverhältnis und verfügbarer Fläche
- Kleine plattformbedingte Unterschiede bei Schriftmetriken sind akzeptabel; Verhalten und Inhalte müssen übereinstimmen.
- Ein Fullscreen-Button verwendet die Browser-Fullscreen-API und zeigt einen kurzen Hinweis, falls eine Nutzeraktion erforderlich ist.

### Clientseitiger Runtime-Ablauf

- Der Player lädt mit dem HttpOnly-Cookie die aktive veröffentlichte Version über einen Player-spezifischen Konfigurationsendpunkt.
- Dieser Endpunkt validiert das Browsergerät, unterstützt ETag/`304` und liefert die für den Client aufgelösten Datenquellen.
- Der Browser plant jede Datenquelle anhand von `refreshSeconds` beziehungsweise `dataPollSeconds`.
- HTTP-Methode, Header, Authentifizierung und Body werden direkt vom Browser zur konfigurierten Ziel-API gesendet; es gibt keinen Server-Proxy und keine Collector-Abhängigkeit.
- Werte, kurze Historie, letzter erfolgreicher Stand, Fehler und Stale-Status werden im Browser verwaltet.
- Konfigurationsänderungen werden anhand von `configPollSeconds` erkannt; eine neue veröffentlichte Version wird automatisch übernommen.
- CORS-, Mixed-Content-, Timeout-, DNS-, HTTP- und JSON-Fehler werden als verständliche Clientdiagnose behandelt, ohne den letzten gültigen Wert sofort zu verwerfen.
- Der Player sendet regelmäßig Heartbeats mit Plattform, Browser-/App-Version, aktiver Dashboard-Version und letztem Synchronisationsstatus.

### Lokaler letzter Stand

- IndexedDB speichert eine bereinigte Kopie von Layout, letzter Version und letzten Runtime-Werten.
- Aufgelöste API-Secrets und vollständige Authentifizierungsdaten werden nicht persistent im Browser gespeichert.
- Bei Netzausfall bleibt der bereits laufende Stand sichtbar und wird als offline beziehungsweise stale markiert.
- Nach einem Offline-Neustart kann der Player das bereinigte Layout und die letzten Werte anzeigen, aber keine neuen Requests starten, bis Konfiguration und Secrets wieder autorisiert geladen werden konnten.
- Nach Wiederherstellung der Verbindung synchronisiert der Player Konfiguration und Datenquellen automatisch.

## Öffentliche Schnittstellen und Datenmodell

- Neue Umgebungsvariable: `PUBLIC_DISPLAY_URL`.
- Neuer hostgebundener Player-Einstieg auf `/` von `dis.bz3.eu`.
- Neue Player-Endpunkte für Pairing, Konfiguration, Heartbeat und Trennen; sie akzeptieren ausschließlich das Player-Cookie.
- `device_pairing_codes` wird um einen globalen, gehashten Web-Lookup ergänzt.
- Geräte-Metadaten unterscheiden mindestens Android und Web.
- Bestehende Android-Endpunkte, veröffentlichte `/d/{id}`-Adressen und Bearer-Token bleiben kompatibel.
- Der vorhandene serverseitige Collector und Runtime-Endpunkt werden für dieses Feature weder verwendet noch als Datenpfad des Web-Players vorausgesetzt.

## Tests und Abnahme

- Erster Besuch auf `dis.bz3.eu` zeigt ausschließlich die sechsstellige Code-Eingabe.
- Gültiger Code koppelt genau einmal, setzt nur auf `dis.bz3.eu` ein Cookie und startet den Player.
- Abgelaufene, falsche, bereits verbrauchte und zu häufig versuchte Codes werden korrekt abgelehnt.
- Das Player-Cookie authentifiziert weder Studio noch Account-API und wird nicht an den Studio-Host gesendet.
- Ein späterer Besuch startet ohne erneute Code-Eingabe direkt den zuletzt gekoppelten Player.
- Widerruf im Studio beendet beim nächsten Polling den Zugriff und führt zurück zur Kopplungsansicht.
- Trennen im versteckten Menü entfernt die lokale Freigabe.
- Alle Widget-Typen, Regeln, Seitenwechsel, Datenformate, Animationen und Fehlerzustände werden gegen Studio-Vorschau und Android-Verhalten geprüft.
- Datenquellen-Requests laufen nachweislich aus dem Browser; CORS- und Mixed-Content-Fehler erscheinen als Diagnose.
- Neue Publishes werden automatisch übernommen, Entwurfsänderungen hingegen nicht.
- Netzwerkverlust zeigt letzten Stand und Offline-Markierung; Wiederverbindung aktualisiert ohne Reload.
- Host-Routing liefert auf `dis.bz3.eu` keine Studio-, Login- oder Verwaltungsoberflächen.
- Typecheck, Next.js-Build und bestehender Android-Build bleiben erfolgreich.

## Festgelegte Annahmen

- MVP-Ziel sind aktuelle Desktop- und Tablet-Browser; Smart-TV-Sonderfälle werden nicht garantiert.
- Der Player zeigt nur die aktive veröffentlichte Version, keine Live-Entwürfe.
- Ein Browser ist gleichzeitig mit genau einem Display gekoppelt.
- Sechsstellige Codes sind kurzlebige Kopplungsgeheimnisse und keine dauerhaften öffentlichen Dashboard-Adressen.
- Studio und Player teilen ein Deployment, bleiben aber logisch und sicherheitstechnisch getrennte Hosts.
- Datenquellen müssen Browserzugriff selbst erlauben; der Player umgeht CORS und HTTPS-Sicherheitsregeln nicht.
