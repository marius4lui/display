package com.marius4lui.display.launcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Drawable

data class InstalledApp(val label: String, val packageName: String, val component: ComponentName, val icon: Drawable)

class InstalledAppsRepository(private val context: Context) {
    fun load(hiddenPackages: Set<String>, favoritePackages: List<String>): List<InstalledApp> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(intent, 0)
            .asSequence()
            .filter { it.activityInfo.packageName != context.packageName }
            .filterNot { it.activityInfo.packageName in hiddenPackages }
            .map {
                InstalledApp(
                    it.loadLabel(context.packageManager).toString(),
                    it.activityInfo.packageName,
                    ComponentName(it.activityInfo.packageName, it.activityInfo.name),
                    it.loadIcon(context.packageManager),
                )
            }
            .distinctBy { it.component }
            .sortedWith(compareBy<InstalledApp>({ it.packageName !in favoritePackages }, { it.label.lowercase() }))
            .toList()
    }

    fun launch(app: InstalledApp): Boolean = runCatching {
        context.startActivity(Intent.makeMainActivity(app.component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.isSuccess
}
