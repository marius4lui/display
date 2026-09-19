package com.marius4lui.display.setup

import android.content.Context
import android.content.res.ColorStateList
import android.text.InputType
import android.view.Gravity
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.marius4lui.display.homeassistant.HomeAssistantClient
import com.marius4lui.display.storage.SecureTokenStore
import com.marius4lui.display.storage.SettingsStore
import com.marius4lui.display.ui.Ui
import com.marius4lui.display.ui.DotLabelView
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
    private val chapter = TextView(context).apply {
        textSize = 78f
        typeface = android.graphics.Typeface.create("sans-serif-thin", android.graphics.Typeface.NORMAL)
        setTextColor(Ui.INK)
    }
    private val chapterName = Ui.title(context, "")
    private val stepDots = Ui.body(context, "").apply { textSize = 18f; setTextColor(Ui.RED) }
    private val navigation = LinearLayout(context).apply {
        gravity = Gravity.END or Gravity.CENTER_VERTICAL
        setPadding(Ui.dp(context, 28), Ui.dp(context, 8), Ui.dp(context, 28), Ui.dp(context, 14))
        setBackgroundColor(Ui.PAPER)
    }
    private var page = 0
    private var selectedPlace: Place? = null
    private val scroll = ScrollView(context).apply {
        isFillViewport = true
        overScrollMode = OVER_SCROLL_IF_CONTENT_SCROLLS
        addView(content, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    }

    init {
        orientation = HORIZONTAL
        setBackgroundColor(Ui.PAPER)
        val rail = Ui.column(context)
        rail.addView(DotLabelView(context, "DISPLAY"), LayoutParams(-1, Ui.dp(context, 38)))
        rail.addView(Ui.body(context, "MAKE TIME YOURS.").apply { textSize = 9f; typeface = android.graphics.Typeface.MONOSPACE })
        Ui.addSpace(rail, 28)
        rail.addView(chapter)
        rail.addView(chapterName)
        rail.addView(android.view.View(context), LayoutParams(1, 0, 1f))
        rail.addView(stepDots)
        addView(rail, LayoutParams(Ui.dp(context, 224), -1))
        val right = LinearLayout(context).apply { orientation = VERTICAL }
        right.addView(scroll, LayoutParams(-1, 0, 1f))
        right.addView(navigation, LayoutParams(-1, Ui.dp(context, 72)))
        addView(right, LayoutParams(0, -1, 1f))
        showPage()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        chapter.visibility = if (h < Ui.dp(context, 300)) GONE else VISIBLE
    }

    private fun showPage() {
        isFocusableInTouchMode = true
        requestFocus()
        (context.getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
            .hideSoftInputFromWindow(windowToken, 0)
        content.removeAllViews()
        navigation.removeAllViews()
        chapter.text = (page + 1).toString().padStart(2, '0')
        stepDots.text = (0..5).joinToString(" ") { if (it == page) "●" else "·" }
        scroll.scrollTo(0, 0)
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
        chapterName.text = if (label == "HOME ASSISTANT") "HOME" else label
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
        navigation.addView(Ui.button(context, "$next  →", action).apply {
            setTextColor(Ui.SURFACE)
            background = android.graphics.drawable.RippleDrawable(ColorStateList.valueOf(0x30ffffff), Ui.panelDrawable(context, Ui.INK), null)
        }, LayoutParams(Ui.dp(context, 190), Ui.dp(context, 52)).apply { marginStart = Ui.dp(context, 10) })
    }

    private fun check(label: String, checked: Boolean) = CheckBox(context).apply {
        text = label
        isChecked = checked
        setTextColor(Ui.INK)
        buttonTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(Ui.RED, Ui.MUTED))
        textSize = 14f
        letterSpacing = 0.04f
        minHeight = Ui.dp(context, 50)
        background = Ui.panelDrawable(context)
        setPadding(Ui.dp(context, 12), Ui.dp(context, 4), Ui.dp(context, 12), Ui.dp(context, 4))
        content.addView(this, LayoutParams(-1, -2).apply { bottomMargin = Ui.dp(context, 8) })
    }

    private fun input(hint: String, value: String) = EditText(context).apply {
        this.hint = hint
        setText(value)
        setHintTextColor(Ui.MUTED)
        setTextColor(Ui.INK)
        setSingleLine(true)
        imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI or android.view.inputmethod.EditorInfo.IME_ACTION_DONE
        textSize = 14f
        background = Ui.panelDrawable(context)
        setPadding(Ui.dp(context, 18), 0, Ui.dp(context, 18), 0)
        content.addView(this, LayoutParams(LayoutParams.MATCH_PARENT, Ui.dp(context, 54)).apply { bottomMargin = Ui.dp(context, 8) })
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
