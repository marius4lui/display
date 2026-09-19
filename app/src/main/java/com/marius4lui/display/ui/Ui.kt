package com.marius4lui.display.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object Ui {
    const val RED = 0xffd92d20.toInt()
    const val INK = 0xff111111.toInt()
    const val PAPER = 0xffeeeeeb.toInt()
    const val SURFACE = Color.WHITE
    const val MUTED = 0xff666666.toInt()
    const val LINE = 0xffd8d8d2.toInt()

    fun tr(de: String, en: String) = if (java.util.Locale.getDefault().language == "de") de else en

    fun dp(context: Context, value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    fun title(context: Context, text: String) = TextView(context).apply {
        this.text = text
        textSize = 25f
        letterSpacing = -0.025f
        setTextColor(INK)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        gravity = Gravity.CENTER_VERTICAL
    }

    fun body(context: Context, text: String) = TextView(context).apply {
        this.text = text
        textSize = 14f
        setTextColor(MUTED)
        setLineSpacing(0f, 1.2f)
    }

    fun button(context: Context, text: String, onClick: () -> Unit) = Button(context).apply {
        this.text = text
        setTextColor(INK)
        background = RippleDrawable(ColorStateList.valueOf(0x18000000), panelDrawable(context), null)
        isAllCaps = false
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        textSize = 13f
        letterSpacing = 0.01f
        stateListAnimator = null
        elevation = 0f
        minimumWidth = 0
        setPadding(dp(context, 18), 0, dp(context, 18), 0)
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

    fun panelDrawable(context: Context, fill: Int = SURFACE, stroke: Int = fill, radius: Int = 24) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        setStroke(dp(context, 1), stroke)
        cornerRadius = dp(context, radius).toFloat()
    }

    fun iconButton(context: Context, label: String, glyph: String, action: () -> Unit) =
        button(context, label, action).apply {
            val icon = GlyphDrawable(glyph)
            val size = dp(context, 20)
            icon.setBounds(0, 0, size, size)
            setCompoundDrawables(icon, null, null, null)
            compoundDrawablePadding = dp(context, 12)
            contentDescription = label
        }
}
