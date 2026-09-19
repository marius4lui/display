package com.marius4lui.display.weather

import android.content.Context
import com.marius4lui.display.network.HttpClient
import com.marius4lui.display.storage.TemperatureUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

data class Place(val name: String, val country: String, val latitude: Double, val longitude: Double, val timezone: String)
data class WeatherSnapshot(val temperature: Double, val apparentTemperature: Double, val weatherCode: Int, val fetchedAt: Long) {
    fun summary(unit: TemperatureUnit): String {
        val suffix = if (unit == TemperatureUnit.CELSIUS) "°C" else "°F"
        return "${temperature.toInt()}$suffix  ${weatherLabel(weatherCode)}"
    }

    companion object {
        fun weatherLabel(code: Int) = when (code) {
            0 -> "Clear"
            1, 2 -> "Partly cloudy"
            3 -> "Cloudy"
            45, 48 -> "Fog"
            in 51..67 -> "Rain"
            in 71..77 -> "Snow"
            in 80..82 -> "Showers"
            in 95..99 -> "Thunderstorm"
            else -> "Weather"
        }
    }
}

class WeatherRepository(context: Context) {
    private val cache = context.getSharedPreferences("weather_cache", Context.MODE_PRIVATE)

    suspend fun searchPlaces(query: String): List<Place> = withContext(Dispatchers.IO) {
        if (query.trim().length < 2) return@withContext emptyList()
        val encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8.name())
        val request = Request.Builder().url("https://geocoding-api.open-meteo.com/v1/search?name=$encoded&count=8&language=en&format=json").build()
        HttpClient.instance.newCall(request).execute().use { response ->
            require(response.isSuccessful) { "Geocoding failed (${response.code})" }
            val array = JSONObject(response.body!!.string()).optJSONArray("results") ?: return@withContext emptyList()
            (0 until array.length()).map { index ->
                val item = array.getJSONObject(index)
                Place(item.getString("name"), item.optString("country"), item.getDouble("latitude"), item.getDouble("longitude"), item.optString("timezone", "auto"))
            }
        }
    }

    suspend fun refresh(latitude: Double, longitude: Double, unit: TemperatureUnit): WeatherSnapshot = withContext(Dispatchers.IO) {
        val unitValue = if (unit == TemperatureUnit.FAHRENHEIT) "fahrenheit" else "celsius"
        val url = "https://api.open-meteo.com/v1/forecast?latitude=$latitude&longitude=$longitude&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=$unitValue&timezone=auto"
        val request = Request.Builder().url(url).build()
        HttpClient.instance.newCall(request).execute().use { response ->
            require(response.isSuccessful) { "Weather failed (${response.code})" }
            val current = JSONObject(response.body!!.string()).getJSONObject("current")
            val snapshot = WeatherSnapshot(
                current.getDouble("temperature_2m"),
                current.getDouble("apparent_temperature"),
                current.getInt("weather_code"),
                System.currentTimeMillis(),
            )
            save(snapshot)
            snapshot
        }
    }

    fun cached(maxAgeMillis: Long = 6 * 60 * 60 * 1000L): WeatherSnapshot? {
        val timestamp = cache.getLong("fetched_at", 0L)
        if (timestamp == 0L || System.currentTimeMillis() - timestamp > maxAgeMillis) return null
        return WeatherSnapshot(
            cache.getLong("temperature", 0L).let(Double::fromBits),
            cache.getLong("apparent", 0L).let(Double::fromBits),
            cache.getInt("code", -1),
            timestamp,
        )
    }

    private fun save(value: WeatherSnapshot) = cache.edit()
        .putLong("temperature", value.temperature.toBits())
        .putLong("apparent", value.apparentTemperature.toBits())
        .putInt("code", value.weatherCode)
        .putLong("fetched_at", value.fetchedAt)
        .apply()
}
