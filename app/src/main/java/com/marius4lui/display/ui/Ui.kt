package com.marius4lui.display.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object Ui {
    const val RED = 0xffff3b30.toInt()
    const val INK = 0xff111111.toInt()
    const val PAPER = 0xfff7f7f4.toInt()
    const val SURFACE = Color.WHITE
    const val MUTED = 0xff666666.toInt()
    const val LINE = 0xffd8d8d2.toInt()

    fun dp(context: Context, value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    fun title(context: Context, text: String) = TextView(context).apply {
        this.text = text
        textSize = 27f
        letterSpacing = 0.06f
        setTextColor(INK)
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER_VERTICAL
    }

    fun body(context: Context, text: String) = TextView(context).apply {
        this.text = text
        textSize = 15f
        setTextColor(MUTED)
        setLineSpacing(0f, 1.2f)
    }

    fun button(context: Context, text: String, onClick: () -> Unit) = Button(context).apply {
        this.text = text
        setTextColor(INK)
        background = panelDrawable(context, SURFACE, INK)
        isAllCaps = true
        textSize = 13f
        letterSpacing = 0.09f
        minHeight = dp(context, 52)
        setOnClickListener { onClick() }
    }

    fun column(context: Context) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(context, 28), dp(context, 20), dp(context, 28), dp(context, 20))
        setBackgroundColor(PAPER)
    }

    fun addSpace(group: ViewGroup, height: Int = 10) {
        group.addView(View(group.context), ViewGroup.LayoutParams(1, dp(group.context, height)))
    }

    fun panelDrawable(context: Context, fill: Int = SURFACE, stroke: Int = LINE) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        setStroke(dp(context, 1), stroke)
        cornerRadius = dp(context, 2).toFloat()
    }
}
