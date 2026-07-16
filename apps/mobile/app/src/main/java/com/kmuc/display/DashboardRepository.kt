package com.kmuc.display

import android.content.Context
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
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

data class RuntimeValue(val value: Any?, val stale: Boolean = false, val error: String? = null)
private data class HttpResult(val status: Int, val body: String, val etag: String?)

class DashboardController(context: Context) {
    private val store = SecureStore(context)
    var dashboard by mutableStateOf<DashboardDocument?>(null); private set
    var status by mutableStateOf("Nicht verbunden"); private set
    var version by mutableStateOf(0); private set
    var configured by mutableStateOf(store.url() != null && store.passphrase() != null); private set
    val values = mutableStateMapOf<String, RuntimeValue>()
    private val sourceLastRun = ConcurrentHashMap<String, Long>()
    private var job: Job? = null

    fun configure(url: String, passphrase: String, configPollOverride: Int?, dataPollOverride: Int?, scope: CoroutineScope) {
        require(url.startsWith("http://") || url.startsWith("https://")) { "Bitte eine vollständige HTTP(S)-URL eingeben." }
        require(passphrase.length >= 8) { "PIN/Passphrase muss mindestens 8 Zeichen lang sein." }
        store.saveConnection(url.trim(), passphrase, configPollOverride, dataPollOverride)
        configured = true
        start(scope)
    }

    fun start(scope: CoroutineScope) {
        job?.cancel()
        val url = store.url() ?: return
        val secret = store.passphrase() ?: return
        job = scope.launch {
            loadCached(secret)
            var lastConfigurationCheck = 0L
            while (isActive) {
                val now = System.currentTimeMillis()
                val configInterval = (store.configPollOverride() ?: dashboard?.settings?.configPollSeconds ?: 30).coerceAtLeast(10) * 1_000L
                if (now - lastConfigurationCheck >= configInterval) {
                    checkConfiguration(url, secret)
                    lastConfigurationCheck = now
                }
                refreshDueSources()
                delay(1_000L)
            }
        }
    }

    fun reset() { job?.cancel(); store.clear(); configured = false; dashboard = null; values.clear(); status = "Nicht verbunden" }

    private fun loadCached(secret: String) {
        val cached = store.cachedEnvelope() ?: return
        runCatching {
            val published = parsePublishedDashboard(cached)
            dashboard = parseDashboardDocument(DashboardCrypto.decrypt(published.envelope, secret))
            version = published.version
            status = "Offline-Cache · Version $version"
        }
    }

    private suspend fun checkConfiguration(url: String, secret: String) {
        try {
            status = "Prüfe Konfiguration …"
            val response = request(url, store.etag())
            if (response.status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                status = "Live · Version $version"
                return
            }
            val published = parsePublishedDashboard(response.body)
            if (published.version != version || dashboard == null) {
                val candidate = parseDashboardDocument(DashboardCrypto.decrypt(published.envelope, secret))
                dashboard = candidate
                version = published.version
                store.cacheEnvelope(response.body)
                sourceLastRun.clear()
            }
            store.saveEtag(response.etag)
            status = "Live · Version $version"
        } catch (error: Exception) {
            status = if (dashboard != null) "Offline · ${error.message ?: "Verbindungsfehler"}" else "Fehler · ${error.message ?: "Dashboard nicht verfügbar"}"
        }
    }

    private suspend fun refreshDueSources() {
        val current = dashboard ?: return
        val now = System.currentTimeMillis()
        current.dataSources.forEach { source ->
            val interval = (store.dataPollOverride() ?: source.refreshSeconds ?: current.settings.dataPollSeconds).coerceAtLeast(10) * 1_000L
            if (now - (sourceLastRun[source.id] ?: 0L) >= interval) {
                sourceLastRun[source.id] = now
                try { values[source.id] = RuntimeValue(fetchSource(source)) }
                catch (error: Exception) {
                    val previous = values[source.id]
                    values[source.id] = RuntimeValue(previous?.value, stale = previous?.value != null, error = error.message ?: "API-Fehler")
                }
            }
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
        val text = connection.inputStream.bufferedReader().use { it.readText() }
        JSONTokener(text).nextValue()
    }

    private suspend fun request(url: String, etag: String?): HttpResult = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000; connection.readTimeout = 15_000
        if (etag != null) connection.setRequestProperty("If-None-Match", etag)
        val code = connection.responseCode
        if (code == HttpURLConnection.HTTP_NOT_MODIFIED) return@withContext HttpResult(code, "", etag)
        if (code !in 200..299) throw IllegalStateException("HTTP $code")
        HttpResult(code, connection.inputStream.bufferedReader().use { it.readText() }, connection.getHeaderField("ETag"))
    }
}
