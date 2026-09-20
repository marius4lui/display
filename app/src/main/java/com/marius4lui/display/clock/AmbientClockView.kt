package com.marius4lui.display.clock

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.View
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

class AmbientClockView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(105, 105, 105)
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
    }
    private val ticker = object : Runnable {
        override fun run() {
            invalidate()
            postDelayed(this, 60_000L - System.currentTimeMillis() % 60_000L)
        }
    }

    init {
        setBackgroundColor(Color.BLACK)
        contentDescription = "Always-On-Display"
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        post(ticker)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(ticker)
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val now = ZonedDateTime.now()
        // The minute-dependent offset prevents one static LCD pattern for hours.
        val shiftX = ((now.minute % 5) - 2) * width * .018f
        val shiftY = (((now.minute / 5) % 3) - 1) * height * .035f
        paint.textSize = height * .31f
        canvas.drawText("%02d:%02d".format(Locale.ROOT, now.hour, now.minute), width / 2f + shiftX, height * .54f + shiftY, paint)
        paint.textSize = height * .055f
        canvas.drawText(now.format(DateTimeFormatter.ofPattern("EEE, d. MMM", Locale.getDefault())), width / 2f + shiftX, height * .66f + shiftY, paint)
    }
}
