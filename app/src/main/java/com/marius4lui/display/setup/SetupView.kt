package com.marius4lui.display.setup

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.text.InputType
import android.view.Gravity
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import com.marius4lui.display.homeassistant.HomeAssistantClient
import com.marius4lui.display.storage.SecureTokenStore
import com.marius4lui.display.storage.SettingsStore
import com.marius4lui.display.ui.Ui
import com.marius4lui.display.weather.Place
import com.marius4lui.display.weather.WeatherRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class SetupView(
    context: Context,
    private val scope: CoroutineScope,
    private val settings: SettingsStore,
    private val secrets: SecureTokenStore,
    private val onComplete: () -> Unit,
) : LinearLayout(context) {
    private val content = Ui.column(context)
    private val navigation = LinearLayout(context).apply {
        gravity = Gravity.END or Gravity.CENTER_VERTICAL
        setPadding(Ui.dp(context, 28), Ui.dp(context, 8), Ui.dp(context, 28), Ui.dp(context, 14))
        setBackgroundColor(Ui.PAPER)
    }
    private val progress = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
        max = 6
        progressTintList = ColorStateList.valueOf(Ui.RED)
        progressBackgroundTintList = ColorStateList.valueOf(Ui.LINE)
    }
    private var page = 0
    private var selectedPlace: Place? = null

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.PAPER)
        addView(progress, LayoutParams(LayoutParams.MATCH_PARENT, Ui.dp(context, 3)))
        addView(ScrollView(context).apply {
            isFillViewport = true
            overScrollMode = OVER_SCROLL_IF_CONTENT_SCROLLS
            addView(content, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        addView(navigation, LayoutParams(LayoutParams.MATCH_PARENT, Ui.dp(context, 76)))
        showPage()
    }

    private fun showPage() {
        content.removeAllViews()
        navigation.removeAllViews()
        progress.progress = page + 1
        when (page) {
            0 -> welcome()
            1 -> clock()
            2 -> display()
            3 -> weather()
            4 -> homeAssistant()
            else -> finish()
        }
    }

    private fun heading(number: String, label: String, copy: String? = null) {
        content.addView(Ui.body(context, "SETUP  $number / 06").apply {
            setTextColor(Ui.RED)
            textSize = 12f
            letterSpacing = 0.12f
        })
        Ui.addSpace(content, 4)
        content.addView(Ui.title(context, label))
        copy?.let { Ui.addSpace(content, 8); content.addView(Ui.body(context, it)) }
        Ui.addSpace(content, 12)
    }

    private fun welcome() {
        heading("01", "DISPLAY", "A focused clock and launcher for Echo Show 5 on LineageOS.")
        content.addView(infoCard("DEVICE", "${android.os.Build.MODEL}\nAndroid ${android.os.Build.VERSION.RELEASE}\n${resources.displayMetrics.widthPixels} x ${resources.displayMetrics.heightPixels}"))
        Ui.addSpace(content, 10)
        content.addView(Ui.body(context, "Quickstep remains installed. You can restore it at any time from Android settings or ADB."))
        setNavigation("START") { page++; showPage() }
    }

    private fun clock() {
        heading("02", "CLOCK", "Keep the face calm. Show only what is useful at a distance.")
        val hour24 = check("24-HOUR TIME", settings.current().use24Hour)
        val seconds = check("SHOW SECONDS", settings.current().showSeconds)
        val date = check("SHOW DATE", settings.current().showDate)
        setNavigation("NEXT") {
            settings.update { it.copy(use24Hour = hour24.isChecked, showSeconds = seconds.isChecked, showDate = date.isChecked) }
            page++; showPage()
        }
    }

    private fun display() {
        heading("03", "AMBIENT", "The built-in light sensor adjusts brightness smoothly. The interface always stays white and monochrome.")
        val automatic = check("AUTOMATIC BRIGHTNESS", settings.current().autoBrightness)
        val awake = check("KEEP DISPLAY ON", settings.current().keepScreenOn)
        val immersive = check("HIDE SYSTEM BARS", settings.current().immersive)
        setNavigation("NEXT") {
            settings.update { it.copy(autoBrightness = automatic.isChecked, keepScreenOn = awake.isChecked, immersive = immersive.isChecked) }
            page++; showPage()
        }
    }

    private fun weather() {
        heading("04", "WEATHER", "Optional weather from Open-Meteo. No account or API key is required.")
        val enabled = check("ENABLE WEATHER", settings.current().weatherEnabled)
        val city = input("City", settings.current().weatherPlace)
        val status = Ui.body(context, selectedPlace?.let { "${it.name}, ${it.country}" } ?: "No place selected")
        content.addView(status)
        Ui.addSpace(content, 8)
        content.addView(Ui.button(context, "FIND PLACE") {
            status.text = "Searching..."
            scope.launch {
                runCatching { WeatherRepository(context).searchPlaces(city.text.toString()).firstOrNull() }
                    .onSuccess {
                        selectedPlace = it
                        status.text = it?.let { place -> "${place.name}, ${place.country}" } ?: "No result"
                    }
                    .onFailure { status.text = it.message ?: "Search failed" }
            }
        })
        setNavigation("NEXT") {
            val place = selectedPlace
            settings.update {
                it.copy(
                    weatherEnabled = enabled.isChecked && place != null,
                    weatherPlace = place?.name ?: it.weatherPlace,
                    weatherLatitude = place?.latitude ?: it.weatherLatitude,
                    weatherLongitude = place?.longitude ?: it.weatherLongitude,
                )
            }
            page++; showPage()
        }
    }

    private fun homeAssistant() {
        heading("05", "HOME ASSISTANT", "Optional. Your access token stays encrypted in Android Keystore.")
        val enabled = check("ENABLE HOME ASSISTANT", settings.current().homeAssistantEnabled)
        val url = input("https://homeassistant.local:8123", settings.current().homeAssistantUrl)
        val token = input("Long-lived access token", "").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val allowHttp = check("ALLOW PRIVATE LAN HTTP", settings.current().allowPrivateHttp)
        val status = Ui.body(context, "Test before continuing.")
        content.addView(status)
        Ui.addSpace(content, 8)
        content.addView(Ui.button(context, "TEST CONNECTION") {
            status.text = "Connecting..."
            scope.launch {
                HomeAssistantClient().test(url.text.toString(), token.text.toString(), allowHttp.isChecked)
                    .onSuccess { status.text = "Connected to $it" }
                    .onFailure { status.text = it.message ?: "Connection failed" }
            }
        })
        setNavigation("NEXT") {
            if (token.text.isNotBlank()) secrets.putHomeAssistantToken(token.text.toString())
            settings.update {
                it.copy(
                    homeAssistantEnabled = enabled.isChecked && url.text.isNotBlank() && (token.text.isNotBlank() || secrets.getHomeAssistantToken() != null),
                    homeAssistantUrl = url.text.toString().trim(),
                    allowPrivateHttp = allowHttp.isChecked,
                )
            }
            page++; showPage()
        }
    }

    private fun finish() {
        heading("06", "READY", "Choose Display as the Home app and select Always in the Android dialog.")
        content.addView(infoCard("GESTURES", "Swipe up  Apps\nSwipe down  Settings\nSwipe sideways  Home Assistant"))
        setNavigation("CHOOSE LAUNCHER") {
            settings.update { it.copy(setupComplete = true) }
            onComplete()
        }
    }

    private fun setNavigation(next: String, action: () -> Unit) {
        if (page > 0) navigation.addView(Ui.button(context, "BACK") { page--; showPage() }, LayoutParams(Ui.dp(context, 132), Ui.dp(context, 52)))
        navigation.addView(Ui.button(context, next, action), LayoutParams(Ui.dp(context, 190), Ui.dp(context, 52)).apply { marginStart = Ui.dp(context, 10) })
    }

    private fun check(label: String, checked: Boolean) = CheckBox(context).apply {
        text = label
        isChecked = checked
        setTextColor(Ui.INK)
        buttonTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(Ui.RED, Ui.MUTED))
        textSize = 14f
        letterSpacing = 0.04f
        minHeight = Ui.dp(context, 50)
        content.addView(this)
    }

    private fun input(hint: String, value: String) = EditText(context).apply {
        this.hint = hint
        setText(value)
        setHintTextColor(Ui.MUTED)
        setTextColor(Ui.INK)
        setSingleLine(true)
        backgroundTintList = ColorStateList.valueOf(Ui.INK)
        content.addView(this, LayoutParams(LayoutParams.MATCH_PARENT, Ui.dp(context, 54)))
    }

    private fun infoCard(label: String, value: String) = LinearLayout(context).apply {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 16), Ui.dp(context, 12), Ui.dp(context, 16), Ui.dp(context, 12))
        background = Ui.panelDrawable(context)
        addView(TextView(context).apply {
            text = label
            setTextColor(Ui.RED)
            textSize = 11f
            letterSpacing = 0.12f
        })
        addView(Ui.body(context, value).apply { setTextColor(Ui.INK) })
    }
}
