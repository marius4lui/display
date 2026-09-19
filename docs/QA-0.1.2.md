# 0.1.2 verification

Local verification on 2026-09-19, Echo Show 5 (`checkers`), LineageOS 18.1 / Android 11, 960 × 480 physical screen, density 195.

## Automated checks

- `testReleaseUnitTest`: 6 tests passed (network policy, update version comparison, dot-grid layout).
- `lintRelease`: passed with 0 errors and 43 warnings; warnings are not claimed as resolved.
- `assembleRelease`: signed, R8-minified release build passed.
- Every `HH:mm` from 00:00 through 23:59 fits within the fixed clock card without width changes.

## Device smoke checks

- Installed as an in-place signed update; no uninstall or application-data reset.
- Inspected clock, calendar, seconds, date-hidden layout, app drawer, settings and Home Assistant empty state at native resolution.
- Clock, Apps, Home and Settings navigation worked; Android Back returned to the clock.
- Traversed all six setup chapters and completed setup without replacing the Home role.
- Scrolled the long Home Assistant form from its first controls to Test connection, with Back/Next stationary.
- Tested the password keyboard in immersive mode. The form uses the available area above the keyboard; fixed navigation stays reachable. The chapter number hides when height is constrained.
- Restored the initial clock choices after testing: 24-hour display, date visible, seconds off.

The README screenshot is captured from the device. Its date, time and zone are the device's own settings; Display does not set or synchronize the Android system clock.

## Not established by this pass

No 24-hour soak, averaged idle CPU measurement, network weather/HA integration retest or broad Android-device compatibility result is claimed. This is a visual and interaction regression pass for the reference device, not completion of every performance target.
