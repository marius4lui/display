package com.marius4lui.display.update

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import com.marius4lui.display.BuildConfig
import com.marius4lui.display.network.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

data class ReleaseInfo(val tag: String, val versionCode: Int, val apkUrl: String, val sha256Url: String?, val notes: String)

class UpdateRepository(private val context: Context) {
    suspend fun checkLatest(): ReleaseInfo? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://api.github.com/repos/marius4lui/display/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .build()
        HttpClient.instance.newCall(request).execute().use { response ->
            if (response.code == 404) return@withContext null
            require(response.isSuccessful) { "Update check failed (${response.code})" }
            val root = JSONObject(response.body!!.string())
            if (root.optBoolean("prerelease") || root.optBoolean("draft")) return@withContext null
            val tag = root.getString("tag_name")
            val code = releaseVersionCode(tag) ?: return@withContext null
            if (code <= BuildConfig.VERSION_CODE) return@withContext null
            val assets = root.getJSONArray("assets")
            var apk = ""
            var checksum: String? = null
            for (index in 0 until assets.length()) {
                val asset = assets.getJSONObject(index)
                val name = asset.getString("name")
                if (name.endsWith(".apk")) apk = asset.getString("browser_download_url")
                if (name.endsWith(".sha256")) checksum = asset.getString("browser_download_url")
            }
            if (apk.isBlank()) return@withContext null
            ReleaseInfo(tag, code, apk, checksum, root.optString("body"))
        }
    }

    suspend fun downloadAndVerify(release: ReleaseInfo): File = withContext(Dispatchers.IO) {
        val directory = File(context.cacheDir, "updates").apply { mkdirs() }
        val target = File(directory, "display-${release.tag}.apk")
        HttpClient.instance.newCall(Request.Builder().url(release.apkUrl).build()).execute().use { response ->
            require(response.isSuccessful) { "Download failed (${response.code})" }
            target.outputStream().use { output -> response.body!!.byteStream().copyTo(output) }
        }
        release.sha256Url?.let { checksumUrl ->
            val expected = HttpClient.instance.newCall(Request.Builder().url(checksumUrl).build()).execute().use { response ->
                require(response.isSuccessful) { "Checksum download failed" }
                response.body!!.string().trim().substringBefore(' ').lowercase()
            }
            require(sha256(target) == expected) { "Checksum mismatch" }
        }
        verifyPackageAndSigner(target)
        target
    }

    fun install(file: File) {
        val uri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        context.startActivity(
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun verifyPackageAndSigner(file: File) {
        val flags = PackageManager.GET_SIGNING_CERTIFICATES
        val installed = context.packageManager.getPackageInfo(context.packageName, flags)
        val archive = context.packageManager.getPackageArchiveInfo(file.absolutePath, flags)
            ?: error("Downloaded APK is invalid")
        require(archive.packageName == context.packageName) { "Unexpected package name" }
        val installedSigners = installed.signingInfo?.apkContentsSigners.orEmpty().map { sha256(it.toByteArray()) }.toSet()
        val archiveSigners = archive.signingInfo?.apkContentsSigners.orEmpty().map { sha256(it.toByteArray()) }.toSet()
        require(installedSigners.isNotEmpty() && installedSigners == archiveSigners) { "APK signing certificate mismatch" }
    }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}

internal fun releaseVersionCode(tag: String): Int? {
    val parts = tag.removePrefix("v").split('.')
    if (parts.size != 3) return null
    val numbers = parts.map { it.substringBefore('-').toIntOrNull() ?: return null }
    return numbers[0] * 10_000 + numbers[1] * 100 + numbers[2]
}
