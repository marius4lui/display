# Roadmap

Diese Roadmap beschreibt die geplante Produktentwicklung von `display`. Sie enthält bewusst keine festen Termine. Die Reihenfolge zeigt die derzeitige Priorität und kann sich nach Nutzerfeedback ändern.

## Produktvarianten und Accounts

`display` wird als offene, selbst gehostete Anwendung betrieben:

| Funktion | Self-Hosted / Open Source |
| --- | --- |
| Builder-Nutzung | Supabase-Account verpflichtend |
| Login-Anbieter | E-Mail und Passwort |
| Android-Zugriff | Widerrufbares Geräte-Pairing |
| Datenhaltung | Selbst gehostetes Supabase/PostgreSQL |

### Leitlinien

- Die Self-Hosted-Version verwendet verpflichtende Supabase-Accounts. Besitz und Bearbeitungszugriff werden über Supabase Auth und PostgreSQL-RLS abgebildet.
- Anonyme Builder-, Bearbeitungstoken- und Claim-Flows werden nicht unterstützt.
- Display-Inhalte und Zugangsdaten bleiben nach dem bestehenden Ende-zu-Ende-Verschlüsselungsmodell geschützt. Accounts ändern nicht, welche Klartextdaten der Server sehen kann.

## Phase 1: Account- und Variantenmodell festigen

- Supabase-E-Mail/Passwort-Accounts und sichere Next.js-Session-Cookies verwenden.
- Bearbeitungszugriff ausschließlich über Accountbesitz und RLS erlauben.
- Android-Geräte über kurzlebige Einmalcodes und widerrufbare Gerätetokens koppeln.
- Klare Fehlermeldungen für abgelaufene Sessions und widerrufene Geräte ergänzen.

## Phase 2: Mehrere Displays verwalten

- Persönliche Display-Übersicht mit Status, letzter Veröffentlichung und letzter Änderung.
- Displays anlegen, benennen, duplizieren, archivieren und löschen.
- Schneller Wechsel zwischen eigenen Displays.
- Leerer Zustand und Onboarding für das erste Display.

## Phase 3: Mehrseitige Displays

- Mehrere Seiten innerhalb eines Displays anlegen, duplizieren, umbenennen und sortieren.
- Auf dem Zielgerät horizontal oder vertikal zwischen Seiten wischen.
- Optionaler automatischer Seitenwechsel mit konfigurierbarem Intervall.
- Übergänge und Verhalten bei Offline-Betrieb definieren.
- Seiten in Preview, Veröffentlichung, Versionsverlauf und Rollback vollständig unterstützen.

## Phase 4: Mehr und bessere Templates

- Zusätzliche Vorlagen für typische Einsätze wie Smart Home, Wetter, Kalender, Status-Monitoring und Informationstafeln.
- Templates nach Anwendungsfall, Datenquelle und Layout kategorisieren.
- Vorschau und Beschreibung vor der Übernahme anzeigen.
- Mehrseitige Templates unterstützen.
- Eigene Templates weiterhin ohne Zugangsdaten oder andere Secrets speichern.

## Phase 5: Self-Hosted-Administration

Das Admin-Panel ist ausschließlich Bestandteil der Self-Hosted-Version.

- Geschütztes Admin-Panel unter `/admin`.
- Benutzerübersicht und Rollenverwaltung.
- Mindestens die Rollen `Admin` und `User`; weitere Rollen erst nach einem konkreten Berechtigungsbedarf.
- Benutzer sperren, Rollen ändern und relevante Verwaltungsereignisse nachvollziehen.
- Ersten Admin bei der Installation sicher festlegen.
- Zugriff auf `/admin` serverseitig absichern, nicht nur in der Oberfläche ausblenden.

## Phase 6: Neuer Editor

- Präzisere Auswahl, Ausrichtung, Größenänderung und Mehrfachauswahl von Elementen.
- Ebenen, Gruppierung, Sperren, Kopieren/Einfügen sowie Undo/Redo.
- Bessere Eigenschaftenleiste für Layout, Typografie, Farben und Datenbindungen.
- Responsive beziehungsweise zielauflösungsbezogene Vorschau.
- Seitenverwaltung direkt im Editor.
- Schnellere Bearbeitung großer Displays und klarere Fehlermeldungen bei ungültigen Datenquellen.
- Tastaturbedienung und grundlegende Barrierefreiheit berücksichtigen.

## Phase 7: Branding und Produktreife

- Eigenständiges Logo und konsistente Wort-/Bildmarke entwickeln.
- Farben, Typografie, Icons und UI-Komponenten als kleines Design-System festhalten.
- Landingpage, Builder, Android-App, Dokumentation und Standard-Templates visuell vereinheitlichen.
- App-Icon, Favicon, Social Preview und Screenshots aktualisieren.
- Self-Hosted-Branding klar kennzeichnen, ohne die Anpassbarkeit unnötig einzuschränken.

## Übergreifende Anforderungen

- Bestehende öffentliche Display-URLs bleiben bei Migrationen stabil.
- Keine Secrets, Passphrases oder Authorization-Header in Logs oder Admin-Ansichten.
- Neue Account- und Admin-Funktionen benötigen Tests für Berechtigungsgrenzen.
- Datenbankänderungen erhalten vorwärtskompatible Migrationen und eine dokumentierte Upgrade-Strategie.

## Noch zu entscheiden

- Welche zusätzlichen Rollen und Berechtigungen Self-Hosted-Nutzer tatsächlich benötigen.
- Ob Seitenwechsel nur manuell, nur automatisch oder in beiden Modi pro Display konfigurierbar ist.
- Welche Templates zuerst umgesetzt werden.
