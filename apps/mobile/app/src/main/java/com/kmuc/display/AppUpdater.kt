package com.kmuc.display

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class AvailableUpdate(val version: String, val downloadUrl: String, val notes: String)

class AppUpdater(private val activity: Activity) {
    var update by mutableStateOf<AvailableUpdate?>(null)
        private set
    var promptVisible by mutableStateOf(false)
        private set
    var skipped by mutableStateOf(false)
        private set
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    private var installAfterPermission = false

    fun check(scope: CoroutineScope) = scope.launch {
        val result = withContext(Dispatchers.IO) { fetchLatestRelease() }
        result.onSuccess { latest ->
            if (latest != null && isNewer(latest.version, BuildConfig.VERSION_NAME)) {
                update = latest
                promptVisible = true
            }
        }
    }

    fun skip() {
        promptVisible = false
        skipped = true
    }

    fun showPrompt() {
        promptVisible = true
        skipped = false
    }

    fun manualDownload() {
        update?.let { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it.downloadUrl))) }
    }

    fun install(scope: CoroutineScope) {
        val latest = update ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
            installAfterPermission = true
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            return
        }
        downloadAndInstall(latest, scope)
    }

    fun onResume(scope: CoroutineScope) {
        if (!installAfterPermission) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()) {
            installAfterPermission = false
            update?.let { downloadAndInstall(it, scope) }
        }
    }

    private fun downloadAndInstall(latest: AvailableUpdate, scope: CoroutineScope) = scope.launch {
        busy = true
        message = "Update wird heruntergeladen …"
        val result = withContext(Dispatchers.IO) { downloadApk(latest.downloadUrl) }
        busy = false
        result.onSuccess { apk ->
            message = null
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", apk)
            activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }.onFailure { message = it.message ?: "Update konnte nicht heruntergeladen werden." }
    }

    private fun fetchLatestRelease(): Result<AvailableUpdate?> = runCatching {
        val connection = (URL(BuildConfig.RELEASES_API_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "display-android/${BuildConfig.VERSION_NAME}")
        }
        connection.useResponse { response ->
            if (connection.responseCode !in 200..299) error("Update-Prüfung antwortet mit HTTP ${connection.responseCode}.")
            val release = JSONObject(response)
            val assets = release.optJSONArray("assets") ?: return@useResponse null
            val apk = (0 until assets.length()).mapNotNull(assets::optJSONObject)
                .firstOrNull { it.optString("name") == "display.apk" }
                ?: return@useResponse null
            AvailableUpdate(
                version = release.optString("tag_name").removePrefix("v"),
                downloadUrl = apk.getString("browser_download_url"),
                notes = release.optString("body").take(500),
            )
        }
    }

    private fun downloadApk(downloadUrl: String): Result<File> = runCatching {
        val directory = File(activity.cacheDir, "updates").apply { mkdirs() }
        val target = File(directory, "display-${update?.version ?: "latest"}.apk")
        val connection = (URL(downloadUrl).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 15_000
            readTimeout = 60_000
            setRequestProperty("User-Agent", "display-android/${BuildConfig.VERSION_NAME}")
        }
        if (connection.responseCode !in 200..299) error("Download antwortet mit HTTP ${connection.responseCode}.")
        connection.inputStream.use { input -> target.outputStream().use(input::copyTo) }
        require(target.length() > 0) { "Die heruntergeladene APK ist leer." }
        target
    }

    private fun isNewer(candidate: String, current: String): Boolean {
        val left = candidate.substringBefore('-').split('.').map { it.toIntOrNull() ?: 0 }
        val right = current.substringBefore('-').split('.').map { it.toIntOrNull() ?: 0 }
        for (index in 0 until maxOf(left.size, right.size)) {
            val difference = (left.getOrElse(index) { 0 }).compareTo(right.getOrElse(index) { 0 })
            if (difference != 0) return difference > 0
        }
        return false
    }
}

private inline fun <T> HttpURLConnection.useResponse(block: (String) -> T): T = try {
    block(inputStream.bufferedReader().use { it.readText() })
} finally {
    disconnect()
}
