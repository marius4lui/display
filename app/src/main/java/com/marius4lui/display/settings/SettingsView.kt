package com.marius4lui.display.settings

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.provider.Settings
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import com.marius4lui.display.BuildConfig
import com.marius4lui.display.storage.DisplaySettings
import com.marius4lui.display.storage.SettingsStore
import com.marius4lui.display.ui.DotLabelView
import com.marius4lui.display.ui.Ui

class SettingsView(
    context: Context,
    private val store: SettingsStore,
    private val onBack: () -> Unit,
    private val onApply: () -> Unit,
    private val onChooseHome: () -> Unit,
    private val onCheckUpdate: (TextView) -> Unit,
) : LinearLayout(context) {
    private val content = Ui.column(context)
    private val tabs = LinearLayout(context).apply { orientation = HORIZONTAL }
    private val scroll = ScrollView(context).apply { isFillViewport = true; addView(content) }
    private var selected = 0
    private val names = listOf(Ui.tr("Uhr", "Clock"), Ui.tr("Display", "Display"), "Launcher", Ui.tr("System", "System"))

    init {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 20), Ui.dp(context, 10), Ui.dp(context, 20), Ui.dp(context, 10))
        setBackgroundColor(Ui.PAPER)
        val header = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(Ui.iconButton(context, Ui.tr("Uhr", "Clock"), "back", onBack), LayoutParams(Ui.dp(context, 105), Ui.dp(context, 52)))
        header.addView(DotLabelView(context, "SETTINGS"), LayoutParams(Ui.dp(context, 180), Ui.dp(context, 52)).apply {
            marginStart = Ui.dp(context, 16)
        })
        header.addView(tabs, LayoutParams(0, Ui.dp(context, 52), 1f).apply { marginStart = Ui.dp(context, 10) })
        addView(header)
        addView(scroll, LayoutParams(-1, 0, 1f))
        select(0)
    }

    private fun select(index: Int) {
        selected = index
        tabs.removeAllViews()
        names.forEachIndexed { i, name ->
            val label = (if (i == selected) "● " else "") + name
            tabs.addView(Ui.button(context, label) { select(i) }.apply {
                gravity = Gravity.CENTER
                textSize = 14f
                setPadding(Ui.dp(context, 4), 0, Ui.dp(context, 4), 0)
                setTextColor(if (i == selected) Ui.RED else Ui.MUTED)
                if (i != selected) background = Ui.panelDrawable(context, Ui.PAPER)
            }, LayoutParams(0, Ui.dp(context, 50), 1f).apply {
                if (i > 0) marginStart = Ui.dp(context, 2)
            })
        }
        content.removeAllViews()
        scroll.scrollTo(0, 0)
        val current = store.current()
        when (index) {
            0 -> {
                toggle(Ui.tr("24-Stunden-Format", "24-hour format"), Ui.tr("Zeit auf einen Blick.", "Time at a glance."), current.use24Hour) { s, v -> s.copy(use24Hour = v) }
                toggle(Ui.tr("Sekunden", "Seconds"), Ui.tr("Kleiner Sekundenzähler und roter Zeiger.", "Small seconds counter and red hand."), current.showSeconds) { s, v -> s.copy(showSeconds = v) }
                toggle(Ui.tr("Datum", "Date"), Ui.tr("Kalenderkarte neben der Uhr.", "Calendar card next to the clock."), current.showDate) { s, v -> s.copy(showDate = v) }
            }
            1 -> {
                toggle(Ui.tr("Automatische Helligkeit", "Adaptive brightness"), Ui.tr("Passt sich dem Umgebungslicht an.", "Follows the ambient light."), current.autoBrightness) { s, v -> s.copy(autoBrightness = v) }
                toggle(Ui.tr("Display anlassen", "Keep awake"), Ui.tr("Solange Display geöffnet ist.", "While Display is open."), current.keepScreenOn) { s, v -> s.copy(keepScreenOn = v) }
                toggle(Ui.tr("Vollbild", "Full screen"), Ui.tr("Systemleisten mit einer Randgeste einblenden.", "Swipe from an edge to reveal system bars."), current.immersive) { s, v -> s.copy(immersive = v) }
                slider(Ui.tr("Minimum", "Minimum"), current.minBrightness) { value ->
                    store.update { it.copy(minBrightness = value.coerceAtMost(it.maxBrightness)) }
                    store.current().minBrightness
                }
                slider(Ui.tr("Maximum", "Maximum"), current.maxBrightness) { value ->
                    store.update { it.copy(maxBrightness = value.coerceAtLeast(it.minBrightness)) }
                    store.current().maxBrightness
                }
            }
            2 -> {
                action(Ui.tr("Als Startseite festlegen", "Set as home"), Ui.tr("Display mit der Home-Taste öffnen.", "Open Display with the Home button."), onChooseHome)
                action(Ui.tr("Android-Startseite", "Android Home settings"), Ui.tr("Einen anderen Launcher auswählen.", "Choose another launcher.")) {
                    context.startActivity(Intent(Settings.ACTION_HOME_SETTINGS))
                }
                action(Ui.tr("Ausgeblendete Apps zurückholen", "Restore hidden apps"), Ui.tr("Alle Apps wieder im Menü anzeigen.", "Show all apps in the drawer again.")) {
                    store.update { it.copy(hiddenPackages = emptySet()) }
                    select(2)
                }
            }
            3 -> {
                val updateStatus = Ui.body(context, "Display " + BuildConfig.VERSION_NAME)
                val card = card()
                card.addView(Ui.title(context, "Display Updates").apply { textSize = 20f })
                card.addView(updateStatus)
                Ui.addSpace(card, 12)
                card.addView(Ui.button(context, Ui.tr("Nach Updates suchen", "Check for updates")) { onCheckUpdate(updateStatus) }.apply {
                    background = Ui.panelDrawable(context, Ui.PAPER)
                })
                toggle(Ui.tr("Updates automatisch prüfen", "Automatic update checks"), "GitHub Releases", current.autoUpdateCheck) { s, v -> s.copy(autoUpdateCheck = v) }
                action(Ui.tr("Einrichtung öffnen", "Open setup"), Ui.tr("Wetter und Home Assistant einrichten.", "Set up weather and Home Assistant.")) {
                    store.update { it.copy(setupComplete = false) }
                    onApply()
                }
                Ui.addSpace(content, 8)
                content.addView(Ui.body(context, "${android.os.Build.MODEL} · Android ${android.os.Build.VERSION.RELEASE}").apply { textSize = 11f })
            }
        }
    }

    private fun card(): LinearLayout = LinearLayout(context).apply {
        orientation = VERTICAL
        background = Ui.panelDrawable(context)
        setPadding(Ui.dp(context, 18), Ui.dp(context, 14), Ui.dp(context, 18), Ui.dp(context, 14))
        content.addView(this, LayoutParams(-1, -2).apply { bottomMargin = Ui.dp(context, 8) })
    }

    private fun toggle(title: String, subtitle: String, value: Boolean, change: (DisplaySettings, Boolean) -> DisplaySettings) {
        val row = card().apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; minimumHeight = Ui.dp(context, 72) }
        val text = LinearLayout(context).apply {
            orientation = VERTICAL
            addView(Ui.title(context, title).apply { textSize = 18f })
            addView(Ui.body(context, subtitle).apply { textSize = 13f })
        }
        row.addView(text, LayoutParams(0, -2, 1f))
        val control = Switch(context).apply {
            contentDescription = title
            isChecked = value
            minWidth = Ui.dp(context, 50)
            minHeight = Ui.dp(context, 48)
            thumbTintList = ColorStateList.valueOf(Ui.SURFACE)
            trackTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(Ui.RED, Ui.MUTED))
            setOnCheckedChangeListener { _, enabled -> store.update { change(it, enabled) } }
        }
        row.addView(control)
        row.setOnClickListener { control.isChecked = !control.isChecked }
    }

    private fun slider(title: String, value: Int, change: (Int) -> Int) {
        val panel = card()
        val label = Ui.body(context, "$title · ${value * 100 / 255}%")
        panel.addView(label)
        panel.addView(SeekBar(context).apply {
            max = 255; progress = value; minHeight = Ui.dp(context, 48)
            progressTintList = ColorStateList.valueOf(Ui.RED)
            thumbTintList = ColorStateList.valueOf(Ui.RED)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seek: SeekBar, progress: Int, fromUser: Boolean) {
                    label.text = "$title · ${progress * 100 / 255}%"
                    if (fromUser) {
                        val saved = change(progress)
                        if (saved != progress) seek.progress = saved
                    }
                }
                override fun onStartTrackingTouch(seek: SeekBar) = Unit
                override fun onStopTrackingTouch(seek: SeekBar) = Unit
            })
        })
    }

    private fun action(title: String, subtitle: String, action: () -> Unit) {
        card().apply {
            minimumHeight = Ui.dp(context, 74)
            addView(Ui.title(context, "$title  →").apply { textSize = 18f })
            addView(Ui.body(context, subtitle).apply { textSize = 13f })
            isFocusable = true
            setOnClickListener { action() }
        }
    }
}
