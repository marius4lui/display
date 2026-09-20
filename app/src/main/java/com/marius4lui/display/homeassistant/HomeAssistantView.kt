package com.marius4lui.display.homeassistant

import android.content.Context
import android.view.Gravity
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.marius4lui.display.storage.DisplaySettings
import com.marius4lui.display.ui.Ui
import com.marius4lui.display.ui.DotLabelView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class HomeAssistantView(
    context: Context,
    private val scope: CoroutineScope,
    private val client: HomeAssistantClient,
    private val config: DisplaySettings,
    private val token: String?,
    private val onBack: () -> Unit,
    private val onConfigure: () -> Unit,
) : LinearLayout(context) {
    private val grid = GridLayout(context).apply { columnCount = 2 }
    private val status = Ui.body(context, "Loading…").apply { textSize = 14f }

    init {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 20), Ui.dp(context, 12), Ui.dp(context, 20), Ui.dp(context, 12))
        setBackgroundColor(Ui.PAPER)
        val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.iconButton(context, Ui.tr("Uhr", "Clock"), "back", onBack), LayoutParams(Ui.dp(context, 100), Ui.dp(context, 48)))
        header.addView(DotLabelView(context, "HOME"), LayoutParams(0, Ui.dp(context, 48), 1f).apply { marginStart = Ui.dp(context, 20) })
        header.addView(Ui.button(context, Ui.tr("Aktualisieren", "Refresh")) { refresh() }, LayoutParams(Ui.dp(context, 130), Ui.dp(context, 48)))
        addView(header)
        Ui.addSpace(this, 14)
        addView(status)
        addView(ScrollView(context).apply { addView(grid) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        refresh()
    }

    private fun refresh() {
        if (!config.homeAssistantEnabled || token.isNullOrBlank()) {
            status.text = "HOME ASSISTANT / " + Ui.tr("NOCH NICHT VERBUNDEN", "NOT CONNECTED")
            grid.removeAllViews()
            val empty = LinearLayout(context).apply {
                orientation = VERTICAL
                gravity = Gravity.CENTER
                background = Ui.panelDrawable(context)
                setPadding(Ui.dp(context, 24), Ui.dp(context, 24), Ui.dp(context, 24), Ui.dp(context, 24))
                addView(DotLabelView(context, "HELLO HOME", centered = true), LayoutParams(-1, Ui.dp(context, 42)))
                Ui.addSpace(this, 10)
                addView(Ui.body(context, Ui.tr("Dein Zuhause. Ein Fingertipp entfernt.", "Your home. One touch away.")).apply { gravity = Gravity.CENTER })
                Ui.addSpace(this, 18)
                addView(Ui.iconButton(context, Ui.tr("Verbinden", "Connect"), "home", onConfigure).apply {
                    background = Ui.panelDrawable(context, Ui.PAPER)
                }, LayoutParams(Ui.dp(context, 230), Ui.dp(context, 48)))
            }
            grid.addView(empty, GridLayout.LayoutParams(GridLayout.spec(0), GridLayout.spec(0, 2, 1f)).apply {
                width = 0
                height = Ui.dp(context, 230)
                topMargin = Ui.dp(context, 12)
            })
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
                    textSize = 17f
                    gravity = Gravity.CENTER
                    maxLines = 2
                })
                addView(TextView(context).apply {
                    text = entity.state + (entity.unit?.let { " $it" } ?: "")
                    setTextColor(Ui.RED)
                    textSize = 24f
                    gravity = Gravity.CENTER
                })
                if (domain == "switch" || domain == "light") {
                    addView(Ui.button(context, if (entity.state == "on") Ui.tr("Ausschalten", "Turn off") else Ui.tr("Einschalten", "Turn on")) {}.apply {
                        background = Ui.panelDrawable(context, Ui.PAPER)
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
                height = Ui.dp(context, 160)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(Ui.dp(context, 5), Ui.dp(context, 5), Ui.dp(context, 5), Ui.dp(context, 5))
            })
        }
    }
}
