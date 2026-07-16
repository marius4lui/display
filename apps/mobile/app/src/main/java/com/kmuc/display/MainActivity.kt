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
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
        if (uri.scheme != "display" || uri.host != "paired") return
        controller.acceptBrowserConnection(uri.getQueryParameter("state").orEmpty(), uri.getQueryParameter("url").orEmpty(), uri.getQueryParameter("token").orEmpty(), lifecycleScope)
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
    var url by remember { mutableStateOf(BuildConfig.API_URL + "/d/") }
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
    Box(Modifier.fillMaxSize().background(parseColor(dashboard.settings.background)).padding(12.dp).pointerInput(dashboard.pages.size) {
        detectHorizontalDragGestures(
            onDragStart = { dragDistance = 0f },
            onHorizontalDrag = { change, amount -> change.consume(); dragDistance += amount },
            onDragEnd = { if (kotlin.math.abs(dragDistance) > 80f) switchPage(if (dragDistance < 0) 1 else -1); dragDistance = 0f },
            onDragCancel = { dragDistance = 0f },
        )
    }) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val cellWidth = maxWidth / dashboard.settings.columns
            val cellHeight = maxHeight / dashboard.settings.rows
            page.widgets.forEach { widget ->
                val width = cellWidth * widget.width.coerceAtMost(dashboard.settings.columns - widget.x)
                val height = cellHeight * widget.height.coerceAtMost(dashboard.settings.rows - widget.y)
                DashboardWidgetView(widget, controller.values[widget.dataSourceId], Modifier.offset(cellWidth * widget.x, cellHeight * widget.y).size(width - 6.dp, height - 6.dp))
            }
            if (dashboard.pages.size > 1 && dashboard.pageNavigation.visible) {
                val navigation = dashboard.pageNavigation
                val width = cellWidth * navigation.width.coerceAtMost(dashboard.settings.columns - navigation.x)
                val height = cellHeight * navigation.height.coerceAtMost(dashboard.settings.rows - navigation.y)
                Row(Modifier.offset(cellWidth * navigation.x, cellHeight * navigation.y).size(width - 6.dp, height - 6.dp).clip(RoundedCornerShape(14.dp)).background(parseColor(navigation.style.background)), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = { switchPage(-1) }, modifier = Modifier.weight(1f).fillMaxSize()) { Text("←", color = parseColor(navigation.style.foreground), fontSize = 26.sp) }
                    Text("${pageIndex + 1} / ${dashboard.pages.size}", color = parseColor(navigation.style.foreground).copy(alpha = .7f), fontSize = 11.sp)
                    TextButton(onClick = { switchPage(1) }, modifier = Modifier.weight(1f).fillMaxSize()) { Text("→", color = parseColor(navigation.style.foreground), fontSize = 26.sp) }
                }
            }
        }
        Row(Modifier.align(Alignment.BottomEnd).clip(RoundedCornerShape(8.dp)).background(Color.Black.copy(alpha=.48f)).padding(horizontal=8.dp, vertical=4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).clip(RoundedCornerShape(9.dp)).background(if (controller.status.startsWith("Live")) Color(0xFF62DE9A) else Color(0xFFFFB45F)))
            Spacer(Modifier.width(6.dp)); Text(controller.status, fontSize=9.sp, color=Color.White.copy(alpha=.65f)); TextButton(onClick=controller::reset, contentPadding=androidx.compose.foundation.layout.PaddingValues(horizontal=8.dp, vertical=0.dp)) { Text("Setup", fontSize=9.sp) }
        }
    }
}

@Composable
private fun DashboardWidgetView(widget: DashboardWidget, runtime: RuntimeValue?, modifier: Modifier) {
    val transition = rememberInfiniteTransition(label = "widget")
    val animated by transition.animateFloat(1f, if (widget.animation == "pulse") .58f else 1f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "alpha")
    val scale by transition.animateFloat(1f, if (widget.animation == "float") 1.035f else 1f, infiniteRepeatable(tween(1700), RepeatMode.Reverse), label = "scale")
    val textAlign = when(widget.style.align) { "center" -> TextAlign.Center; "right" -> TextAlign.Right; else -> TextAlign.Left }
    val content = when {
        runtime?.error != null && widget.errorBehavior == "error" -> "API-Fehler"
        runtime?.error != null && widget.errorBehavior == "empty" -> ""
        widget.type == "value" || widget.type == "weather" -> formatRuntime(valueAtJsonPath(runtime?.value, widget.jsonPath), widget.format, widget.suffix)
        else -> widget.staticValue.orEmpty()
    }
    Box(modifier.clip(RoundedCornerShape(16.dp)).background(parseColor(widget.style.background)).alpha(animated).scale(scale).padding(18.dp)) {
        if (widget.type == "image" && !widget.imageUrl.isNullOrBlank()) AsyncImage(widget.imageUrl, widget.title, Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
        else Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            Text(widget.title.uppercase(), color = parseColor(widget.style.foreground).copy(alpha=.58f), fontSize=10.sp, fontWeight=FontWeight.Bold, letterSpacing=1.sp, maxLines=1, overflow=TextOverflow.Ellipsis)
            when (widget.type) {
                "clock" -> ClockText(parseColor(widget.style.foreground), textAlign)
                "weather" -> Row(verticalAlignment=Alignment.Bottom) { Text("☀", fontSize=38.sp, color=parseColor(widget.style.accent)); Spacer(Modifier.width(12.dp)); Text(content, Modifier.weight(1f), color=parseColor(widget.style.foreground), fontSize=42.sp, fontWeight=FontWeight.Bold, textAlign=textAlign, maxLines=2) }
                else -> Text(content, Modifier.fillMaxWidth(), color=parseColor(widget.style.foreground), fontSize=if(widget.type=="text") 27.sp else 40.sp, fontWeight=FontWeight.SemiBold, textAlign=textAlign, maxLines=4, overflow=TextOverflow.Ellipsis)
            }
            if (runtime?.stale == true) Text("Zuletzt bekannter Wert", color=Color(0xFFFFB45F), fontSize=9.sp)
        }
    }
}

@Composable
private fun ClockText(color: Color, alignment: TextAlign) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while(true) { now=Date(); delay(1_000) } }
    Text(DateFormat.getTimeInstance(DateFormat.SHORT).format(now), Modifier.fillMaxWidth(), color=color, fontSize=45.sp, fontWeight=FontWeight.Bold, textAlign=alignment)
}

private fun formatRuntime(value: Any?, format: String?, suffix: String?): String {
    if (value == null || value == JSONObject.NULL) return "—"
    val formatted = when(format) { "number", "temperature" -> (value as? Number)?.let { NumberFormat.getNumberInstance().apply { maximumFractionDigits=1 }.format(it) } ?: value.toString(); "date" -> runCatching { DateFormat.getDateTimeInstance().format(Date(value.toString().toLong())) }.getOrDefault(value.toString()); else -> value.toString() }
    return formatted + suffix.orEmpty()
}

private fun parseColor(value: String): Color = try { Color(AndroidColor.parseColor(value)) } catch (_: Exception) { Color.DarkGray }
