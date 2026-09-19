# Display

Display is a tiny, Nothing-inspired clock and Android launcher built specifically for the Echo Show 5 (`checkers`) running LineageOS 18.1.

It replaces a conventional home screen with a readable dot-matrix clock, an ambient-light-aware display, weather, Home Assistant controls, and a fast app drawer. Display does not contain Nothing branding or proprietary Nothing assets.

## Target

- Echo Show 5, device codename `checkers`
- LineageOS 18.1 / Android 11 (API 30)
- 960 × 480 landscape display
- 32-bit ARM (`armeabi-v7a`)

Other Android 11+ devices may work, but are not currently supported.

## Features

- Custom Canvas-based dot clock without bundled font assets
- 12/24-hour time, seconds, date, automatic light/dark appearance
- Ambient light sensor brightness with smoothing and hysteresis
- Keep-awake and optional immersive mode
- Android Home role, searchable app grid, hidden apps, and safe Quickstep fallback
- Open-Meteo weather without an API key and with an offline cache
- Home Assistant sensors, switches, lights, and climate entities
- Keystore-encrypted Home Assistant token
- GitHub Release update checking with SHA-256 verification
- First-run setup designed for the 960 × 480 touchscreen

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
