package com.kmuc.display

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.kmuc.display.ui.theme.DisplayTheme
import kotlinx.coroutines.delay
import org.json.JSONObject
import org.json.JSONArray
import java.text.DateFormat
import java.text.NumberFormat
import java.util.Date

class MainActivity : ComponentActivity() {
    private lateinit var controller: DashboardController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        controller = DashboardController(applicationContext)
        handleConnectionIntent(intent)
        enterFullscreen()
        setContent {
            DisplayTheme {
                val scope = rememberCoroutineScope()
                DisposableEffect(Unit) { controller.start(scope); onDispose { } }
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF090B12)) {
                    if (controller.configured) DashboardScreen(controller) else SetupScreen(
                        status = controller.status,
                        onBrowserConnect = { url ->
                            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(controller.browserConnectUrl(url)))); null }
                            catch (error: ActivityNotFoundException) { "Kein Browser verfügbar. Nutze den Kopplungscode." }
                            catch (error: Exception) { error.message ?: "Browser konnte nicht geöffnet werden." }
                        },
                        onCodeConnect = { url, code -> controller.connectWithCode(url, code, null, null, scope) },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); handleConnectionIntent(intent) }

    private fun handleConnectionIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "display") return
        when (uri.host) {
            "paired" -> controller.acceptBrowserConnection(
                uri.getQueryParameter("state").orEmpty(),
                uri.getQueryParameter("url").orEmpty(),
                uri.getQueryParameter("token").orEmpty(),
                lifecycleScope,
            )
            "pair" -> controller.connectWithQrToken(
                uri.getQueryParameter("url").orEmpty(),
                uri.getQueryParameter("token").orEmpty(),
                lifecycleScope,
            )
            else -> return
        }
        intent.data = null
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterFullscreen()
    }

    private fun enterFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}

@Composable
private fun SetupScreen(status: String, onBrowserConnect: (String) -> String?, onCodeConnect: (String, String) -> Unit) {
    var url by remember { mutableStateOf("") }
    var pairingCode by remember { mutableStateOf("") }
    var showFallback by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(Color(0xFF090B12))
            .safeDrawingPadding()
            .imePadding(),
        contentAlignment = Alignment.Center
    ) {
        val compact = maxWidth < 430.dp
        val screenPadding = if (compact) 12.dp else 24.dp
        val cardPadding = if (compact) 20.dp else 32.dp
        Column(
            Modifier
                .padding(screenPadding)
                .widthIn(max = 520.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(if (compact) 18.dp else 24.dp))
                .background(Color(0xFF141824))
                .verticalScroll(rememberScrollState())
                .padding(cardPadding),
            verticalArrangement = Arrangement.spacedBy(15.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(45.dp).clip(RoundedCornerShape(13.dp)).background(Color(0xFF7C5CFF)), contentAlignment = Alignment.Center) { Text("d", fontSize = 29.sp, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(13.dp)); Column { Text("display", fontSize = 24.sp, fontWeight = FontWeight.Bold); Text("DASHBOARD CLIENT", color = Color(0xFF8B91A7), fontSize = 10.sp, letterSpacing = 1.5.sp) }
            }
            Text("Dashboard verbinden", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text("Trage nur die veröffentlichte Dashboard-URL ein. Die Freigabe erfolgt anschließend über deinen Browser-Login.", color = Color(0xFFA7ABBA), fontSize = 13.sp)
            OutlinedTextField(url, { url = it }, Modifier.fillMaxWidth(), label = { Text("Dashboard-URL") }, singleLine = true)
            error?.let { Text(it, color = Color(0xFFFF8799), fontSize = 12.sp) }
            if (status != "Nicht verbunden") Text(status, color = Color(0xFFA7ABBA), fontSize = 12.sp)
            Button(onClick = { error = onBrowserConnect(url); showFallback = true }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C5CFF))) { Text("Im Browser anmelden") }
            if (!showFallback) TextButton(onClick = { showFallback = true }, modifier = Modifier.fillMaxWidth()) { Text("Browser funktioniert nicht? Kopplungscode nutzen") }
            if (showFallback) {
                Text("Falls der Browser oder die Rückkehr zur App nicht funktioniert, erzeuge im Studio einen Fallback-Code.", color = Color(0xFFA7ABBA), fontSize = 12.sp)
                OutlinedTextField(pairingCode, { pairingCode = it.filter(Char::isDigit).take(6) }, Modifier.fillMaxWidth(), label = { Text("6-stelliger Kopplungscode") }, singleLine = true)
                Button(onClick = { try { require(pairingCode.length == 6) { "Bitte den 6-stelligen Kopplungscode eingeben." }; onCodeConnect(url, pairingCode); error = null } catch (exception: Exception) { error = exception.message } }, modifier = Modifier.fillMaxWidth().height(48.dp)) { Text("Mit Code verbinden") }
            }
        }
    }
}

