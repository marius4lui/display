# Display

Display is a tiny, Nothing-inspired clock and Android launcher built specifically for the Echo Show 5 (`checkers`) running LineageOS 18.1.

It replaces a conventional home screen with a readable dot-matrix clock, an ambient-light-aware display, weather, Home Assistant controls, and a fast app drawer. Display does not contain Nothing branding or proprietary Nothing assets.

![Display on Echo Show 5](docs/screenshots/clock.png)

See the [design system](docs/DESIGN.md) and [0.1.3 verification notes](docs/QA-0.1.3.md).

## Target

- Echo Show 5, device codename `checkers`
- LineageOS 18.1 / Android 11 (API 30)
- 960 × 480 landscape display
- 32-bit ARM (`armeabi-v7a`)

Other Android 11+ devices may work, but are not currently supported.

## Features

- Full-screen 7 × 11 dot-matrix clock, calendar card and analog dial, drawn with Canvas
- White-only design: soft gray canvas, white rounded modules, monochrome icons and restrained red accents
- 12/24-hour time, optional seconds and date; minute-aligned redraws by default
- Ambient light sensor brightness with smoothing and hysteresis
- Keep-awake and optional immersive mode
- Spatial swipe navigation, four-column app grid, Android Home role, hidden apps, and safe Quickstep fallback
- Open-Meteo weather without an API key and with an offline cache
- Home Assistant sensors, switches, lights, and climate entities
- Keystore-encrypted Home Assistant token
- GitHub Release update checking with SHA-256 verification
- Two-column setup with scrollable content and fixed navigation for the 960 × 480 touchscreen
- Categorized settings with immediately saved controls

## Build

Requirements: JDK 17 or newer and Android SDK 36.

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

See [docs/INSTALL.md](docs/INSTALL.md), [docs/HOME_ASSISTANT.md](docs/HOME_ASSISTANT.md), and [docs/ADB_RECOVERY.md](docs/ADB_RECOVERY.md).

## Privacy

Display has no analytics, advertising, account system, or telemetry. Network access is used only for features explicitly configured by the user. See [docs/PRIVACY.md](docs/PRIVACY.md).

## License

Display is licensed under the GNU General Public License v3.0. See `LICENSE`.
