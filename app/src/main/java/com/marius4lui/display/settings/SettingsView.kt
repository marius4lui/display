package com.marius4lui.display.settings

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.provider.Settings
import android.view.Gravity
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import com.marius4lui.display.BuildConfig
import com.marius4lui.display.storage.SettingsStore
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

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.PAPER)
        val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.button(context, "‹ Clock", onBack), LayoutParams(Ui.dp(context, 130), Ui.dp(context, 52)))
        header.addView(Ui.title(context, "SETTINGS"), LayoutParams(0, Ui.dp(context, 52), 1f).apply { marginStart = Ui.dp(context, 20) })
        addView(header)
        addView(ScrollView(context).apply { addView(content) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        build()
    }

    private fun build() {
        val current = store.current()
        section("Clock & appearance")
        val hour24 = check("24-hour time", current.use24Hour)
        val seconds = check("Show seconds", current.showSeconds)
        val date = check("Show date", current.showDate)
        content.addView(Ui.body(context, "White mode is the fixed Display design."))

        section("Display")
        val automatic = check("Automatic ambient brightness", current.autoBrightness)
        val awake = check("Keep display on", current.keepScreenOn)
        val immersive = check("Hide system bars", current.immersive)
        content.addView(Ui.body(context, "Minimum brightness"))
        val minimum = seek(current.minBrightness)
        content.addView(Ui.body(context, "Maximum brightness"))
        val maximum = seek(current.maxBrightness)

        section("Launcher")
        content.addView(Ui.button(context, "Choose Display as Home app", onChooseHome))
        content.addView(Ui.button(context, "Open Android Home settings") {
            context.startActivity(Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        })
        content.addView(Ui.button(context, "Show all hidden apps") {
            store.update { it.copy(hiddenPackages = emptySet()) }
        })

        section("Updates & diagnostics")
        val updateStatus = Ui.body(context, "Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
        content.addView(updateStatus)
        content.addView(Ui.button(context, "Check GitHub for updates") { onCheckUpdate(updateStatus) })
        content.addView(Ui.body(context, "Package: ${context.packageName}\nDevice: ${android.os.Build.MODEL}\nAndroid ${android.os.Build.VERSION.RELEASE} / API ${android.os.Build.VERSION.SDK_INT}"))

        section("Apply")
        content.addView(Ui.button(context, "Save settings") {
            store.update {
                it.copy(
                    use24Hour = hour24.isChecked,
                    showSeconds = seconds.isChecked,
                    showDate = date.isChecked,
                    autoBrightness = automatic.isChecked,
                    keepScreenOn = awake.isChecked,
                    immersive = immersive.isChecked,
                    minBrightness = minimum.progress.coerceAtMost(maximum.progress),
                    maxBrightness = maximum.progress.coerceAtLeast(minimum.progress),
                )
            }
            onApply()
        })
        content.addView(Ui.button(context, "Run setup again") {
            store.update { it.copy(setupComplete = false) }
            onApply()
        })
    }

    private fun section(label: String) {
        Ui.addSpace(content, 14)
        content.addView(TextView(context).apply {
            text = label.uppercase()
            textSize = 13f
            setTextColor(Ui.RED)
        })
    }

    private fun check(label: String, value: Boolean) = CheckBox(context).apply {
        text = label
        isChecked = value
        setTextColor(Ui.INK)
        minHeight = Ui.dp(context, 50)
        content.addView(this)
    }

    private fun seek(value: Int) = SeekBar(context).apply {
        max = 255
        progress = value
        minHeight = Ui.dp(context, 42)
        content.addView(this)
    }
}
