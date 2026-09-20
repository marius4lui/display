# Changelog

## 0.1.4 - 2026-09-20

- Add an optional Echo-specific AOD: the first power press shows a dim black clock and the next wake restores the main clock.
- Keep the AOD local and narrowly permissioned with a foreground screen-state service and wake lock; no overlay or accessibility service is requested.
- Use all 960 × 480 pixels for the clock, remove the redundant `DISPLAY` and location header, and move Settings inside the primary card.
- Add short 190 ms directional page transitions suited to the compact panel.
- Return from Apps and Home Assistant with either horizontal swipe direction instead of trapping the outward edge.
- Add deterministic power-state and navigation regression tests plus on-device Echo Show 5 verification.

## 0.1.3 - 2026-09-20

- Replace the three-button dock with a full-screen, distance-readable clock surface.
- Add spatial navigation: Apps sits left of the clock, Home Assistant sits right, and a reverse swipe returns to the clock.
- Keep horizontal page gestures directional without stealing vertical app-drawer scrolling or wrapping at the outer edges.
- Enlarge the app drawer to four columns and Home Assistant controls to two columns.
- Reflow settings into one compact header so three larger control rows remain visible.
- Use immersive system-bar handling for the three ambient launcher pages and keep setup/settings safely inset.
- Give debug builds a separate application ID for non-destructive on-device testing.

## 0.1.2 - 2026-09-19

- Redesign around a fine 7 × 11 dot-matrix clock, white rounded modules, calendar and analog dial.
- Add a clean three-action dock and monochrome circular app icons.
- Redesign setup with a chapter rail, independently scrolling content and fixed navigation.
- Group settings into four categories with immediately saved switches and brightness bounds.
- Restyle Home Assistant and its unconfigured state; add an original dotted launcher icon.
- Keep the interface white-only, disable fullscreen keyboard extraction and correct Android Back navigation.
- Align clock redraws to minute boundaries; update every second only when enabled.
- Add layout-width tests covering every minute of the day.

## 0.1.1 - 2026-09-19

- Always return to the clock when Android sends the launcher Home intent.

## 0.1.0 - 2026-09-19

- Initial Echo Show 5 clock and launcher.
- Ambient brightness, Open-Meteo, Home Assistant, setup, settings, and updater.
