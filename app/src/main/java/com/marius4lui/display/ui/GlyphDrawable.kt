package com.marius4lui.display.ui

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import kotlin.math.cos
import kotlin.math.sin

class GlyphDrawable(private val glyph: String, private val tint: Int = Ui.INK) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tint; strokeWidth = 1.7f; strokeCap = Paint.Cap.ROUND }
    override fun draw(canvas: Canvas) {
        canvas.save()
        canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
        canvas.scale(bounds.width() / 24f, bounds.height() / 24f)
        paint.color = tint
        paint.style = Paint.Style.STROKE
        when (glyph) {
            "apps" -> {
                paint.style = Paint.Style.FILL
                for (r in 0..2) for (c in 0..2) canvas.drawCircle(5f + c * 7f, 5f + r * 7f, 1.8f, paint)
            }
            "settings" -> {
                for (i in 0..2) {
                    val x = 5f + i * 7f
                    canvas.drawLine(x, 3f, x, 21f, paint)
                    paint.style = Paint.Style.FILL
                    canvas.drawCircle(x, if (i == 1) 16f else 8f, 3f, paint)
                    paint.style = Paint.Style.STROKE
                }
            }
            "home" -> {
                canvas.drawLine(3f, 11f, 12f, 3f, paint); canvas.drawLine(12f, 3f, 21f, 11f, paint)
                canvas.drawLine(6f, 9f, 6f, 21f, paint); canvas.drawLine(18f, 9f, 18f, 21f, paint)
                canvas.drawLine(6f, 21f, 18f, 21f, paint); canvas.drawLine(12f, 15f, 12f, 21f, paint)
            }
            "back" -> {
                canvas.drawLine(19f, 12f, 4f, 12f, paint)
                canvas.drawLine(4f, 12f, 10f, 6f, paint); canvas.drawLine(4f, 12f, 10f, 18f, paint)
            }
            "sun" -> {
                canvas.drawCircle(12f, 12f, 4f, paint)
                paint.style = Paint.Style.FILL
                for (i in 0..7) {
                    val a = Math.toRadians(i * 45.0)
                    canvas.drawCircle(12 + cos(a).toFloat() * 9, 12 + sin(a).toFloat() * 9, 1f, paint)
                }
            }
            else -> { canvas.drawCircle(12f, 12f, 9f, paint); canvas.drawLine(12f, 5f, 12f, 12f, paint); canvas.drawLine(12f, 12f, 17f, 15f, paint) }
        }
        canvas.restore()
    }
    override fun setAlpha(alpha: Int) { paint.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter }
    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT
}
