# Installation

## Supported device

The tested target is an Echo Show 5 `checkers` running LineageOS 18.1. Verify the device before installation:

```powershell
adb shell getprop ro.product.device
adb shell getprop ro.lineage.version
adb shell wm size
```

Expected values include `checkers`, LineageOS `18.1`, and `960x480`.

## Install through ADB

Download the APK and matching `.sha256` file from the [latest GitHub release](https://github.com/marius4lui/display/releases/latest). Verify that the calculated SHA-256 matches the first value in the checksum file:

```powershell
$expected = (Get-Content .\display-0.1.3-armv7.apk.sha256).Split(' ')[0]
$actual = (Get-FileHash .\display-0.1.3-armv7.apk -Algorithm SHA256).Hash
$actual.ToLowerInvariant() -eq $expected.ToLowerInvariant()
```

Install and open the verified APK:

```powershell
adb install -r .\display-0.1.3-armv7.apk
adb shell am start -n com.marius4lui.display/.MainActivity
```

Complete the on-device setup. At the last step, Android asks for the Home app. Select **Display** and **Always**.

## Update

Use **Settings → System → Check for updates** or install a newer APK with `adb install -r`. Updates must use the same signing key; never uninstall the release merely to work around a signature error, because uninstalling also removes its local configuration and encrypted token.

## Debug builds

Local debug builds use the separate package `com.marius4lui.display.debug`. They can be installed beside the release without changing the production launcher or its data:

```powershell
.\gradlew.bat lintDebug testDebugUnitTest assembleDebug
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.marius4lui.display.debug/com.marius4lui.display.MainActivity
```
