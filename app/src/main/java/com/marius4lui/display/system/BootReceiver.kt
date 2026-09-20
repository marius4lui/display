package com.marius4lui.display.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.marius4lui.display.DisplayApplication

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val settings = (context.applicationContext as DisplayApplication).settings
        AmbientDisplayService.sync(context, settings.current().alwaysOnDisplay)
    }
}
