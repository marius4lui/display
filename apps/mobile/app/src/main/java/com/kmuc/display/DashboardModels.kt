package com.kmuc.display

import org.json.JSONObject
import org.json.JSONArray

data class Envelope(
    val schemaVersion: Int,
    val encryptionVersion: Int,
    val iterations: Int,
    val salt: String,
    val iv: String,
    val ciphertext: String,
)

data class PublishedDashboard(val version: Int, val envelope: Envelope)

data class DashboardSettings(
    val configPollSeconds: Int = 30,
    val dataPollSeconds: Int = 300,
    val columns: Int = 12,
    val rows: Int = 8,
    val background: String = "#090b12",
    val foreground: String = "#f6f7fb",
)

data class WidgetStyle(
    val background: String = "#151b2b",
    val foreground: String = "#f6f7fb",
    val accent: String = "#7c5cff",
    val align: String = "left",
)

data class DashboardWidget(
    val id: String,
    val type: String,
    val title: String,
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val staticValue: String?,
    val imageUrl: String?,
    val dataSourceId: String?,
    val jsonPath: String?,
    val format: String?,
    val suffix: String?,
    val animation: String,
    val errorBehavior: String,
    val style: WidgetStyle,
)

data class ApiAuth(
    val type: String,
    val name: String?,
    val value: String?,
    val username: String?,
    val password: String?,
)

data class DashboardDataSource(
    val id: String,
    val name: String,
    val method: String,
    val url: String,
    val headers: Map<String, String>,
    val body: String?,
    val auth: ApiAuth,
    val refreshSeconds: Int?,
)

data class DashboardDocument(
    val name: String,
    val settings: DashboardSettings,
    val widgets: List<DashboardWidget>,
    val dataSources: List<DashboardDataSource>,
)

private fun JSONObject.optionalString(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null

fun parsePublishedDashboard(json: String): PublishedDashboard {
    val root = JSONObject(json)
    val item = root.getJSONObject("envelope")
    return PublishedDashboard(
        version = root.getInt("version"),
        envelope = Envelope(
            schemaVersion = item.getInt("schemaVersion"),
            encryptionVersion = item.getInt("encryptionVersion"),
            iterations = item.getInt("iterations"),
            salt = item.getString("salt"),
            iv = item.getString("iv"),
            ciphertext = item.getString("ciphertext"),
        ),
    )
}

fun parseDashboardDocument(json: String): DashboardDocument {
    val root = JSONObject(json)
    require(root.getInt("schemaVersion") == 1) { "Dashboard-Schema wird nicht unterstützt" }
    val settingsJson = root.getJSONObject("settings")
    val settings = DashboardSettings(
        configPollSeconds = settingsJson.optInt("configPollSeconds", 30).coerceAtLeast(10),
        dataPollSeconds = settingsJson.optInt("dataPollSeconds", 300).coerceAtLeast(10),
        columns = settingsJson.optInt("columns", 12).coerceIn(1, 24),
        rows = settingsJson.optInt("rows", 8).coerceIn(1, 24),
        background = settingsJson.optString("background", "#090b12"),
        foreground = settingsJson.optString("foreground", "#f6f7fb"),
    )
    val widgetsJson = root.getJSONArray("widgets")
    val widgets = buildList {
        for (index in 0 until widgetsJson.length()) {
            val item = widgetsJson.getJSONObject(index)
            val styleJson = item.optJSONObject("style") ?: JSONObject()
            add(DashboardWidget(
                id = item.getString("id"), type = item.getString("type"), title = item.optString("title"),
                x = item.optInt("x").coerceAtLeast(0), y = item.optInt("y").coerceAtLeast(0),
                width = item.optInt("width", 1).coerceAtLeast(1), height = item.optInt("height", 1).coerceAtLeast(1),
                staticValue = item.optionalString("staticValue"), imageUrl = item.optionalString("imageUrl"),
                dataSourceId = item.optionalString("dataSourceId"), jsonPath = item.optionalString("jsonPath"),
                format = item.optionalString("format"), suffix = item.optionalString("suffix"),
                animation = item.optString("animation", "none"), errorBehavior = item.optString("errorBehavior", "stale"),
                style = WidgetStyle(styleJson.optString("background", "#151b2b"), styleJson.optString("foreground", "#f6f7fb"), styleJson.optString("accent", "#7c5cff"), styleJson.optString("align", "left")),
            ))
        }
    }
    val sourcesJson = root.optJSONArray("dataSources")
    val sources = buildList {
        if (sourcesJson != null) for (index in 0 until sourcesJson.length()) {
            val item = sourcesJson.getJSONObject(index)
            val headersJson = item.optJSONObject("headers") ?: JSONObject()
            val headers = buildMap { headersJson.keys().forEach { key -> put(key, headersJson.getString(key)) } }
            val auth = item.optJSONObject("auth") ?: JSONObject().put("type", "none")
            add(DashboardDataSource(
                id = item.getString("id"), name = item.optString("name"), method = item.optString("method", "GET"), url = item.getString("url"), headers = headers,
                body = item.optionalString("body"), auth = ApiAuth(auth.optString("type", "none"), auth.optionalString("name"), auth.optionalString("value"), auth.optionalString("username"), auth.optionalString("password")),
                refreshSeconds = if (item.has("refreshSeconds")) item.getInt("refreshSeconds").coerceAtLeast(10) else null,
            ))
        }
    }
    return DashboardDocument(root.optString("name", "display"), settings, widgets, sources)
}

fun valueAtJsonPath(value: Any?, path: String?): Any? {
    if (path.isNullOrBlank()) return value
    var current = value
    path.removePrefix("$").removePrefix(".").split(".").forEach { key ->
        current = when (current) {
            is JSONObject -> (current as JSONObject).opt(key)
            is JSONArray -> key.toIntOrNull()?.let { (current as JSONArray).opt(it) }
            else -> null
        }
    }
    return current
}
