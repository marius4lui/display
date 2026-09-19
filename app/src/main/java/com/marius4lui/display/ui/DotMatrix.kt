package com.marius4lui.display.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.view.View
import java.util.Locale

/** Original, code-native dot lettering. No proprietary fonts or image textures. */
object DotMatrix {
    private fun rows(value: String) = value.split("/")
    private val digits = mapOf(
        '0' to rows("0011100/0100010/1000001/1000001/1000001/1000001/1000001/1000001/1000001/0100010/0011100"),
        '1' to rows("0001000/0011000/0101000/0001000/0001000/0001000/0001000/0001000/0001000/0001000/0111110"),
        '2' to rows("0011100/0100010/1000001/0000001/0000010/0000100/0001000/0010000/0100000/1000000/1111111"),
        '3' to rows("0111110/1000001/0000001/0000001/0000010/0011100/0000010/0000001/0000001/1000001/0111110"),
        '4' to rows("0000010/0000110/0001010/0010010/0100010/1000010/1111111/0000010/0000010/0000010/0000010"),
        '5' to rows("1111111/1000000/1000000/1000000/1111100/0000010/0000001/0000001/0000001/1000010/0111100"),
        '6' to rows("0011110/0100001/1000000/1000000/1011100/1100010/1000001/1000001/1000001/0100010/0011100"),
        '7' to rows("1111111/0000001/0000010/0000010/0000100/0000100/0001000/0001000/0010000/0010000/0010000"),
        '8' to rows("0011100/0100010/1000001/1000001/0100010/0011100/0100010/1000001/1000001/0100010/0011100"),
        '9' to rows("0011100/0100010/1000001/1000001/1000001/0100011/0011101/0000001/0000001/1000010/0111100"),
        ':' to rows("0/0/0/1/0/0/0/1/0/0/0"),
    )
    private val letters = mapOf(
        'A' to "01110/10001/10001/11111/10001/10001/10001",
        'B' to "11110/10001/10001/11110/10001/10001/11110",
        'C' to "01111/10000/10000/10000/10000/10000/01111",
        'D' to "11110/10001/10001/10001/10001/10001/11110",
        'E' to "11111/10000/10000/11110/10000/10000/11111",
        'F' to "11111/10000/10000/11110/10000/10000/10000",
        'G' to "01111/10000/10000/10111/10001/10001/01111",
        'H' to "10001/10001/10001/11111/10001/10001/10001",
        'I' to "111/010/010/010/010/010/111",
        'J' to "00111/00010/00010/00010/10010/10010/01100",
        'K' to "10001/10010/10100/11000/10100/10010/10001",
        'L' to "10000/10000/10000/10000/10000/10000/11111",
        'M' to "10001/11011/10101/10101/10001/10001/10001",
        'N' to "10001/11001/11001/10101/10011/10011/10001",
        'O' to "01110/10001/10001/10001/10001/10001/01110",
        'P' to "11110/10001/10001/11110/10000/10000/10000",
        'Q' to "01110/10001/10001/10001/10101/10010/01101",
        'R' to "11110/10001/10001/11110/10100/10010/10001",
        'S' to "01111/10000/10000/01110/00001/00001/11110",
        'T' to "11111/00100/00100/00100/00100/00100/00100",
        'U' to "10001/10001/10001/10001/10001/10001/01110",
        'V' to "10001/10001/10001/10001/01010/01010/00100",
        'W' to "10001/10001/10001/10101/10101/11011/10001",
        'X' to "10001/10001/01010/00100/01010/10001/10001",
        'Y' to "10001/10001/01010/00100/00100/00100/00100",
        'Z' to "11111/00001/00010/00100/01000/10000/11111",
        ' ' to "000/000/000/000/000/000/000"
    ).mapValues { rows(it.value) }

    fun clockWidth(value: String, cell: Float) =
        (value.sumOf { digits[it]?.first()?.length ?: 0 } + (value.length - 1).coerceAtLeast(0) * 1.5f) * cell

    fun drawClock(canvas: Canvas, value: String, x: Float, y: Float, cell: Float, color: Int, paint: Paint) =
        render(canvas, value.mapNotNull { digits[it] }, x, y, cell, color, paint, 1.5f, .255f)

    fun width(value: String, cell: Float) =
        value.uppercase(Locale.ROOT).sumOf { (letters[it] ?: letters.getValue(' '))[0].length + 1 }.toFloat() * cell

    fun draw(canvas: Canvas, value: String, x: Float, y: Float, cell: Float, color: Int, paint: Paint) =
        render(canvas, value.uppercase(Locale.ROOT).map { letters[it] ?: letters.getValue(' ') }, x, y, cell, color, paint, 1f, .32f)

    private fun render(canvas: Canvas, glyphs: List<List<String>>, left: Float, top: Float, cell: Float,
                       color: Int, paint: Paint, gap: Float, dotRadius: Float) {
        paint.color = color
        paint.style = Paint.Style.FILL
        var x = left
        glyphs.forEach { glyph ->
            glyph.forEachIndexed { row, line ->
                line.forEachIndexed { col, bit ->
                    if (bit == '1') canvas.drawCircle(x + (col + .5f) * cell, top + (row + .5f) * cell, cell * dotRadius, paint)
                }
            }
            x += (glyph[0].length + gap) * cell
        }
    }
}

class DotLabelView(context: Context, private val label: String, private val centered: Boolean = false) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    init { contentDescription = label; importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES }
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(resolveSize(Ui.dp(context, 200), widthMeasureSpec), resolveSize(Ui.dp(context, 40), heightMeasureSpec))
    }
    override fun onDraw(canvas: Canvas) {
        val cell = minOf(Ui.dp(context, 4).toFloat(), width / DotMatrix.width(label, 1f), height / 9f)
        val x = if (centered) (width - DotMatrix.width(label, cell)) / 2f else 0f
        DotMatrix.draw(canvas, label, x, (height - cell * 7) / 2f, cell, Ui.INK, paint)
    }
}
