# 0.1.3 verification

Local verification on 2026-09-20, Echo Show 5 (`checkers`), LineageOS 18.1 / Android 11, 960 × 480 physical screen, density 195.

## Automated checks

- `lintDebug`, `testDebugUnitTest`, and `assembleDebug` passed locally and in GitHub CI.
- `lintRelease`, `testReleaseUnitTest`, R8 minification, and `assembleRelease` passed locally and in the signing workflow.
- Android Lint reported 0 errors and 41 warnings.
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

The release gate passed:

- GitHub published [v0.1.3](https://github.com/marius4lui/display/releases/tag/v0.1.3) from commit `790d3c6`.
- The published APK is 573,480 bytes with SHA-256 `675602f4bf7ce43f380ffa2e437966e5b9e1cb09b5760d054e06082d2256edab`.
- Its signing-certificate SHA-256 matches the installed v0.1.2 certificate: `311505a4e354524a650b2b4257f0e84f8e68fefa878a8dcef916b1a4c137044e`.
- `adb install -r` upgraded the production package to version code 103 without changing its original install time.
- The complete directional swipe sequence, Settings gear, Android Back, and final clock state passed again against `com.marius4lui.display` after installation.
- The temporary side-by-side debug package was removed after the production smoke test.
