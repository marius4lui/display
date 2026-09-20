package com.marius4lui.display.system

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.marius4lui.display.MainActivity

class AmbientDisplayService : Service() {
    private val powerState = AmbientPowerState()
    private var ignoreScreenOffUntil = 0L
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    if (SystemClock.elapsedRealtime() >= ignoreScreenOffUntil) act(powerState.screenOff())
                    else Log.i(TAG, "ignoring wake-transition screen-off")
                }
                Intent.ACTION_SCREEN_ON -> act(powerState.screenOn())
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, notification())
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        })
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_AMBIENT_SHOWN -> powerState.ambientShown()
            ACTION_NORMAL_SHOWN -> powerState.normalShown()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        unregisterReceiver(screenReceiver)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun act(action: AmbientPowerState.Action) {
        Log.i(TAG, "power action=$action state=${powerState.state}")
        when (action) {
            AmbientPowerState.Action.NONE -> Unit
            AmbientPowerState.Action.SHOW_AMBIENT -> {
                ignoreScreenOffUntil = SystemClock.elapsedRealtime() + 2_000L
                val power = getSystemService(POWER_SERVICE) as PowerManager
                @Suppress("DEPRECATION")
                power.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "display:ambient-wake",
                ).apply {
                    acquire(2_500L)
                }
                openActivity(ambient = true)
            }
            AmbientPowerState.Action.SHOW_CLOCK -> openActivity(ambient = false)
        }
    }

    private fun openActivity(ambient: Boolean) {
        PendingIntent.getActivity(
            this,
            if (ambient) 1 else 2,
            MainActivity.intent(this, ambient),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        ).send()
    }

    private fun createChannel() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Always-On-Display", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Erkennt den Display-Status fuer den Echo-Ambientmodus"
                setShowBadge(false)
            }
        )
    }

    private fun notification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, MainActivity.intent(this, ambient = false),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.marius4lui.display.R.drawable.ic_launcher)
            .setContentTitle("Display-AOD aktiv")
            .setContentText("Power: AOD, danach Display aus")
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val EXTRA_AMBIENT = "com.marius4lui.display.extra.AMBIENT"
        private const val ACTION_AMBIENT_SHOWN = "com.marius4lui.display.AMBIENT_SHOWN"
        private const val ACTION_NORMAL_SHOWN = "com.marius4lui.display.NORMAL_SHOWN"
        private const val CHANNEL_ID = "ambient_display"
        private const val NOTIFICATION_ID = 41
        private const val TAG = "DisplayAmbient"

        fun sync(context: Context, enabled: Boolean) {
            val service = Intent(context, AmbientDisplayService::class.java)
            if (enabled) ContextCompat.startForegroundService(context, service)
            else context.stopService(service)
        }

        fun reportMode(context: Context, ambient: Boolean) {
            val action = if (ambient) ACTION_AMBIENT_SHOWN else ACTION_NORMAL_SHOWN
            context.startService(Intent(context, AmbientDisplayService::class.java).setAction(action))
        }
    }
}
