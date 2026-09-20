package com.marius4lui.display.storage

data class DisplaySettings(
    val setupComplete: Boolean = false,
    val use24Hour: Boolean = true,
    val showSeconds: Boolean = false,
    val showDate: Boolean = true,
    val keepScreenOn: Boolean = true,
    val alwaysOnDisplay: Boolean = false,
    val immersive: Boolean = false,
    val autoBrightness: Boolean = true,
    val minBrightness: Int = 18,
    val maxBrightness: Int = 220,
    val themeMode: ThemeMode = ThemeMode.LIGHT,
    val weatherEnabled: Boolean = false,
    val weatherPlace: String = "",
    val weatherLatitude: Double = 0.0,
    val weatherLongitude: Double = 0.0,
    val weatherUnit: TemperatureUnit = TemperatureUnit.CELSIUS,
    val homeAssistantEnabled: Boolean = false,
    val homeAssistantUrl: String = "",
    val allowPrivateHttp: Boolean = false,
    val homeAssistantEntities: List<String> = emptyList(),
    val hiddenPackages: Set<String> = emptySet(),
    val favoritePackages: List<String> = emptyList(),
    val autoUpdateCheck: Boolean = true,
)

enum class ThemeMode { DARK, LIGHT, AUTO }
enum class TemperatureUnit { CELSIUS, FAHRENHEIT }
