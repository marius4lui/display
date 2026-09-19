package com.marius4lui.display.display

import android.app.Activity
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.marius4lui.display.storage.DisplaySettings
import kotlin.math.ln

class AmbientLightController(
    private val activity: Activity,
    private val settings: () -> DisplaySettings,
) : SensorEventListener {
    private val manager = activity.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor = manager.getDefaultSensor(Sensor.TYPE_LIGHT)
    private var filteredLux: Float? = null

    fun start() {
        sensor?.let { manager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun stop() = manager.unregisterListener(this)

    override fun onSensorChanged(event: SensorEvent) {
        val config = settings()
        if (!config.autoBrightness) return
        val raw = event.values.firstOrNull()?.coerceAtLeast(0f) ?: return
        val lux = filteredLux?.let { it * 0.82f + raw * 0.18f } ?: raw
        filteredLux = lux
        val normalized = (ln(lux + 1f) / ln(1001f)).coerceIn(0f, 1f)
        val level = config.minBrightness + ((config.maxBrightness - config.minBrightness) * normalized)
        activity.window.attributes = activity.window.attributes.apply { screenBrightness = level / 255f }

    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
