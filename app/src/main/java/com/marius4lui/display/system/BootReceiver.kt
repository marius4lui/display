package com.marius4lui.display.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        // Android launches the selected HOME activity itself. This receiver intentionally
        // performs no background work and only keeps the boot capability explicit.
    }
}
