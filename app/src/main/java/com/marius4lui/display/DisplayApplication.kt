package com.marius4lui.display

import android.app.Application
import com.marius4lui.display.storage.SettingsStore

class DisplayApplication : Application() {
    lateinit var settings: SettingsStore
        private set

    override fun onCreate() {
        super.onCreate()
        settings = SettingsStore(this)
    }
}
