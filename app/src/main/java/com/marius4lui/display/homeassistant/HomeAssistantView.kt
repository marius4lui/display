package com.marius4lui.display.homeassistant

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.widget.Button
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.marius4lui.display.storage.DisplaySettings
import com.marius4lui.display.ui.Ui
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class HomeAssistantView(
    context: Context,
    private val scope: CoroutineScope,
    private val client: HomeAssistantClient,
    private val config: DisplaySettings,
    private val token: String?,
    private val onBack: () -> Unit,
) : LinearLayout(context) {
    private val grid = GridLayout(context).apply { columnCount = 4 }
    private val status = Ui.body(context, "Loading…")

    init {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 20), Ui.dp(context, 12), Ui.dp(context, 20), Ui.dp(context, 12))
        setBackgroundColor(Ui.PAPER)
        val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.button(context, "‹ Clock", onBack), LayoutParams(Ui.dp(context, 130), Ui.dp(context, 52)))
        header.addView(Ui.title(context, "HOME"), LayoutParams(0, Ui.dp(context, 52), 1f).apply { marginStart = Ui.dp(context, 20) })
        header.addView(Ui.button(context, "Refresh") { refresh() }, LayoutParams(Ui.dp(context, 120), Ui.dp(context, 52)))
        addView(header)
        addView(status)
        addView(ScrollView(context).apply { addView(grid) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        refresh()
    }

    private fun refresh() {
        if (!config.homeAssistantEnabled || token.isNullOrBlank()) {
            status.text = "Home Assistant is not configured."
            return
        }
        status.text = "Connecting…"
        scope.launch {
            runCatching { client.refresh(config.homeAssistantUrl, token, config.allowPrivateHttp) }
                .onSuccess { entities ->
                    val supported = entities.filter { it.entityId.substringBefore('.') in setOf("sensor", "binary_sensor", "switch", "light", "climate") }
                    status.text = "${supported.size} supported entities"
                    render(supported)
                }
                .onFailure { status.text = it.message ?: "Connection failed" }
        }
    }

    private fun render(entities: List<HaEntity>) {
        grid.removeAllViews()
        val selected = config.homeAssistantEntities
        val ordered = if (selected.isEmpty()) entities.take(12) else selected.mapNotNull { id -> entities.firstOrNull { it.entityId == id } }
        ordered.forEach { entity ->
            val domain = entity.entityId.substringBefore('.')
            val tile = LinearLayout(context).apply {
                orientation = VERTICAL
                gravity = Gravity.CENTER
                setPadding(Ui.dp(context, 10), Ui.dp(context, 8), Ui.dp(context, 10), Ui.dp(context, 8))
                background = Ui.panelDrawable(context)
                addView(TextView(context).apply {
                    text = entity.friendlyName
                    setTextColor(Ui.INK)
                    textSize = 14f
                    gravity = Gravity.CENTER
                    maxLines = 2
                })
                addView(TextView(context).apply {
                    text = entity.state + (entity.unit?.let { " $it" } ?: "")
                    setTextColor(Ui.RED)
                    textSize = 18f
                    gravity = Gravity.CENTER
                })
                if (domain == "switch" || domain == "light") {
                    addView(Button(context).apply {
                        text = if (entity.state == "on") "Turn off" else "Turn on"
                        isAllCaps = false
                        setOnClickListener {
                            isEnabled = false
                            scope.launch {
                                runCatching {
                                    client.callService(config.homeAssistantUrl, token!!, config.allowPrivateHttp, domain, if (entity.state == "on") "turn_off" else "turn_on", entity.entityId)
                                }
                                refresh()
                            }
                        }
                    })
                }
            }
            grid.addView(tile, GridLayout.LayoutParams().apply {
                width = 0
                height = Ui.dp(context, 150)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(Ui.dp(context, 5), Ui.dp(context, 5), Ui.dp(context, 5), Ui.dp(context, 5))
            })
        }
    }
}
