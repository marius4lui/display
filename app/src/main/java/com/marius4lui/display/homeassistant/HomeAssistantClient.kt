package com.marius4lui.display.homeassistant

import com.marius4lui.display.network.HttpClient
import com.marius4lui.display.network.NetworkPolicy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject

data class HaEntity(
    val entityId: String,
    val state: String,
    val friendlyName: String,
    val unit: String?,
    val attributes: JSONObject,
)

class HomeAssistantClient {
    private val _entities = MutableStateFlow<Map<String, HaEntity>>(emptyMap())
    val entities: StateFlow<Map<String, HaEntity>> = _entities.asStateFlow()
    private var socket: WebSocket? = null

    suspend fun test(url: String, token: String, allowHttp: Boolean): Result<String> = runCatching {
        require(token.isNotBlank()) { "Token is required" }
        val base = withContext(Dispatchers.IO) { NetworkPolicy.validateHomeAssistantUrl(url, allowHttp).getOrThrow() }
        val request = Request.Builder().url(base.newBuilder().addPathSegments("api/config").build()).bearer(token).build()
        withContext(Dispatchers.IO) {
            HttpClient.instance.newCall(request).execute().use { response ->
                require(response.isSuccessful) { "Home Assistant returned ${response.code}" }
                JSONObject(response.body!!.string()).optString("location_name", "Home Assistant")
            }
        }
    }

    suspend fun refresh(url: String, token: String, allowHttp: Boolean): List<HaEntity> {
        val base = withContext(Dispatchers.IO) { NetworkPolicy.validateHomeAssistantUrl(url, allowHttp).getOrThrow() }
        val request = Request.Builder().url(base.newBuilder().addPathSegments("api/states").build()).bearer(token).build()
        val result = withContext(Dispatchers.IO) {
            HttpClient.instance.newCall(request).execute().use { response ->
                require(response.isSuccessful) { "Home Assistant returned ${response.code}" }
                parseStates(JSONArray(response.body!!.string()))
            }
        }
        _entities.value = result.associateBy(HaEntity::entityId)
        return result
    }

    suspend fun connectLive(url: String, token: String, allowHttp: Boolean, onFailure: (String) -> Unit = {}) {
        val base = withContext(Dispatchers.IO) { NetworkPolicy.validateHomeAssistantUrl(url, allowHttp).getOrThrow() }
        val socketUrl = base.newBuilder()
            .scheme(if (base.isHttps) "wss" else "ws")
            .addPathSegments("api/websocket")
            .build()
        socket?.close(1000, "Reconnect")
        socket = HttpClient.instance.newWebSocket(Request.Builder().url(socketUrl).build(), object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val message = JSONObject(text)
                    when (message.optString("type")) {
                        "auth_required" -> webSocket.send(JSONObject().put("type", "auth").put("access_token", token).toString())
                        "auth_ok" -> webSocket.send(JSONObject().put("id", 1).put("type", "subscribe_events").put("event_type", "state_changed").toString())
                        "auth_invalid" -> onFailure("Home Assistant authentication failed")
                        "event" -> {
                            val state = message.optJSONObject("event")?.optJSONObject("data")?.optJSONObject("new_state") ?: return
                            val entity = parseState(state)
                            _entities.value = _entities.value + (entity.entityId to entity)
                        }
                    }
                }.onFailure { onFailure(it.message ?: "Invalid Home Assistant event") }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onFailure(t.message ?: "Home Assistant connection lost")
            }
        })
    }

    fun disconnect() {
        socket?.close(1000, "Display stopped")
        socket = null
    }

    suspend fun callService(
        url: String,
        token: String,
        allowHttp: Boolean,
        domain: String,
        service: String,
        entityId: String,
        data: JSONObject = JSONObject(),
    ) {
        require(domain in setOf("switch", "light", "climate")) { "Unsupported domain" }
        val base = withContext(Dispatchers.IO) { NetworkPolicy.validateHomeAssistantUrl(url, allowHttp).getOrThrow() }
        data.put("entity_id", entityId)
        val endpoint = base.newBuilder().addPathSegments("api/services/$domain/$service").build()
        val body = data.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(endpoint).post(body).bearer(token).build()
        withContext(Dispatchers.IO) {
            HttpClient.instance.newCall(request).execute().use { response ->
                require(response.isSuccessful) { "Service call failed (${response.code})" }
            }
        }
    }

    private fun parseStates(array: JSONArray): List<HaEntity> = (0 until array.length()).map { index -> parseState(array.getJSONObject(index)) }

    private fun parseState(item: JSONObject): HaEntity {
        val attributes = item.optJSONObject("attributes") ?: JSONObject()
        return HaEntity(
            item.getString("entity_id"),
            item.optString("state"),
            attributes.optString("friendly_name", item.getString("entity_id")),
            attributes.optString("unit_of_measurement").takeIf(String::isNotBlank),
            attributes,
        )
    }

    private fun Request.Builder.bearer(token: String) = header("Authorization", "Bearer $token")
}
