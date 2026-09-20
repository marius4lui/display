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
 * The face is drawn in the Echo Show's complete 960 x 480 surface. No animation loop: a minute tick,
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
        val scale = min(width / 960f, height / 480f)
        canvas.save()
        canvas.translate((width - 960 * scale) / 2f, (height - 480 * scale) / 2f)
        canvas.scale(scale, scale)

        // The clock uses the full panel; redundant product and location labels are omitted.
        card(canvas, 24f, 16f, 700f, 464f)
        text(canvas, Ui.tr("LOKALZEIT", "LOCAL TIME"), 52f, 52f, 14f, Ui.MUTED, mono, spacing = .1f)
        fill(Ui.RED)
        canvas.drawCircle(668f, 47f, 5f, paint)
        val hour = if (settings.use24Hour) now.hour else (now.hour + 11) % 12 + 1
        val formatted = "%02d:%02d".format(Locale.ROOT, hour, now.minute)
        val cell = 19f
        val digitWidth = DotMatrix.clockWidth(formatted, cell)
        DotMatrix.drawClock(canvas, formatted, 362f - digitWidth / 2f, 112f, cell, Ui.INK, paint)

        if (settings.showSeconds) {
            text(canvas, "%02d".format(now.second), 660f, 411f, 27f, Ui.RED, mono, Paint.Align.RIGHT)
            text(canvas, Ui.tr("SEK", "SEC"), 660f, 433f, 11f, Ui.MUTED, mono, Paint.Align.RIGHT)
        } else {
            val label = if (settings.use24Hour) "24H" else if (now.hour < 12) "AM" else "PM"
            text(canvas, label, 668f, 434f, 12f, Ui.MUTED, mono, Paint.Align.RIGHT)
        }

        // One dot per hour, the current hour is the red marker.
        for (i in 0..23) {
            fill(when { i == now.hour -> Ui.RED; i < now.hour -> Ui.INK; else -> Ui.LINE })
            canvas.drawCircle(53f + i * 13f, 430f, if (i == now.hour) 3.8f else 2.5f, paint)
        }

        card(canvas, 714f, 16f, 936f, 231f)
        if (settings.showDate) {
            val dayName = now.format(DateTimeFormatter.ofPattern("EEEE", Locale.getDefault())).uppercase(Locale.getDefault())
            text(canvas, dayName, 736f, 50f, 13f, Ui.MUTED, mono, spacing = .04f)
            text(canvas, now.dayOfMonth.toString().padStart(2, '0'), 733f, 171f, 84f, Ui.INK, sans)
            text(canvas, now.format(DateTimeFormatter.ofPattern("MMM", Locale.getDefault())).uppercase(Locale.getDefault()), 842f, 126f, 15f, Ui.INK, mono)
            text(canvas, now.year.toString(), 842f, 150f, 13f, Ui.MUTED, mono)
            for (i in 0..6) {
                fill(if (i + 1 == now.dayOfWeek.value) Ui.RED else Ui.LINE)
                canvas.drawCircle(810f + i * 17f, 207f, 3.4f, paint)
            }
        } else {
            dial(canvas, 782f, 145f, 55f, now)
            text(canvas, if (settings.use24Hour) "24H" else if (now.hour < 12) "AM" else "PM", 860f, 151f, 16f, Ui.INK, mono)
        }
        card(canvas, 714f, 245f, 936f, 464f)
        if (settings.weatherEnabled) {
            text(canvas, Ui.tr("DRAUSSEN", "OUTSIDE"), 736f, 272f, 13f, Ui.MUTED, mono, spacing = .06f)
            sun(canvas, 762f, 324f, 19f)
            val value = weatherLine.substringBefore("  ").ifBlank { "—" }
            text(canvas, value, 800f, 340f, 38f, Ui.INK, sans)
            fitText(canvas, settings.weatherPlace.ifBlank { Ui.tr("Wetter wird geladen", "Loading weather") }, 736f, 375f, 180f, 14f)
        } else if (settings.homeAssistantEnabled) {
            text(canvas, "HOME ASSISTANT", 736f, 272f, 12f, Ui.MUTED, mono, spacing = .03f)
            DotMatrix.draw(canvas, "HOME", 736f, 294f, 4.8f, Ui.INK, paint)
            fitText(canvas, homeLine.ifBlank { Ui.tr("Werte werden geladen", "Loading entities") }, 736f, 375f, 180f, 14f)
        } else {
            dial(canvas, 786f, 354f, 62f, now)
            text(canvas, Ui.tr("JETZT", "NOW"), 861f, 349f, 15f, Ui.INK, mono)
            text(canvas, now.format(DateTimeFormatter.ofPattern("O")), 861f, 374f, 13f, Ui.MUTED, mono)
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
