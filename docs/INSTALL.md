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

Download the APK and matching `.sha256` file from GitHub Releases, verify the checksum, then run:

```powershell
adb install -r display-0.1.0-armv7.apk
adb shell am start -n com.marius4lui.display/.MainActivity
```

Complete the on-device setup. At the last step, Android asks for the Home app. Select **Display** and **Always**.

## Update

Use Settings > Check GitHub for updates or install a newer APK with `adb install -r`. Updates must use the same signing key.