@Composable
private fun DashboardScreen(controller: DashboardController) {
    val dashboard = controller.dashboard
    if (dashboard == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("display", fontSize = 42.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(8.dp)); Text(controller.status, color = Color(0xFF8B91A7)); TextButton(onClick = controller::reset) { Text("Verbindung zurücksetzen") } } }
        return
    }
    var pageIndex by remember(dashboard) { mutableStateOf(0) }
    var dragDistance by remember { mutableStateOf(0f) }
    val switchPage: (Int) -> Unit = { direction -> pageIndex = (pageIndex + direction + dashboard.pages.size) % dashboard.pages.size }
    val page = dashboard.pages[pageIndex.coerceIn(0, dashboard.pages.lastIndex)]
    BoxWithConstraints(
        Modifier.fillMaxSize().background(parseColor(dashboard.settings.background)).safeDrawingPadding()
    ) {
        // Scale the whole dashboard from its available dp size. Fixed dp/sp values become
        // disproportionately large on high-density phones and small landscape displays.
        val uiScale = minOf(maxWidth / 960.dp, maxHeight / 540.dp).coerceIn(.4f, 1.6f)
        val outerPadding = (12f * uiScale).coerceAtLeast(4f).dp
        val gap = (6f * uiScale).coerceIn(2f, 8f).dp
        Column(Modifier.fillMaxSize()) {
            BoxWithConstraints(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(start = outerPadding, top = outerPadding, end = outerPadding)
                    .pointerInput(dashboard.pages.size) {
                        detectHorizontalDragGestures(
                            onDragStart = { dragDistance = 0f },
                            onHorizontalDrag = { change, amount -> change.consume(); dragDistance += amount },
                            onDragEnd = {
                                if (kotlin.math.abs(dragDistance) > 80f) switchPage(if (dragDistance < 0) 1 else -1)
                                dragDistance = 0f
                            },
                            onDragCancel = { dragDistance = 0f },
                        )
                    }
            ) {
                val columns = dashboard.settings.columns.coerceAtLeast(1)
                val rows = dashboard.settings.rows.coerceAtLeast(1)
                val cellWidth = maxWidth / columns
                val cellHeight = maxHeight / rows
                page.widgets.forEach { widget ->
                    val x = widget.x.coerceIn(0, columns - 1)
                    val y = widget.y.coerceIn(0, rows - 1)
                    val widgetColumns = widget.width.coerceIn(1, columns - x)
                    val widgetRows = widget.height.coerceIn(1, rows - y)
                    val width = (cellWidth * widgetColumns - gap).coerceAtLeast(1.dp)
                    val height = (cellHeight * widgetRows - gap).coerceAtLeast(1.dp)
                    DashboardWidgetView(
                        widget,
                        controller.values[widget.dataSourceId],
                        uiScale,
                        Modifier.offset(cellWidth * x, cellHeight * y).size(width, height),
                    )
                }
                if (dashboard.pages.size > 1 && dashboard.pageNavigation.visible) {
                    val navigation = dashboard.pageNavigation
                    val x = navigation.x.coerceIn(0, columns - 1)
                    val y = navigation.y.coerceIn(0, rows - 1)
                    val navigationColumns = navigation.width.coerceIn(1, columns - x)
                    val navigationRows = navigation.height.coerceIn(1, rows - y)
                    val width = (cellWidth * navigationColumns - gap).coerceAtLeast(1.dp)
                    val height = (cellHeight * navigationRows - gap).coerceAtLeast(1.dp)
                    Row(
                        Modifier
                            .offset(cellWidth * x, cellHeight * y)
                            .size(width, height)
                            .clip(RoundedCornerShape((14f * uiScale).coerceAtLeast(5f).dp))
                            .background(parseColor(navigation.style.background)),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Box(
                            Modifier.weight(1f).fillMaxSize().clickable { switchPage(-1) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "←",
                                color = parseColor(navigation.style.foreground),
                                fontSize = (26f * uiScale).coerceAtLeast(12f).sp,
                            )
                        }
                        Text(
                            "${pageIndex + 1} / ${dashboard.pages.size}",
                            color = parseColor(navigation.style.foreground).copy(alpha = .7f),
                            fontSize = (11f * uiScale).coerceAtLeast(7f).sp,
                            maxLines = 1,
                        )
                        Box(
                            Modifier.weight(1f).fillMaxSize().clickable { switchPage(1) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "→",
                                color = parseColor(navigation.style.foreground),
                                fontSize = (26f * uiScale).coerceAtLeast(12f).sp,
                            )
                        }
                    }
                }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = outerPadding, vertical = (3f * uiScale).coerceAtLeast(2f).dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    Modifier
                        .clip(RoundedCornerShape((8f * uiScale).coerceAtLeast(4f).dp))
                        .background(Color.Black.copy(alpha = .48f))
                        .padding(
                            horizontal = (8f * uiScale).coerceAtLeast(4f).dp,
                            vertical = (4f * uiScale).coerceAtLeast(2f).dp,
                        ),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size((6f * uiScale).coerceAtLeast(4f).dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(if (controller.status.startsWith("Live")) Color(0xFF62DE9A) else Color(0xFFFFB45F))
                    )
                    Spacer(Modifier.width((6f * uiScale).coerceAtLeast(3f).dp))
                    Text(controller.status, fontSize = (9f * uiScale).coerceAtLeast(7f).sp, color = Color.White.copy(alpha = .65f), maxLines = 1)
                    Spacer(Modifier.width((10f * uiScale).coerceAtLeast(5f).dp))
                    Text(
                        "Setup",
                        Modifier.clickable(onClick = controller::reset).padding(vertical = 2.dp),
                        fontSize = (9f * uiScale).coerceAtLeast(7f).sp,
                        color = Color(0xFFC6B9FF),
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardWidgetView(widget: DashboardWidget, runtime: RuntimeValue?, uiScale: Float, modifier: Modifier) {
    val raw = valueAtJsonPath(runtime?.value, widget.jsonPath)
    val rule = firstMatchingRule(raw, widget.conditionalRules)
    val background = rule?.optString("background")?.takeIf(String::isNotBlank) ?: widget.style.background
    val foreground = rule?.optString("foreground")?.takeIf(String::isNotBlank) ?: widget.style.foreground
    val accent = rule?.optString("accent")?.takeIf(String::isNotBlank) ?: widget.style.accent
    val transition = rememberInfiniteTransition(label = "widget")
    val animated by transition.animateFloat(1f, if (widget.animation == "pulse") .58f else 1f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "alpha")
    val scale by transition.animateFloat(1f, if (widget.animation == "float") 1.035f else 1f, infiniteRepeatable(tween(1700), RepeatMode.Reverse), label = "scale")
    val textAlign = when(widget.style.align) { "center" -> TextAlign.Center; "right" -> TextAlign.Right; else -> TextAlign.Left }
    val content = when {
        runtime?.error != null && widget.errorBehavior == "error" -> "API-Fehler"
        runtime?.error != null && widget.errorBehavior == "empty" -> ""
        widget.type in listOf("value","weather","metric","gauge") -> formatRuntime(raw, widget.format, widget.suffix)
        widget.type == "status" -> widget.statusMap?.optJSONObject(raw.toString())?.let { "${it.optString("icon","●")} ${it.optString("text",raw.toString())}" } ?: raw?.toString().orEmpty()
        else -> rule?.optString("text")?.takeIf(String::isNotBlank) ?: widget.staticValue.orEmpty()
    }
    BoxWithConstraints(modifier.clip(RoundedCornerShape((16f * uiScale).coerceAtLeast(5f).dp)).background(parseColor(background)).alpha(animated).scale(scale)) {
        val widgetScale = minOf(uiScale, maxWidth / 260.dp, maxHeight / 115.dp).coerceIn(.35f, 1.6f)
        val padding = (18f * widgetScale).coerceIn(4f, 24f).dp
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (widget.type == "image" && !widget.imageUrl.isNullOrBlank()) AsyncImage(widget.imageUrl, widget.title, Modifier.fillMaxSize().clip(RoundedCornerShape((12f * widgetScale).coerceAtLeast(4f).dp)), contentScale = ContentScale.Crop)
            else Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                Text(widget.title.uppercase(), color = parseColor(foreground).copy(alpha=.58f), fontSize=(10f * widgetScale).coerceAtLeast(6f).sp, fontWeight=FontWeight.Bold, letterSpacing=(1f * widgetScale).coerceAtLeast(.25f).sp, maxLines=1, overflow=TextOverflow.Ellipsis)
                when (widget.type) {
                    "clock" -> ClockText(parseColor(foreground), textAlign, widgetScale)
                    "weather" -> Row(verticalAlignment=Alignment.Bottom) { Text("☀", fontSize=(38f * widgetScale).coerceAtLeast(12f).sp, color=parseColor(accent)); Spacer(Modifier.width((12f * widgetScale).coerceAtLeast(3f).dp)); Text(content, Modifier.weight(1f), color=parseColor(foreground), fontSize=(42f * widgetScale).coerceAtLeast(12f).sp, fontWeight=FontWeight.Bold, textAlign=textAlign, maxLines=2, overflow=TextOverflow.Ellipsis) }
                    "list" -> WidgetList(raw as? JSONArray, widget, parseColor(foreground), widgetScale)
                    "chart" -> WidgetChart(runtime?.history.orEmpty().map { valueAtJsonPath(it, widget.jsonPath) }, parseColor(accent))
                    "gauge" -> WidgetGauge(raw, widget, parseColor(accent), parseColor(foreground), widgetScale)
                    else -> Text(content, Modifier.fillMaxWidth(), color=parseColor(foreground), fontSize=((if(widget.type=="text") 27f else 40f) * widgetScale).coerceAtLeast(11f).sp, fontWeight=FontWeight.SemiBold, textAlign=textAlign, maxLines=4, overflow=TextOverflow.Ellipsis)
                }
                if (runtime?.stale == true) Text("Zuletzt bekannter Wert", color=Color(0xFFFFB45F), fontSize=(9f * widgetScale).coerceAtLeast(6f).sp, maxLines=1, overflow=TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable private fun WidgetList(rows: JSONArray?, widget: DashboardWidget, color: Color, uiScale: Float) {
    Column(verticalArrangement=Arrangement.spacedBy((5f * uiScale).coerceAtLeast(1f).dp)) {
        for(index in 0 until minOf(rows?.length() ?: 0, widget.maxItems)) {
            val row=rows?.opt(index)
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                Text(valueAtJsonPath(row,widget.listTitlePath)?.toString().orEmpty(),Modifier.weight(1f),color=color,fontSize=(13f*uiScale).coerceAtLeast(7f).sp,maxLines=1,overflow=TextOverflow.Ellipsis)
                Text(valueAtJsonPath(row,widget.listSubtitlePath)?.toString().orEmpty(),color=color.copy(alpha=.6f),fontSize=(12f*uiScale).coerceAtLeast(7f).sp,maxLines=1,overflow=TextOverflow.Ellipsis)
            }
        }
    }
}
@Composable private fun WidgetChart(history: List<Any?>, color: Color) {
    val values=history.mapNotNull { (it as? Number)?.toFloat() }
    Canvas(Modifier.fillMaxSize()) {
        if(values.size<2)return@Canvas
        val min=values.minOrNull()?:0f; val range=((values.maxOrNull()?:1f)-min).coerceAtLeast(.001f)
        for(index in 1 until values.size) drawLine(color, androidx.compose.ui.geometry.Offset((index-1)*size.width/(values.size-1),size.height-(values[index-1]-min)/range*size.height), androidx.compose.ui.geometry.Offset(index*size.width/(values.size-1),size.height-(values[index]-min)/range*size.height),strokeWidth=4f)
    }
}
@Composable private fun WidgetGauge(raw: Any?, widget: DashboardWidget, accent: Color, foreground: Color, uiScale: Float) {
    val min=widget.min?:0.0;val max=widget.max?:100.0;val value=(raw as? Number)?.toDouble()?:min
    val barHeight=(12f*uiScale).coerceAtLeast(4f).dp
    Column { Text(formatRuntime(raw,widget.format,widget.suffix),color=foreground,fontSize=(35f*uiScale).coerceAtLeast(11f).sp,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis); Spacer(Modifier.height((8f*uiScale).coerceAtLeast(2f).dp)); Box(Modifier.fillMaxWidth().height(barHeight).clip(RoundedCornerShape(9.dp)).background(Color.White.copy(alpha=.12f))){Box(Modifier.fillMaxWidth(((value-min)/(max-min)).toFloat().coerceIn(0f,1f)).height(barHeight).background(accent))} }
}
private fun firstMatchingRule(value: Any?, rules: JSONArray?): JSONObject? {
    if(rules==null)return null
    for(index in 0 until rules.length()){val rule=rules.optJSONObject(index)?:continue;val expected=rule.optString("value");val a=(value as? Number)?.toDouble();val b=expected.toDoubleOrNull();val match=when(rule.optString("operator")){"exists"->value!=null;"contains"->value.toString().contains(expected);"="->value.toString()==expected;"!="->value.toString()!=expected;">"->a!=null&&b!=null&&a>b;">="->a!=null&&b!=null&&a>=b;"<"->a!=null&&b!=null&&a<b;"<="->a!=null&&b!=null&&a<=b;else->false};if(match)return rule}
    return null
}

@Composable
private fun ClockText(color: Color, alignment: TextAlign, uiScale: Float) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while(true) { now=Date(); delay(1_000) } }
    Text(DateFormat.getTimeInstance(DateFormat.SHORT).format(now), Modifier.fillMaxWidth(), color=color, fontSize=(45f*uiScale).coerceAtLeast(12f).sp, fontWeight=FontWeight.Bold, textAlign=alignment, maxLines=1, overflow=TextOverflow.Ellipsis)
}

private fun formatRuntime(value: Any?, format: String?, suffix: String?): String {
    if (value == null || value == JSONObject.NULL) return "—"
    val formatted = when(format) { "number", "temperature" -> (value as? Number)?.let { NumberFormat.getNumberInstance().apply { maximumFractionDigits=1 }.format(it) } ?: value.toString(); "date" -> runCatching { DateFormat.getDateTimeInstance().format(Date(value.toString().toLong())) }.getOrDefault(value.toString()); else -> value.toString() }
    return formatted + suffix.orEmpty()
}

private fun parseColor(value: String): Color = try { Color(AndroidColor.parseColor(value)) } catch (_: Exception) { Color.DarkGray }
