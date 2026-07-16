package com.kmuc.display

import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enterFullscreen()
        setContent {
            DisplayTheme {
                val controller = remember { DashboardController(applicationContext) }
                val scope = rememberCoroutineScope()
                DisposableEffect(Unit) { controller.start(scope); onDispose { } }
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF090B12)) {
                    if (controller.configured) DashboardScreen(controller) else SetupScreen { url, code, secret, configPoll, dataPoll -> controller.configure(url, code, secret, configPoll, dataPoll, scope) }
                }
            }
        }
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
private fun SetupScreen(onConnect: (String, String, String, Int?, Int?) -> Unit) {
    var url by remember { mutableStateOf(BuildConfig.API_URL + "/d/") }
    var secret by remember { mutableStateOf("") }
    var pairingCode by remember { mutableStateOf("") }
    var configPoll by remember { mutableStateOf("") }
    var dataPoll by remember { mutableStateOf("") }
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
            Text("Trage die veröffentlichte URL und deine PIN/Passphrase einmalig ein. Die Daten werden nur auf diesem Gerät entschlüsselt.", color = Color(0xFFA7ABBA), fontSize = 13.sp)
            OutlinedTextField(url, { url = it }, Modifier.fillMaxWidth(), label = { Text("Dashboard-URL") }, singleLine = true)
            OutlinedTextField(pairingCode, { pairingCode = it.filter(Char::isDigit).take(6) }, Modifier.fillMaxWidth(), label = { Text("6-stelliger Pairing-Code") }, singleLine = true)
            OutlinedTextField(secret, { secret = it }, Modifier.fillMaxWidth(), label = { Text("PIN/Passphrase") }, singleLine = true)
            if (compact) {
                OutlinedTextField(configPoll, { configPoll = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Konfig.-Polling (optional)") }, singleLine = true)
                OutlinedTextField(dataPoll, { dataPoll = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Daten-Polling (optional)") }, singleLine = true)
            } else Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(configPoll, { configPoll = it.filter(Char::isDigit) }, Modifier.weight(1f), label = { Text("Konfig.-Polling (optional)") }, singleLine = true)
                OutlinedTextField(dataPoll, { dataPoll = it.filter(Char::isDigit) }, Modifier.weight(1f), label = { Text("Daten-Polling (optional)") }, singleLine = true)
            }
            error?.let { Text(it, color = Color(0xFFFF8799), fontSize = 12.sp) }
            Button(onClick = { try { require(pairingCode.length == 6) { "Bitte den 6-stelligen Pairing-Code eingeben." }; onConnect(url, pairingCode, secret, configPoll.toIntOrNull(), dataPoll.toIntOrNull()); error = null } catch (exception: Exception) { error = exception.message } }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C5CFF))) { Text("Sicher verbinden") }
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
    Box(Modifier.fillMaxSize().background(parseColor(dashboard.settings.background)).padding(12.dp)) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val cellWidth = maxWidth / dashboard.settings.columns
            val cellHeight = maxHeight / dashboard.settings.rows
            dashboard.widgets.forEach { widget ->
                val width = cellWidth * widget.width.coerceAtMost(dashboard.settings.columns - widget.x)
                val height = cellHeight * widget.height.coerceAtMost(dashboard.settings.rows - widget.y)
                DashboardWidgetView(widget, controller.values[widget.dataSourceId], Modifier.offset(cellWidth * widget.x, cellHeight * widget.y).size(width - 6.dp, height - 6.dp))
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
