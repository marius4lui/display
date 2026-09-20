package com.marius4lui.display

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.WindowInsets
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.marius4lui.display.clock.DotClockView
import com.marius4lui.display.clock.AmbientClockView
import com.marius4lui.display.display.AmbientLightController
import com.marius4lui.display.homeassistant.HomeAssistantClient
import com.marius4lui.display.homeassistant.HomeAssistantView
import com.marius4lui.display.launcher.AppDrawerView
import com.marius4lui.display.settings.SettingsView
import com.marius4lui.display.setup.SetupView
import com.marius4lui.display.storage.SecureTokenStore
import com.marius4lui.display.storage.SettingsStore
import com.marius4lui.display.system.AmbientDisplayService
import com.marius4lui.display.ui.Ui
import com.marius4lui.display.update.UpdateRepository
import com.marius4lui.display.weather.WeatherRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var settings: SettingsStore
    private lateinit var secrets: SecureTokenStore
    private lateinit var clock: DotClockView
    private lateinit var lightController: AmbientLightController
    private val weather by lazy { WeatherRepository(this) }
    private val homeAssistant = HomeAssistantClient()
    private var weatherText = ""
    private var homeText = ""
    private var refreshJob: Job? = null
    private var screen = "clock"
    private var gestureStartX = 0f
    private var gestureStartY = 0f
    private var gestureTracking = false
    private var ambientMode = false
    private val swipeDistance by lazy { ViewConfiguration.get(this).scaledTouchSlop * 8f }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = (application as DisplayApplication).settings
        secrets = SecureTokenStore(this)
        // Android 11 does not resize fullscreen windows for the keyboard. Reserve
        // IME space explicitly so the setup ScrollView and fixed actions remain usable.
        findViewById<View>(android.R.id.content).setOnApplyWindowInsetsListener { content, insets ->
            val bottom = if (usesImmersiveLayout()) insets.getInsets(WindowInsets.Type.ime()).bottom else 0
            if (content.paddingBottom != bottom) content.setPadding(0, 0, 0, bottom)
            insets
        }
        window.statusBarColor = Ui.PAPER
        window.navigationBarColor = Ui.PAPER
        lightController = AmbientLightController(this, settings::current)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (settings.current().setupComplete) setClockIfNeeded() else finish()
            }
        })
        AmbientDisplayService.sync(this, settings.current().alwaysOnDisplay)
        routeInitial()
    }

    override fun onResume() {
        super.onResume()
        applyWindowSettings()
        if (!ambientMode) lightController.start()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(AmbientDisplayService.EXTRA_AMBIENT, false)) showAmbient() else if (settings.current().setupComplete) showClock()
    }

    override fun onPause() {
        lightController.stop()
        super.onPause()
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (ambientMode && event.actionMasked == MotionEvent.ACTION_UP) {
            showClock()
            return true
        }
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                gestureStartX = event.x
                gestureStartY = event.y
                gestureTracking = screen in setOf("clock", "apps", "home")
            }
            MotionEvent.ACTION_UP -> {
                if (gestureTracking) {
                    val dx = event.x - gestureStartX
                    val dy = event.y - gestureStartY
                    gestureTracking = false
                    if (kotlin.math.abs(dx) >= swipeDistance &&
                        kotlin.math.abs(dx) > kotlin.math.abs(dy) * 1.25f
                    ) {
                        when (SpatialNavigation.destination(screen, dx)) {
                            "apps" -> showApps()
                            "clock" -> showClock()
                            "home" -> showHomeAssistant()
                        }
                        return true
                    }
                }
            }
            MotionEvent.ACTION_CANCEL -> gestureTracking = false
        }
        return super.dispatchTouchEvent(event)
    }

    override fun onDestroy() {
        refreshJob?.cancel()
        homeAssistant.disconnect()
        scope.cancel()
        super.onDestroy()
    }

    private fun routeInitial() {
        if (!settings.current().setupComplete) showSetup()
        else if (intent.getBooleanExtra(AmbientDisplayService.EXTRA_AMBIENT, false)) showAmbient()
        else showClock()
    }

    private fun showSetup() {
        screen = "setup"
        refreshJob?.cancel()
        setContentView(SetupView(this, scope, settings, secrets) {
            requestHomeRole()
            showClock()
        })
        applyWindowSettings()
    }

    private fun showClock() {
        ambientMode = false
        setTurnScreenOn(false)
        window.attributes = window.attributes.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
        screen = "clock"
        clock = DotClockView(this)
        bindClock()
        val root = FrameLayout(this).apply {
            setBackgroundColor(Ui.PAPER)
            addView(clock, FrameLayout.LayoutParams(-1, -1))
        }
        root.addView(
            Ui.iconButton(this, "", "settings", ::showSettings).apply {
                contentDescription = Ui.tr("Einstellungen", "Settings")
            },
            FrameLayout.LayoutParams(Ui.dp(this, 48), Ui.dp(this, 48), android.view.Gravity.TOP or android.view.Gravity.END).apply {
                topMargin = Ui.dp(this@MainActivity, 18)
                marginEnd = Ui.dp(this@MainActivity, 272)
            }
        )
        clock.setOnLongClickListener { showSettings(); true }
        setPageContent(root, 1f)
        applyWindowSettings()
        if (settings.current().alwaysOnDisplay) AmbientDisplayService.reportMode(this, ambient = false)
        startDataRefresh()
        maybeCheckForUpdates()
    }

    private fun showApps() {
        screen = "apps"
        refreshJob?.cancel()
        setPageContent(AppDrawerView(this, settings, ::showClock, ::showSettings), -1f)
        applyWindowSettings()
    }

    private fun showSettings() {
        screen = "settings"
        refreshJob?.cancel()
        setContentView(
            SettingsView(
                this,
                settings,
                ::showClock,
                { routeInitial() },
                ::requestHomeRole,
                ::checkForUpdates,
            )
        )
        applyWindowSettings()
    }

    private fun showHomeAssistant() {
        screen = "home"
        refreshJob?.cancel()
        setPageContent(HomeAssistantView(this, scope, homeAssistant, settings.current(), secrets.getHomeAssistantToken(), ::showClock, ::showSetup), 1f)
        applyWindowSettings()
    }

    private fun showAmbient() {
        if (!settings.current().alwaysOnDisplay) {
            showClock()
            return
        }
        ambientMode = true
        screen = "ambient"
        refreshJob?.cancel()
        lightController.stop()
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        setContentView(AmbientClockView(this))
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.attributes = window.attributes.apply { screenBrightness = 0.025f }
        applyWindowSettings()
        AmbientDisplayService.reportMode(this, ambient = true)
        window.decorView.postDelayed({ if (ambientMode) setTurnScreenOn(false) }, 100L)
    }

    private fun setPageContent(view: View, direction: Float) {
        setContentView(view)
        view.alpha = 0f
        view.translationX = Ui.dp(this, 36) * direction
        view.animate().alpha(1f).translationX(0f).setDuration(190L).start()
    }

    private fun setClockIfNeeded(): Boolean {
        if (screen == "clock") return false
        showClock()
        return true
    }

    private fun bindClock() {
        clock.bind(settings.current(), weatherText, homeText)
    }

    private fun startDataRefresh() {
        refreshJob?.cancel()
        refreshJob = scope.launch {
            while (true) {
                val current = settings.current()
                if (current.weatherEnabled) {
                    weather.cached()?.let { weatherText = it.summary(current.weatherUnit); bindClock() }
                    runCatching { weather.refresh(current.weatherLatitude, current.weatherLongitude, current.weatherUnit) }
                        .onSuccess { weatherText = it.summary(current.weatherUnit); bindClock() }
                }
                if (current.homeAssistantEnabled) {
                    secrets.getHomeAssistantToken()?.let { token ->
                        runCatching { homeAssistant.refresh(current.homeAssistantUrl, token, current.allowPrivateHttp) }
                            .onSuccess { states ->
                                val chosen = if (current.homeAssistantEntities.isEmpty()) states.filter { it.entityId.startsWith("sensor.") }.take(2) else current.homeAssistantEntities.mapNotNull { id -> states.firstOrNull { it.entityId == id } }
                                homeText = chosen.joinToString(" · ") { "${it.friendlyName} ${it.state}${it.unit.orEmpty()}" }
                                bindClock()
                                scope.launch { homeAssistant.connectLive(current.homeAssistantUrl, token, current.allowPrivateHttp) }
                            }
                    }
                }
                delay(30 * 60 * 1000L)
            }
        }
    }

    private fun applyWindowSettings() {
        val current = settings.current()
        // The three launcher pages are the ambient smart-display surface, not a
        // conventional app. Keep them edge-to-edge; system bars remain available
        // with an edge swipe and stay visible in setup/settings unless requested.
        val immersive = usesImmersiveLayout()
        window.setSoftInputMode(if (immersive) WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING else WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        if (ambientMode || current.keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, !immersive)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            if (immersive) hide(WindowInsetsCompat.Type.systemBars())
            else show(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun usesImmersiveLayout() = settings.current().immersive || screen in setOf("clock", "apps", "home", "ambient")

    companion object {
        fun intent(context: Context, ambient: Boolean): Intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(AmbientDisplayService.EXTRA_AMBIENT, ambient)
        }
    }

    private fun requestHomeRole() {
        val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
        if (roleManager.isRoleAvailable(RoleManager.ROLE_HOME) && !roleManager.isRoleHeld(RoleManager.ROLE_HOME)) {
            startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_HOME), 42)
        } else if (!roleManager.isRoleHeld(RoleManager.ROLE_HOME)) {
            runCatching { startActivity(Intent(Settings.ACTION_HOME_SETTINGS)) }
                .onFailure { startActivity(Intent(Settings.ACTION_SETTINGS)) }
        } else Toast.makeText(this, "Display is already the Home app", Toast.LENGTH_SHORT).show()
    }

    private fun checkForUpdates(status: TextView) {
        status.text = "Checking GitHub…"
        scope.launch {
            runCatching { UpdateRepository(this@MainActivity).checkLatest() }
                .onSuccess { release ->
                    if (release == null) status.text = "Display is up to date"
                    else {
                        status.text = "Downloading ${release.tag}…"
                        runCatching { UpdateRepository(this@MainActivity).downloadAndVerify(release) }
                            .onSuccess { file ->
                                status.text = "Opening Android installer…"
                                UpdateRepository(this@MainActivity).install(file)
                            }
                            .onFailure { status.text = it.message ?: "Download failed" }
                    }
                }
                .onFailure { status.text = it.message ?: "Update check failed" }
        }
    }

    private fun maybeCheckForUpdates() {
        if (!settings.current().autoUpdateCheck) return
        val state = getSharedPreferences("update_state", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (now - state.getLong("last_check", 0L) < 12 * 60 * 60 * 1000L) return
        state.edit().putLong("last_check", now).apply()
        scope.launch {
            runCatching { UpdateRepository(this@MainActivity).checkLatest() }
                .onSuccess { release ->
                    if (release != null) Toast.makeText(this@MainActivity, "Display ${release.tag} is available", Toast.LENGTH_LONG).show()
                }
        }
    }
}

internal object SpatialNavigation {
    fun destination(current: String, deltaX: Float): String = when {
        current == "clock" && deltaX > 0 -> "apps"
        current == "clock" && deltaX < 0 -> "home"
        current in setOf("apps", "home") && deltaX != 0f -> "clock"
        else -> current
    }
}
