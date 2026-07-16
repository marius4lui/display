package com.kmuc.display

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureStore(private val context: android.content.Context) {
    private val preferences = context.getSharedPreferences("display_secure", android.content.Context.MODE_PRIVATE)
    private val alias = "display-device-key"

    init { preferences.edit().remove("secret").remove("iv").remove("cached_envelope").apply() }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }

    fun saveConnection(url: String, deviceToken: String, configPollOverride: Int? = null, dataPollOverride: Int? = null) {
        val changedUrl = preferences.getString("url", null) != url
        val tokenCipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encryptedToken = tokenCipher.doFinal(deviceToken.toByteArray(Charsets.UTF_8))
        preferences.edit().putString("url", url).remove("secret").remove("iv").putString("device_token", Base64.encodeToString(encryptedToken, Base64.NO_WRAP)).putString("device_token_iv", Base64.encodeToString(tokenCipher.iv, Base64.NO_WRAP)).putInt("config_poll", configPollOverride ?: 0).putInt("data_poll", dataPollOverride ?: 0).also { if (changedUrl) it.remove("etag").remove("cached_document") }.apply()
    }

    fun url(): String? = preferences.getString("url", null)
    fun configPollOverride(): Int? = preferences.getInt("config_poll", 0).takeIf { it > 0 }
    fun dataPollOverride(): Int? = preferences.getInt("data_poll", 0).takeIf { it > 0 }
    fun deviceToken(): String? = try {
        val encrypted = Base64.decode(preferences.getString("device_token", null), Base64.DEFAULT)
        val iv = Base64.decode(preferences.getString("device_token_iv", null), Base64.DEFAULT)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        String(cipher.doFinal(encrypted), Charsets.UTF_8)
    } catch (_: Exception) { null }

    fun cacheDocument(json: String) = preferences.edit().putString("cached_document", json).apply()
    fun cachedDocument(): String? = preferences.getString("cached_document", null)
    fun savePendingState(value: String) = preferences.edit().putString("pending_state", value).apply()
    fun consumePendingState(value: String): Boolean {
        if (preferences.getString("pending_state", null) != value) return false
        preferences.edit().remove("pending_state").apply(); return true
    }
    fun etag(): String? = preferences.getString("etag", null)
    fun saveEtag(value: String?) = preferences.edit().putString("etag", value).apply()
    fun clear() = preferences.edit().clear().apply()
}
