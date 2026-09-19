package com.marius4lui.display.clock

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View
import com.marius4lui.display.storage.DisplaySettings
import com.marius4lui.display.ui.DotMatrix
import com.marius4lui.display.ui.Ui
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * The face is drawn in a 960 x 392 design space. No animation loop: a minute tick,
 * or a one-second tick only when explicitly enabled. All glyphs are original.
 */
class DotClockView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()
    private val sans = Typeface.create("sans-serif", Typeface.NORMAL)
    private val medium = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val mono = Typeface.create("monospace", Typeface.NORMAL)
    private var settings = DisplaySettings()
    private var weatherLine = ""
    private var homeLine = ""
    private val ticker = object : Runnable {
        override fun run() {
            invalidate()
            val interval = if (settings.showSeconds) 1_000L else 60_000L
            postDelayed(this, interval - System.currentTimeMillis() % interval)
        }
    }

    init {
        setBackgroundColor(Ui.PAPER)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    fun bind(settings: DisplaySettings, weather: String = "", home: String = "") {
        this.settings = settings
        weatherLine = weather
        homeLine = home
        reschedule()
    }

    fun refreshTime() = reschedule()

    private fun reschedule() {
        removeCallbacks(ticker)
        invalidate()
        if (isAttachedToWindow && windowVisibility == VISIBLE) post(ticker)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        reschedule()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        removeCallbacks(ticker)
        if (visibility == VISIBLE && isAttachedToWindow) post(ticker)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(ticker)
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = ZonedDateTime.now()
        val scale = min(width / 960f, height / 392f)
        canvas.save()
        canvas.translate((width - 960 * scale) / 2f, (height - 392 * scale) / 2f)
        canvas.scale(scale, scale)

        // Quiet header with a dotted wordmark and a single red registration point.
        DotMatrix.draw(canvas, "DISPLAY", 30f, 21f, 3.2f, Ui.INK, paint)
        fill(Ui.RED)
        canvas.drawCircle(189f, 31f, 4f, paint)
        text(canvas, "TIME, SIMPLIFIED.", 219f, 36f, 11f, Ui.MUTED, mono, spacing = .08f)
        text(canvas, "LOCAL / " + now.format(DateTimeFormatter.ofPattern("O")), 926f, 36f, 11f, Ui.MUTED, mono, Paint.Align.RIGHT)

        // Main clock tile. Thin, high-density dots replace the old oversized 3-column digits.
        card(canvas, 24f, 68f, 642f, 368f)
        text(canvas, Ui.tr("LOKALZEIT", "LOCAL TIME"), 49f, 98f, 11f, Ui.MUTED, mono, spacing = .12f)
        fill(Ui.RED)
        canvas.drawCircle(611f, 94f, 4f, paint)
        val hour = if (settings.use24Hour) now.hour else (now.hour + 11) % 12 + 1
        val formatted = "%02d:%02d".format(Locale.ROOT, hour, now.minute)
        val cell = 15.3f
        val digitWidth = DotMatrix.clockWidth(formatted, cell)
        DotMatrix.drawClock(canvas, formatted, 333f - digitWidth / 2f, 128f, cell, Ui.INK, paint)

        if (settings.showSeconds) {
            text(canvas, "%02d".format(now.second), 604f, 316f, 22f, Ui.RED, mono, Paint.Align.RIGHT)
            text(canvas, Ui.tr("SEK", "SEC"), 604f, 339f, 9f, Ui.MUTED, mono, Paint.Align.RIGHT)
        } else {
            val label = if (settings.use24Hour) "24H" else if (now.hour < 12) "AM" else "PM"
            text(canvas, label, 610f, 338f, 10f, Ui.MUTED, mono, Paint.Align.RIGHT)
        }

        // One dot per hour, the current hour is the red marker.
        for (i in 0..23) {
            fill(when { i == now.hour -> Ui.RED; i < now.hour -> Ui.INK; else -> Ui.LINE })
            canvas.drawCircle(52f + i * 10.5f, 336f, if (i == now.hour) 3.2f else 2f, paint)
        }
        text(canvas, Ui.tr("DER TAG IN PUNKTEN", "THE DAY IN DOTS"), 51f, 355f, 8f, Ui.MUTED, mono, spacing = .05f)

        // Right-hand modules align with the clock tile.
        card(canvas, 656f, 68f, 936f, 211f)
        if (settings.showDate) {
            val dayName = now.format(DateTimeFormatter.ofPattern("EEEE", Locale.getDefault())).uppercase(Locale.getDefault())
            text(canvas, dayName, 678f, 97f, 11f, Ui.MUTED, mono, spacing = .06f)
            text(canvas, now.dayOfMonth.toString().padStart(2, '0'), 675f, 178f, 66f, Ui.INK, sans)
            text(canvas, now.format(DateTimeFormatter.ofPattern("MMM", Locale.getDefault())).uppercase(Locale.getDefault()), 778f, 141f, 13f, Ui.INK, mono)
            text(canvas, now.year.toString(), 778f, 162f, 11f, Ui.MUTED, mono)
            for (i in 0..6) {
                fill(if (i + 1 == now.dayOfWeek.value) Ui.RED else Ui.LINE)
                canvas.drawCircle(783f + i * 16f, 183f, 3f, paint)
            }
        } else {
            dial(canvas, 728f, 140f, 50f, now)
            text(canvas, Ui.tr("DEIN MOMENT.", "YOUR MOMENT."), 800f, 135f, 11f, Ui.INK, mono)
            text(canvas, Ui.tr("Ganz in Ruhe.", "Take it slow."), 800f, 158f, 12f, Ui.MUTED)
        }
        card(canvas, 656f, 225f, 936f, 368f)
        if (settings.weatherEnabled) {
            text(canvas, Ui.tr("DRAUSSEN", "OUTSIDE"), 678f, 252f, 11f, Ui.MUTED, mono, spacing = .08f)
            sun(canvas, 704f, 299f, 17f)
            val value = weatherLine.substringBefore("  ").ifBlank { "—" }
            text(canvas, value, 744f, 313f, 34f, Ui.INK, sans)
            fitText(canvas, settings.weatherPlace.ifBlank { Ui.tr("Wetter wird geladen", "Loading weather") }, 678f, 345f, 230f, 12f)
        } else if (settings.homeAssistantEnabled) {
            text(canvas, "HOME ASSISTANT", 678f, 252f, 11f, Ui.MUTED, mono, spacing = .04f)
            DotMatrix.draw(canvas, "HOME", 679f, 274f, 4f, Ui.INK, paint)
            fitText(canvas, homeLine.ifBlank { Ui.tr("Werte werden geladen", "Loading entities") }, 678f, 345f, 230f, 12f)
        } else {
            dial(canvas, 726f, 297f, 50f, now)
            text(canvas, Ui.tr("IM HIER", "RIGHT HERE."), 797f, 291f, 12f, Ui.INK, mono)
            text(canvas, Ui.tr("UND JETZT.", "RIGHT NOW."), 797f, 310f, 12f, Ui.INK, mono)
            text(canvas, now.zone.id.substringAfterLast('/').replace('_', ' '), 797f, 337f, 11f, Ui.MUTED)
        }
        canvas.restore()
        contentDescription = formatted + if (settings.showSeconds) ":%02d".format(now.second) else ""
    }

    private fun card(canvas: Canvas, l: Float, t: Float, r: Float, b: Float) {
        fill(Ui.SURFACE)
        rect.set(l, t, r, b)
        canvas.drawRoundRect(rect, 30f, 30f, paint)
    }

    private fun dial(canvas: Canvas, x: Float, y: Float, radius: Float, now: ZonedDateTime) {
        fill(Ui.PAPER)
        canvas.drawCircle(x, y, radius + 5, paint)
        for (i in 0..59) {
            val a = Math.toRadians(i * 6.0 - 90)
            fill(if (i % 5 == 0) Ui.INK else Ui.LINE)
            canvas.drawCircle(x + cos(a).toFloat() * radius, y + sin(a).toFloat() * radius, if (i % 5 == 0) 1.9f else 1f, paint)
        }
        hand(canvas, x, y, radius * .48f, (now.hour % 12 + now.minute / 60f) * 30f, Ui.INK, 4f)
        hand(canvas, x, y, radius * .75f, now.minute * 6f, Ui.INK, 2.5f)
        if (settings.showSeconds) hand(canvas, x, y, radius * .85f, now.second * 6f, Ui.RED, 1.3f)
        fill(Ui.RED)
        canvas.drawCircle(x, y, 4f, paint)
    }

    private fun hand(canvas: Canvas, x: Float, y: Float, length: Float, degrees: Float, color: Int, stroke: Float) {
        val angle = Math.toRadians(degrees.toDouble() - 90)
        fill(color)
        paint.strokeWidth = stroke
        paint.strokeCap = Paint.Cap.ROUND
        canvas.drawLine(x, y, x + cos(angle).toFloat() * length, y + sin(angle).toFloat() * length, paint)
    }

    private fun sun(canvas: Canvas, x: Float, y: Float, radius: Float) {
        fill(Ui.RED)
        for (i in 0..11) {
            val a = Math.toRadians(i * 30.0)
            canvas.drawCircle(x + cos(a).toFloat() * (radius + 6), y + sin(a).toFloat() * (radius + 6), 1.8f, paint)
        }
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2f
        canvas.drawCircle(x, y, radius * .7f, paint)
        paint.style = Paint.Style.FILL
    }

    private fun fill(color: Int) { paint.color = color; paint.style = Paint.Style.FILL }

    private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int,
                     font: Typeface = medium, align: Paint.Align = Paint.Align.LEFT, spacing: Float = 0f) {
        textPaint.color = color
        textPaint.textSize = size
        textPaint.typeface = font
        textPaint.textAlign = align
        if (spacing == 0f) {
            canvas.drawText(value, x, y, textPaint)
        } else {
            val gap = size * spacing
            val total = textPaint.measureText(value) + gap * (value.length - 1).coerceAtLeast(0)
            var cursor = when (align) {
                Paint.Align.RIGHT -> x - total
                Paint.Align.CENTER -> x - total / 2f
                else -> x
            }
            textPaint.textAlign = Paint.Align.LEFT
            for (i in value.indices) {
                canvas.drawText(value, i, i + 1, cursor, y, textPaint)
                cursor += textPaint.measureText(value, i, i + 1) + gap
            }
        }
    }

    private fun fitText(canvas: Canvas, value: String, x: Float, y: Float, width: Float, size: Float) {
        textPaint.typeface = sans
        textPaint.textSize = size
        var fitted = value
        while (fitted.length > 1 && textPaint.measureText(fitted) > width) fitted = fitted.dropLast(1)
        if (fitted != value) fitted = fitted.dropLast(1) + "…"
        text(canvas, fitted, x, y, size, Ui.MUTED, sans)
    }

}
