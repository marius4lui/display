package com.kmuc.display

import org.json.JSONObject
import org.json.JSONArray

data class PublishedDashboard(val version: Int, val document: DashboardDocument)

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
    val verticalAlign: String = "center",
    val fontScale: Int = 100,
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
    val slideshowSeconds: Int,
    val imageFit: String,
    val showCaption: Boolean,
    val dataSourceId: String?,
    val jsonPath: String?,
    val format: String?,
    val suffix: String?,
    val min: Double?,
    val max: Double?,
    val listTitlePath: String?,
    val listSubtitlePath: String?,
    val maxItems: Int,
    val chartType: String?,
    val historyDays: Int,
    val statusMap: JSONObject?,
    val conditionalRules: JSONArray?,
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

data class DashboardPage(val id: String, val name: String, val widgets: List<DashboardWidget>)
data class PageNavigation(
    val visible: Boolean = true,
    val x: Int = 4,
    val y: Int = 7,
    val width: Int = 4,
    val height: Int = 1,
    val style: WidgetStyle = WidgetStyle(align = "center"),
)

data class DashboardDocument(
    val name: String,
    val settings: DashboardSettings,
    val pages: List<DashboardPage>,
    val pageNavigation: PageNavigation,
    val dataSources: List<DashboardDataSource>,
    val customUi: JSONObject?,
)

private fun JSONObject.optionalString(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null

fun parsePublishedDashboard(json: String): PublishedDashboard {
    val root = JSONObject(json)
    return PublishedDashboard(
        version = root.getInt("version"),
        document = parseDashboardDocument(root.getJSONObject("document").toString()),
    )
}

fun parseDashboardDocument(json: String): DashboardDocument {
    val root = JSONObject(json)
    val schemaVersion = root.getInt("schemaVersion")
    require(schemaVersion in 1..6) { "Dashboard-Schema wird nicht unterstützt" }
    val settingsJson = root.getJSONObject("settings")
    val settings = DashboardSettings(
        configPollSeconds = settingsJson.optInt("configPollSeconds", 30).coerceAtLeast(10),
        dataPollSeconds = settingsJson.optInt("dataPollSeconds", 300).coerceAtLeast(10),
        columns = settingsJson.optInt("columns", 12).coerceIn(1, 24),
        rows = settingsJson.optInt("rows", 8).coerceIn(1, 24),
        background = settingsJson.optString("background", "#090b12"),
        foreground = settingsJson.optString("foreground", "#f6f7fb"),
    )
    fun parseWidgets(widgetsJson: JSONArray) = buildList {
        for (index in 0 until widgetsJson.length()) {
            val item = widgetsJson.getJSONObject(index)
            val styleJson = item.optJSONObject("style") ?: JSONObject()
            add(DashboardWidget(
                id = item.getString("id"), type = item.getString("type"), title = item.optString("title"),
                x = item.optInt("x").coerceAtLeast(0), y = item.optInt("y").coerceAtLeast(0),
                width = item.optInt("width", 1).coerceAtLeast(1), height = item.optInt("height", 1).coerceAtLeast(1),
                staticValue = item.optionalString("staticValue"), imageUrl = item.optionalString("imageUrl"),
                slideshowSeconds = item.optInt("slideshowSeconds", 10).coerceIn(0, 3600), imageFit = item.optString("imageFit", "cover"), showCaption = item.optBoolean("showCaption", true),
                dataSourceId = item.optionalString("dataSourceId"), jsonPath = item.optionalString("jsonPath"),
                format = item.optionalString("format"), suffix = item.optionalString("suffix"),
                min = if (item.has("min")) item.optDouble("min") else null, max = if (item.has("max")) item.optDouble("max") else null,
                listTitlePath = item.optionalString("listTitlePath"), listSubtitlePath = item.optionalString("listSubtitlePath"),
                maxItems = item.optInt("maxItems", 5), chartType = item.optionalString("chartType"), historyDays = item.optInt("historyDays", 1),
                statusMap = item.optJSONObject("statusMap"), conditionalRules = item.optJSONArray("conditionalRules"),
                animation = item.optString("animation", "none"), errorBehavior = item.optString("errorBehavior", "stale"),
                style = WidgetStyle(
                    styleJson.optString("background", "#151b2b"),
                    styleJson.optString("foreground", "#f6f7fb"),
                    styleJson.optString("accent", "#7c5cff"),
                    styleJson.optString("align", "left"),
                    styleJson.optString("verticalAlign", "center"),
                    styleJson.optInt("fontScale", 100).coerceIn(25, 300),
                ),
            ))
        }
    }
    val pages = if (schemaVersion == 1) listOf(DashboardPage("legacy", "Seite 1", parseWidgets(root.getJSONArray("widgets")))) else buildList {
        val pagesJson = root.getJSONArray("pages")
        for (index in 0 until pagesJson.length()) {
            val item = pagesJson.getJSONObject(index)
            add(DashboardPage(item.getString("id"), item.optString("name", "Seite ${index + 1}"), parseWidgets(item.getJSONArray("widgets"))))
        }
    }
    require(pages.isNotEmpty()) { "Dashboard benötigt mindestens eine Seite" }
    val navJson = root.optJSONObject("pageNavigation") ?: JSONObject()
    val navStyle = navJson.optJSONObject("style") ?: JSONObject()
    val pageNavigation = PageNavigation(
        visible = navJson.optBoolean("visible", true), x = navJson.optInt("x", 4), y = navJson.optInt("y", 7),
        width = navJson.optInt("width", 4).coerceAtLeast(1), height = navJson.optInt("height", 1).coerceAtLeast(1),
        style = WidgetStyle(navStyle.optString("background", "#151b2b"), navStyle.optString("foreground", "#f6f7fb"), navStyle.optString("accent", "#7c5cff"), navStyle.optString("align", "center")),
    )
    val sourcesJson = root.optJSONArray("dataSources")
    val sources = buildList {
        if (sourcesJson != null) for (index in 0 until sourcesJson.length()) {
            val item = sourcesJson.getJSONObject(index)
            val headersJson = item.optJSONObject("headers") ?: JSONObject()
            val headers = buildMap { headersJson.keys().forEach { key -> put(key, headersJson.getString(key)) } }
            val auth = item.optJSONObject("auth") ?: JSONObject().put("type", "none")
            add(DashboardDataSource(
                id = item.getString("id"), name = item.optString("name"), method = item.optString("method", "GET"), url = item.optString("url"), headers = headers,
                body = item.optionalString("body"), auth = ApiAuth(auth.optString("type", "none"), auth.optionalString("name"), auth.optionalString("value"), auth.optionalString("username"), auth.optionalString("password")),
                refreshSeconds = if (item.has("refreshSeconds")) item.getInt("refreshSeconds").coerceAtLeast(10) else null,
            ))
        }
    }
    return DashboardDocument(root.optString("name", "display"), settings, pages, pageNavigation, sources, root.optJSONObject("customUi"))
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
