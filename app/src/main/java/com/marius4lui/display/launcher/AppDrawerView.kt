package com.marius4lui.display.launcher

import android.content.Context
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
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
import com.marius4lui.display.ui.DotLabelView

class AppDrawerView(
    context: Context,
    private val settings: SettingsStore,
    private val onBack: () -> Unit,
    private val onSettings: () -> Unit,
) : LinearLayout(context) {
    private val repository = InstalledAppsRepository(context)
    private val grid = GridLayout(context).apply { columnCount = 4 }
    private var apps = emptyList<InstalledApp>()
    private val searchStatus = Ui.body(context, "").apply { textSize = 13f }
    private var query = ""

    init {
        orientation = VERTICAL
        setPadding(Ui.dp(context, 20), Ui.dp(context, 12), Ui.dp(context, 20), Ui.dp(context, 12))
        setBackgroundColor(Ui.PAPER)

        val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.iconButton(context, Ui.tr("Uhr", "Clock"), "back", onBack), LayoutParams(Ui.dp(context, 100), Ui.dp(context, 48)))
        header.addView(DotLabelView(context, "APPS"), LayoutParams(Ui.dp(context, 110), Ui.dp(context, 48)).apply { marginStart = Ui.dp(context, 20) })
        val search = EditText(context).apply {
            hint = Ui.tr("Apps suchen", "Search apps")
            textSize = 16f
            setHintTextColor(Ui.MUTED)
            setTextColor(Ui.INK)
            setSingleLine(true)
            imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI or android.view.inputmethod.EditorInfo.IME_ACTION_DONE
            background = Ui.panelDrawable(context)
            setPadding(Ui.dp(context, 18), 0, Ui.dp(context, 18), 0)
            doAfterTextChanged { query = it?.toString().orEmpty(); render(query) }
        }
        header.addView(search, LayoutParams(0, Ui.dp(context, 48), 1f).apply { marginStart = Ui.dp(context, 12) })
        header.addView(Ui.iconButton(context, "", "settings", onSettings).apply { contentDescription = Ui.tr("Einstellungen", "Settings") }, LayoutParams(Ui.dp(context, 56), Ui.dp(context, 48)).apply { marginStart = Ui.dp(context, 12) })
        addView(header)
        Ui.addSpace(this, 12)
        addView(searchStatus)
        Ui.addSpace(this, 6)

        addView(ScrollView(context).apply { addView(grid) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        reload()
    }

    fun reload() {
        val current = settings.current()
        apps = repository.load(current.hiddenPackages, current.favoritePackages)
        render(query)
    }

    private fun render(query: String) {
        grid.removeAllViews()
        val matches = apps.filter { query.isBlank() || it.label.contains(query, ignoreCase = true) }
        searchStatus.text = if (matches.isEmpty()) Ui.tr("Keine Apps gefunden", "No apps found") else
            "${matches.size} APPS  /  " + Ui.tr("Lange drücken für Optionen", "Long press for options")
        matches.forEach { app ->
            grid.addView(appTile(app), GridLayout.LayoutParams().apply {
                width = 0
                height = Ui.dp(context, 132)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(Ui.dp(context, 4), Ui.dp(context, 5), Ui.dp(context, 4), Ui.dp(context, 5))
            })
        }
    }

    private fun appTile(app: InstalledApp): View = LinearLayout(context).apply {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        setPadding(Ui.dp(context, 6), Ui.dp(context, 8), Ui.dp(context, 6), Ui.dp(context, 4))
        background = Ui.panelDrawable(context, Ui.PAPER)
        addView(ImageView(context).apply {
            setImageDrawable(app.icon)
            colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
            background = Ui.panelDrawable(context, Ui.SURFACE, Ui.SURFACE, 50)
            setPadding(Ui.dp(context, 14), Ui.dp(context, 14), Ui.dp(context, 14), Ui.dp(context, 14))
            contentDescription = app.label
        }, LayoutParams(Ui.dp(context, 78), Ui.dp(context, 78)))
        addView(TextView(context).apply {
            text = (if (app.packageName in settings.current().favoritePackages) "• " else "") + app.label
            setTextColor(Ui.INK)
            textSize = 15f
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = Gravity.CENTER
        }, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(context, 42)))
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
