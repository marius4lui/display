package com.marius4lui.display.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SettingsStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("display_settings", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(read())
    val state: StateFlow<DisplaySettings> = _state.asStateFlow()

    fun current(): DisplaySettings = _state.value

    fun update(block: (DisplaySettings) -> DisplaySettings) {
        val next = block(_state.value)
        write(next)
        _state.value = next
    }

    private fun read() = DisplaySettings(
        setupComplete = prefs.getBoolean("setup_complete", false),
        use24Hour = prefs.getBoolean("use_24_hour", true),
        showSeconds = prefs.getBoolean("show_seconds", false),
        showDate = prefs.getBoolean("show_date", true),
        keepScreenOn = prefs.getBoolean("keep_screen_on", true),
        alwaysOnDisplay = prefs.getBoolean("always_on_display", false),
        immersive = prefs.getBoolean("immersive", false),
        autoBrightness = prefs.getBoolean("auto_brightness", true),
        minBrightness = prefs.getInt("min_brightness", 18),
        maxBrightness = prefs.getInt("max_brightness", 220),
        themeMode = ThemeMode.LIGHT,
        weatherEnabled = prefs.getBoolean("weather_enabled", false),
        weatherPlace = prefs.getString("weather_place", "").orEmpty(),
        weatherLatitude = prefs.getLong("weather_lat", 0L).let(Double::fromBits),
        weatherLongitude = prefs.getLong("weather_lon", 0L).let(Double::fromBits),
        weatherUnit = enumValueOrDefault(prefs.getString("weather_unit", null), TemperatureUnit.CELSIUS),
        homeAssistantEnabled = prefs.getBoolean("ha_enabled", false),
        homeAssistantUrl = prefs.getString("ha_url", "").orEmpty(),
        allowPrivateHttp = prefs.getBoolean("ha_allow_http", false),
        homeAssistantEntities = decodeList(prefs.getString("ha_entities", "")),
        hiddenPackages = decodeList(prefs.getString("hidden_packages", "")).toSet(),
        favoritePackages = decodeList(prefs.getString("favorite_packages", "")),
        autoUpdateCheck = prefs.getBoolean("auto_update", true),
    )

    private fun write(value: DisplaySettings) {
        prefs.edit()
            .putBoolean("setup_complete", value.setupComplete)
            .putBoolean("use_24_hour", value.use24Hour)
            .putBoolean("show_seconds", value.showSeconds)
            .putBoolean("show_date", value.showDate)
            .putBoolean("keep_screen_on", value.keepScreenOn)
            .putBoolean("always_on_display", value.alwaysOnDisplay)
            .putBoolean("immersive", value.immersive)
            .putBoolean("auto_brightness", value.autoBrightness)
            .putInt("min_brightness", value.minBrightness)
            .putInt("max_brightness", value.maxBrightness)
            .putString("theme", value.themeMode.name)
            .putBoolean("weather_enabled", value.weatherEnabled)
            .putString("weather_place", value.weatherPlace)
            .putLong("weather_lat", value.weatherLatitude.toBits())
            .putLong("weather_lon", value.weatherLongitude.toBits())
            .putString("weather_unit", value.weatherUnit.name)
            .putBoolean("ha_enabled", value.homeAssistantEnabled)
            .putString("ha_url", value.homeAssistantUrl)
            .putBoolean("ha_allow_http", value.allowPrivateHttp)
            .putString("ha_entities", encodeList(value.homeAssistantEntities))
            .putString("hidden_packages", encodeList(value.hiddenPackages.toList()))
            .putString("favorite_packages", encodeList(value.favoritePackages))
            .putBoolean("auto_update", value.autoUpdateCheck)
            .apply()
    }

    fun reset() {
        prefs.edit().clear().apply()
        _state.value = read()
    }

    private fun encodeList(values: List<String>) = values.joinToString("\u001f")
    private fun decodeList(value: String?) = value.orEmpty().split('\u001f').filter(String::isNotBlank)

    private inline fun <reified T : Enum<T>> enumValueOrDefault(value: String?, default: T): T =
        enumValues<T>().firstOrNull { it.name == value } ?: default
}
