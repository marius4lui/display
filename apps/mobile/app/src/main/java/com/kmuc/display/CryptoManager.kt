package com.kmuc.display

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec

object DashboardCrypto {
    fun decrypt(envelope: Envelope, passphrase: String): String {
        require(envelope.encryptionVersion == 1) { "Verschlüsselungsversion wird nicht unterstützt" }
        val salt = Base64.decode(envelope.salt, Base64.DEFAULT)
        val iv = Base64.decode(envelope.iv, Base64.DEFAULT)
        val encrypted = Base64.decode(envelope.ciphertext, Base64.DEFAULT)
        val keySpec = PBEKeySpec(passphrase.toCharArray(), salt, envelope.iterations, 256)
        val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(keySpec)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, javax.crypto.spec.SecretKeySpec(key.encoded, "AES"), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(encrypted), StandardCharsets.UTF_8)
    }
}

class SecureStore(private val context: android.content.Context) {
    private val preferences = context.getSharedPreferences("display_secure", android.content.Context.MODE_PRIVATE)
    private val alias = "display-device-key"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }

    fun saveConnection(url: String, passphrase: String, configPollOverride: Int?, dataPollOverride: Int?) {
        val changedUrl = preferences.getString("url", null) != url
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = cipher.doFinal(passphrase.toByteArray(StandardCharsets.UTF_8))
        preferences.edit().putString("url", url).putString("secret", Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).putInt("config_poll", configPollOverride ?: 0).putInt("data_poll", dataPollOverride ?: 0).also { if (changedUrl) it.remove("etag").remove("cached_envelope") }.apply()
    }

    fun url(): String? = preferences.getString("url", null)
    fun configPollOverride(): Int? = preferences.getInt("config_poll", 0).takeIf { it > 0 }
    fun dataPollOverride(): Int? = preferences.getInt("data_poll", 0).takeIf { it > 0 }
    fun passphrase(): String? = try {
        val encrypted = Base64.decode(preferences.getString("secret", null), Base64.DEFAULT)
        val iv = Base64.decode(preferences.getString("iv", null), Base64.DEFAULT)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        String(cipher.doFinal(encrypted), StandardCharsets.UTF_8)
    } catch (_: Exception) { null }

    fun cacheEnvelope(json: String) = preferences.edit().putString("cached_envelope", json).apply()
    fun cachedEnvelope(): String? = preferences.getString("cached_envelope", null)
    fun etag(): String? = preferences.getString("etag", null)
    fun saveEtag(value: String?) = preferences.edit().putString("etag", value).apply()
    fun clear() = preferences.edit().clear().apply()
}
