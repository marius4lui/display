package com.marius4lui.display.launcher

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.GridLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.widget.doAfterTextChanged
import com.marius4lui.display.storage.SettingsStore
import com.marius4lui.display.ui.Ui

class AppDrawerView(
    context: Context,
    private val settings: SettingsStore,
    private val onBack: () -> Unit,
    private val onSettings: () -> Unit,
) : LinearLayout(context) {
    private val repository = InstalledAppsRepository(context)
    private val grid = GridLayout(context).apply { columnCount = 6 }
    private var apps = emptyList<InstalledApp>()

    init {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 20), Ui.dp(context, 12), Ui.dp(context, 20), Ui.dp(context, 12))
        setBackgroundColor(Ui.PAPER)

        val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.button(context, "‹ Clock", onBack), LayoutParams(Ui.dp(context, 130), Ui.dp(context, 52)))
        val search = EditText(context).apply {
            hint = "Search apps"
            setHintTextColor(Ui.MUTED)
            setTextColor(Ui.INK)
            setSingleLine(true)
            background = Ui.panelDrawable(context)
            setPadding(Ui.dp(context, 18), 0, Ui.dp(context, 18), 0)
            doAfterTextChanged { render(it?.toString().orEmpty()) }
        }
        header.addView(search, LayoutParams(0, Ui.dp(context, 52), 1f).apply { marginStart = Ui.dp(context, 12) })
        header.addView(Ui.button(context, "Settings", onSettings), LayoutParams(Ui.dp(context, 130), Ui.dp(context, 52)).apply { marginStart = Ui.dp(context, 12) })
        addView(header)

        addView(ScrollView(context).apply { addView(grid) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        reload()
    }

    fun reload() {
        val current = settings.current()
        apps = repository.load(current.hiddenPackages, current.favoritePackages)
        render("")
    }

    private fun render(query: String) {
        grid.removeAllViews()
        apps.filter { query.isBlank() || it.label.contains(query, ignoreCase = true) }.forEach { app ->
            grid.addView(appTile(app), GridLayout.LayoutParams().apply {
                width = 0
                height = Ui.dp(context, 126)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(Ui.dp(context, 4), Ui.dp(context, 5), Ui.dp(context, 4), Ui.dp(context, 5))
            })
        }
    }

    private fun appTile(app: InstalledApp): View = LinearLayout(context).apply {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        setPadding(Ui.dp(context, 4), Ui.dp(context, 8), Ui.dp(context, 4), Ui.dp(context, 4))
        background = Ui.panelDrawable(context)
        addView(ImageView(context).apply {
            setImageDrawable(app.icon)
            contentDescription = app.label
        }, LayoutParams(Ui.dp(context, 58), Ui.dp(context, 58)))
        addView(TextView(context).apply {
            text = app.label
            setTextColor(Ui.INK)
            textSize = 12f
            maxLines = 1
            gravity = Gravity.CENTER
        }, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(context, 32)))
        setOnClickListener { repository.launch(app) }
        setOnLongClickListener { anchor ->
            val favorite = app.packageName in settings.current().favoritePackages
            PopupMenu(context, anchor).apply {
                menu.add(if (favorite) "Remove favorite" else "Add favorite")
                menu.add("Hide app")
                menu.add("App info")
                setOnMenuItemClickListener { item ->
                    when (item.title.toString()) {
                        "Add favorite" -> settings.update { it.copy(favoritePackages = it.favoritePackages + app.packageName) }
                        "Remove favorite" -> settings.update { it.copy(favoritePackages = it.favoritePackages - app.packageName) }
                        "Hide app" -> settings.update { it.copy(hiddenPackages = it.hiddenPackages + app.packageName) }
                        "App info" -> context.startActivity(android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${app.packageName}")))
                    }
                    reload()
                    true
                }
                show()
            }
            true
        }
    }
}
