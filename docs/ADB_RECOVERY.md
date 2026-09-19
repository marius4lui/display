# Launcher recovery

Display never disables or uninstalls Quickstep. If the launcher UI is unavailable, connect ADB and run:

```powershell
adb shell cmd package set-home-activity com.android.launcher3/.uioverrides.QuickstepLauncher
adb shell am force-stop com.marius4lui.display
adb shell input keyevent HOME
```

To reopen Display without selecting it as Home:

```powershell
adb shell am start -n com.marius4lui.display/.MainActivity
```

To clear Display configuration:

```powershell
adb shell pm clear com.marius4lui.display
```

The final command deletes local settings, cached weather, and the encrypted Home Assistant token.
