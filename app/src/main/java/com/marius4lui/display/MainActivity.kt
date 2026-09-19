package com.marius4lui.display

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.marius4lui.display.clock.DotClockView
import com.marius4lui.display.display.AmbientLightController
import com.marius4lui.display.homeassistant.HomeAssistantClient
import com.marius4lui.display.homeassistant.HomeAssistantView
import com.marius4lui.display.launcher.AppDrawerView
import com.marius4lui.display.settings.SettingsView
import com.marius4lui.display.setup.SetupView
import com.marius4lui.display.storage.SecureTokenStore
import com.marius4lui.display.storage.SettingsStore
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = (application as DisplayApplication).settings
        secrets = SecureTokenStore(this)
        window.statusBarColor = Ui.PAPER
        window.navigationBarColor = Ui.PAPER
        lightController = AmbientLightController(this, settings::current)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (settings.current().setupComplete) setClockIfNeeded() else finish()
            }
        })
        routeInitial()
    }

    override fun onResume() {
        super.onResume()
        applyWindowSettings()
        lightController.start()
    }

    override fun onPause() {
        lightController.stop()
        super.onPause()
    }

    override fun onDestroy() {
        refreshJob?.cancel()
        homeAssistant.disconnect()
        scope.cancel()
        super.onDestroy()
    }

    private fun routeInitial() {
        if (!settings.current().setupComplete) showSetup() else showClock()
    }

    private fun showSetup() {
        refreshJob?.cancel()
        setContentView(SetupView(this, scope, settings, secrets) {
            requestHomeRole()
            showClock()
        })
    }

    private fun showClock() {
        clock = DotClockView(this)
        bindClock()
        val root = FrameLayout(this).apply { addView(clock, FrameLayout.LayoutParams(-1, -1)) }
        val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true
            override fun onLongPress(e: MotionEvent) = showSettings()
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
                if (e1 == null) return false
                val dx = e2.x - e1.x
                val dy = e2.y - e1.y
                if (kotlin.math.abs(dy) > kotlin.math.abs(dx) && kotlin.math.abs(dy) > 80) {
                    if (dy < 0) showApps() else showSettings()
                    return true
                }
                if (kotlin.math.abs(dx) > 100) {
                    showHomeAssistant()
                    return true
                }
                return false
            }
        })
        root.setOnTouchListener { _, event -> detector.onTouchEvent(event) }
        setContentView(root)
        applyWindowSettings()
        startDataRefresh()
        maybeCheckForUpdates()
    }

    private fun showApps() {
        refreshJob?.cancel()
        setContentView(AppDrawerView(this, settings, ::showClock, ::showSettings))
    }

    private fun showSettings() {
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
    }

    private fun showHomeAssistant() {
        refreshJob?.cancel()
        setContentView(HomeAssistantView(this, scope, homeAssistant, settings.current(), secrets.getHomeAssistantToken(), ::showClock))
    }

    private fun setClockIfNeeded(): Boolean {
        if (::clock.isInitialized && clock.parent != null) return false
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
        if (current.keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val lightBars = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        window.decorView.systemUiVisibility = if (current.immersive) {
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        } else View.SYSTEM_UI_FLAG_LAYOUT_STABLE or lightBars
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
