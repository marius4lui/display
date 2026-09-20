# 0.1.3 verification

Local verification on 2026-09-20, Echo Show 5 (`checkers`), LineageOS 18.1 / Android 11, 960 × 480 physical screen, density 195.

## Automated checks

- `lintDebug`, `testDebugUnitTest`, and `assembleDebug` passed.
- Direction tests cover clock-to-Apps, clock-to-Home, both reverse gestures, and non-wrapping outer edges.
- The debug variant uses `com.marius4lui.display.debug`, allowing side-by-side device validation without replacing the signed launcher or its data.

## Device checks

- The clock uses the complete panel with system bars hidden and keeps its cards inside the visible bounds.
- Swipe right from the clock opens Apps; swipe left from Apps returns to the clock.
- Swipe left from the clock opens Home Assistant; swipe right from Home Assistant returns to the clock.
- Repeating an outward swipe on Apps or Home Assistant stays on that page.
- Vertical app-drawer scrolling stays in Apps.
- The app drawer renders four large columns and two complete rows at native resolution.
- Clock settings render three enlarged control rows at once, with the category selector in the same header row.

## Release gate

The signed release build, in-place installation, signature preservation, and production-package smoke test must pass before publication is considered complete.
