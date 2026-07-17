package com.kmuc.display

import android.content.Context
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONTokener
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

data class RuntimeValue(val value: Any?, val stale: Boolean = false, val error: String? = null, val history: List<Any?> = emptyList())
private data class HttpResult(val status: Int, val body: String, val etag: String?)

private fun httpFailure(connection: HttpURLConnection): IllegalStateException {
    val body = runCatching { connection.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull().orEmpty()
    val message = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull().takeUnless { it.isNullOrBlank() }
        ?: body.take(240).takeIf { it.isNotBlank() }
        ?: "Serverfehler"
    Log.e("DisplayHttp", "${connection.requestMethod} ${connection.url} -> ${connection.responseCode}: $message")
    return IllegalStateException("HTTP ${connection.responseCode} · $message")
}

class DashboardController(context: Context) {
    private val store = SecureStore(context)
    var dashboard by mutableStateOf<DashboardDocument?>(null); private set
    var status by mutableStateOf("Nicht verbunden"); private set
    var version by mutableStateOf(0); private set
    var configured by mutableStateOf(store.url() != null && store.deviceToken() != null); private set
    val values = mutableStateMapOf<String, RuntimeValue>()
    private val sourceLastRun = ConcurrentHashMap<String, Long>()
    private var job: Job? = null
    private var lastHeartbeat = 0L

    fun connectWithCode(url: String, pairingCode: String, configPollOverride: Int?, dataPollOverride: Int?, scope: CoroutineScope) {
        require(url.startsWith("http://") || url.startsWith("https://")) { "Bitte eine vollständige HTTP(S)-URL eingeben." }
        require(pairingCode.matches(Regex("\\d{6}"))) { "Pairing-Code muss 6-stellig sein." }
        connect(url, pairingCode, configPollOverride, dataPollOverride, scope)
    }

    fun connectWithQrToken(url: String, pairingToken: String, scope: CoroutineScope) {
        require(url.startsWith("http://") || url.startsWith("https://")) { "Dashboard-URL im QR-Code ist ungültig." }
        require(pairingToken.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { "QR-Code ist ungültig." }
        connect(url, pairingToken, null, null, scope)
    }

    private fun connect(url: String, pairingSecret: String, configPollOverride: Int?, dataPollOverride: Int?, scope: CoroutineScope) {
        job?.cancel()
        dashboard = null
        values.clear()
        version = 0
        status = "Gerät wird gekoppelt …"
        scope.launch {
            try {
                val token = pair(url.trim(), pairingSecret)
                store.saveConnection(url.trim(), token, configPollOverride, dataPollOverride)
                configured = true
                start(scope)
            } catch (error: Exception) { status = "Pairing fehlgeschlagen · ${error.userMessage()}" }
        }
    }

    fun browserConnectUrl(displayUrl: String): String {
        require(displayUrl.startsWith("http://") || displayUrl.startsWith("https://")) { "Bitte eine vollständige Dashboard-URL eingeben." }
        val parsed = URL(displayUrl.trim()); val displayId = parsed.path.trimEnd('/').substringAfterLast('/')
        require(displayId.matches(Regex("[A-Za-z0-9_-]{8,32}"))) { "Dashboard-URL ist ungültig." }
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); store.savePendingState(state)
        return "${parsed.protocol}://${parsed.authority}/connect/$displayId?state=$state"
    }

    fun acceptBrowserConnection(state: String, url: String, token: String, scope: CoroutineScope): Boolean {
        if (!store.consumePendingState(state) || !url.startsWith("http") || token.length < 20) return false
        store.saveConnection(url, token); configured = true; status = "Verbunden"; start(scope); return true
    }

    fun start(scope: CoroutineScope) {
        job?.cancel()
        val url = store.url() ?: return
        job = scope.launch {
            loadCached()
            var lastConfigurationCheck = 0L
            while (isActive) {
                val now = System.currentTimeMillis()
                val configInterval = (store.configPollOverride() ?: dashboard?.settings?.configPollSeconds ?: 30).coerceAtLeast(10) * 1_000L
                if (now - lastConfigurationCheck >= configInterval) {
                    checkConfiguration(url)
                    lastConfigurationCheck = now
                }
                refreshDueSources()
                if (now - lastHeartbeat >= 60_000L) { sendHeartbeat(url); lastHeartbeat = now }
                delay(1_000L)
            }
        }
    }

    fun reset() { job?.cancel(); store.clear(); configured = false; dashboard = null; values.clear(); status = "Nicht verbunden" }

    private fun loadCached() {
        val cached = store.cachedDocument() ?: return
        runCatching {
            val published = parsePublishedDashboard(cached)
            dashboard = published.document
            version = published.version
            status = "Offline-Cache · Version $version"
        }
    }

    private suspend fun checkConfiguration(url: String) {
        try {
            status = "Prüfe Konfiguration …"
            val response = request(url, if (dashboard != null) store.etag() else null)
            if (response.status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                status = "Live · Version $version"
                return
            }
            val published = parsePublishedDashboard(response.body)
            dashboard = published.document
            version = published.version
            val dashboardId = URL(url).path.trimEnd('/').substringAfterLast('/')
            store.cacheDocument(dashboardId, published.version, response.body)
            sourceLastRun.clear()
            store.saveEtag(response.etag)
            status = "Live · Version $version"
        } catch (error: Exception) {
            val message = error.userMessage()
            status = if (dashboard != null) "Offline · $message" else "Fehler · $message"
        }
    }

    private suspend fun refreshDueSources() {
        val current = dashboard ?: return
        if (current.dataSources.isEmpty()) return
        val now = System.currentTimeMillis()
        for (source in current.dataSources) {
            val interval = (store.dataPollOverride() ?: source.refreshSeconds ?: current.settings.dataPollSeconds).coerceAtLeast(10) * 1_000L
            if (now - (sourceLastRun[source.id] ?: 0L) < interval) continue
            sourceLastRun[source.id] = now
            try {
                val result = fetchSource(source)
                val previous = values[source.id]
                values[source.id] = RuntimeValue(
                    value = result,
                    history = (previous?.history.orEmpty() + result).takeLast(2_048),
                )
            } catch (error: Exception) {
                val previous = values[source.id]
                values[source.id] = RuntimeValue(
                    value = previous?.value,
                    stale = previous?.value != null,
                    error = error.sourceUserMessage(),
                    history = previous?.history.orEmpty(),
                )
            }
        }
    }

    private suspend fun sendHeartbeat(url: String) = withContext(Dispatchers.IO) {
        runCatching {
            val connection = URL(url.trimEnd('/') + "/heartbeat").openConnection() as HttpURLConnection
            connection.requestMethod="POST"; connection.doOutput=true; connection.connectTimeout=10_000
            connection.setRequestProperty("Authorization", "Bearer ${store.deviceToken().orEmpty()}"); connection.setRequestProperty("Content-Type","application/json")
            val body=JSONObject().put("appVersion",BuildConfig.VERSION_NAME).put("platformVersion",android.os.Build.VERSION.RELEASE).put("dashboardVersion",version).put("lastSyncAt",java.time.Instant.now().toString())
            connection.outputStream.use { it.write(body.toString().toByteArray()) }; connection.responseCode
        }
    }

    private suspend fun fetchSource(source: DashboardDataSource): Any = withContext(Dispatchers.IO) {
        val connection = URL(source.url).openConnection() as HttpURLConnection
        connection.requestMethod = source.method
        connection.connectTimeout = 10_000; connection.readTimeout = 15_000
        source.headers.forEach(connection::setRequestProperty)
        when (source.auth.type) {
            "bearer" -> connection.setRequestProperty("Authorization", "Bearer ${source.auth.value.orEmpty()}")
            "apiKey" -> connection.setRequestProperty(source.auth.name ?: "X-API-Key", source.auth.value.orEmpty())
            "basic" -> connection.setRequestProperty("Authorization", "Basic ${Base64.getEncoder().encodeToString("${source.auth.username.orEmpty()}:${source.auth.password.orEmpty()}".toByteArray())}")
        }
        if (source.method != "GET" && source.body != null) {
            connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(source.body.toByteArray()) }
        }
        val code = connection.responseCode
        if (code !in 200..299) throw IllegalStateException("HTTP $code")
        val bytes = connection.inputStream.use { it.readNBytes(1_048_577) }
        if (bytes.size > 1_048_576) throw IllegalStateException("Antwort überschreitet 1 MB")
        JSONTokener(String(bytes, Charsets.UTF_8)).nextValue()
    }

    private suspend fun request(url: String, etag: String?): HttpResult = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000; connection.readTimeout = 15_000
        if (etag != null) connection.setRequestProperty("If-None-Match", etag)
        connection.setRequestProperty("Authorization", "Bearer ${store.deviceToken().orEmpty()}")
        val code = connection.responseCode
        if (code == HttpURLConnection.HTTP_NOT_MODIFIED) return@withContext HttpResult(code, "", etag)
        if (code !in 200..299) throw httpFailure(connection)
        HttpResult(code, connection.inputStream.bufferedReader().use { it.readText() }, connection.getHeaderField("ETag"))
    }

    private suspend fun pair(displayUrl: String, code: String): String = withContext(Dispatchers.IO) {
        val parsed = URL(displayUrl); val displayId = parsed.path.trimEnd('/').substringAfterLast('/');
        val endpoint = URL("${parsed.protocol}://${parsed.authority}/api/device/pair")
        val connection = endpoint.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"; connection.doOutput = true; connection.connectTimeout = 10_000; connection.readTimeout = 15_000
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(JSONObject().put("displayId", displayId).put("code", code).put("name", android.os.Build.MODEL).toString().toByteArray()) }
        if (connection.responseCode !in 200..299) throw httpFailure(connection)
        JSONObject(connection.inputStream.bufferedReader().use { it.readText() }).getString("deviceToken")
    }
}

private fun Throwable.userMessage(): String = message?.takeIf { it.isNotBlank() } ?: "Dashboard nicht verfügbar"

private fun Throwable.sourceUserMessage(): String = when (this) {
    is java.net.SocketTimeoutException -> "Zeitüberschreitung"
    is java.net.UnknownHostException -> "Server nicht gefunden"
    is javax.net.ssl.SSLException -> "Sichere Verbindung fehlgeschlagen"
    is org.json.JSONException -> "Antwort ist kein gültiges JSON"
    is IllegalStateException -> message?.takeIf { it.startsWith("HTTP ") || it == "Antwort überschreitet 1 MB" } ?: "Datenquelle nicht verfügbar"
    else -> "Datenquelle nicht verfügbar"
}
