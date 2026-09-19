package com.marius4lui.display.clock

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import com.marius4lui.display.storage.DisplaySettings
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.min

class DotClockView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private var settings = DisplaySettings()
    private var weatherLine = ""
    private var homeLine = ""
    private val ticker = object : Runnable {
        override fun run() {
            invalidate()
            val interval = if (settings.showSeconds) 1_000L else 60_000L
            postDelayed(this, interval - (System.currentTimeMillis() % interval))
        }
    }

    fun bind(settings: DisplaySettings, weather: String = "", home: String = "") {
        this.settings = settings
        weatherLine = weather
        homeLine = home
        setBackgroundColor(Color.rgb(247, 247, 244))
        invalidate()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        removeCallbacks(ticker)
        post(ticker)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(ticker)
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = ZonedDateTime.now()
        val hour = if (settings.use24Hour) now.hour else ((now.hour + 11) % 12) + 1
        val time = buildString {
            append(hour.toString().padStart(2, '0'))
            append(':')
            append(now.minute.toString().padStart(2, '0'))
            if (settings.showSeconds) {
                append(':')
                append(now.second.toString().padStart(2, '0'))
            }
        }
        val foreground = Color.rgb(17, 17, 17)
        dotPaint.color = foreground
        val contentTop = height * 0.08f
        val availableHeight = height * if (settings.showDate || weatherLine.isNotBlank() || homeLine.isNotBlank()) 0.58f else 0.82f
        drawDotText(canvas, time, width * 0.06f, contentTop, width * 0.88f, availableHeight)

        textPaint.color = foreground
        textPaint.textSize = min(width, height) * 0.045f
        var lineY = height * 0.76f
        if (settings.showDate) {
            val pattern = if (Locale.getDefault().language == "de") "EEEE, d. MMMM" else "EEEE, MMMM d"
            canvas.drawText(now.format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault())), width / 2f, lineY, textPaint)
            lineY += textPaint.textSize * 1.35f
        }
        val status = listOf(weatherLine, homeLine).filter(String::isNotBlank).joinToString("  •  ")
        if (status.isNotBlank()) {
            textPaint.color = Color.rgb(255, 59, 48)
            textPaint.textSize *= 0.78f
            canvas.drawText(status, width / 2f, lineY, textPaint)
        }

        // A subtle deterministic shift avoids an exactly static layout over long periods.
        translationX = ((SystemClock.elapsedRealtime() / 60_000L) % 5L - 2L).toFloat()
    }

    private fun drawDotText(canvas: Canvas, value: String, left: Float, top: Float, maxWidth: Float, maxHeight: Float) {
        val glyphs = value.map { patterns[it] ?: patterns.getValue(' ') }
        val columns = glyphs.sumOf { it[0].length } + (glyphs.size - 1)
        val dot = min(maxWidth / columns, maxHeight / 7f)
        val radius = dot * 0.31f
        val actualWidth = columns * dot
        var x = left + (maxWidth - actualWidth) / 2f
        glyphs.forEach { glyph ->
            for (row in glyph.indices) {
                for (col in glyph[row].indices) {
                    if (glyph[row][col] == '1') {
                        canvas.drawCircle(x + col * dot + dot / 2f, top + row * dot + dot / 2f, radius, dotPaint)
                    }
                }
            }
            x += (glyph[0].length + 1) * dot
        }
    }

    companion object {
        private val patterns = mapOf(
            '0' to listOf("111", "101", "101", "101", "101", "101", "111"),
            '1' to listOf("010", "110", "010", "010", "010", "010", "111"),
            '2' to listOf("111", "001", "001", "111", "100", "100", "111"),
            '3' to listOf("111", "001", "001", "111", "001", "001", "111"),
            '4' to listOf("101", "101", "101", "111", "001", "001", "001"),
            '5' to listOf("111", "100", "100", "111", "001", "001", "111"),
            '6' to listOf("111", "100", "100", "111", "101", "101", "111"),
            '7' to listOf("111", "001", "001", "010", "010", "100", "100"),
            '8' to listOf("111", "101", "101", "111", "101", "101", "111"),
            '9' to listOf("111", "101", "101", "111", "001", "001", "111"),
            ':' to listOf("0", "1", "0", "0", "1", "0", "0"),
            ' ' to listOf("0", "0", "0", "0", "0", "0", "0"),
        )
    }
}
