package com.kmuc.display

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class DashboardModelsTest {
    @Test
    fun preservesCustomUiAndResponsiveWidgetStyle() {
        val document = parseDashboardDocument(
            """
            {
              "schemaVersion": 6,
              "name": "Parity",
              "settings": { "columns": 12, "rows": 8 },
              "pages": [{
                "id": "main",
                "name": "Main",
                "widgets": [{
                  "id": "clock",
                  "type": "clock",
                  "title": "Uhrzeit",
                  "x": 8,
                  "y": 0,
                  "width": 4,
                  "height": 3,
                  "errorBehavior": "stale",
                  "style": {
                    "background": "#7c5cff",
                    "foreground": "#ffffff",
                    "accent": "#b8a9ff",
                    "align": "left",
                    "verticalAlign": "center",
                    "fontScale": 170
                  }
                }]
              }],
              "customUi": {
                "version": 1,
                "enabled": true,
                "pages": {
                  "main": {
                    "type": "grid",
                    "style": { "columns": 3, "gap": 16 },
                    "children": []
                  }
                }
              }
            }
            """.trimIndent(),
        )

        val widget = document.pages.single().widgets.single()
        assertEquals("center", widget.style.verticalAlign)
        assertEquals(170, widget.style.fontScale)
        assertNotNull(document.customUi?.optJSONObject("pages")?.optJSONObject("main"))
        assertEquals(3, document.customUi?.optJSONObject("pages")?.optJSONObject("main")?.optJSONObject("style")?.optInt("columns"))
    }

    @Test
    fun clampsWidgetFontScaleToWebSchemaLimits() {
        fun parseScale(scale: Int): Int = parseDashboardDocument(
            """{"schemaVersion":6,"settings":{},"pages":[{"id":"main","widgets":[{"id":"value","type":"value","title":"Value","x":0,"y":0,"width":1,"height":1,"errorBehavior":"stale","style":{"fontScale":$scale}}]}]}""",
        ).pages.single().widgets.single().style.fontScale

        assertEquals(25, parseScale(1))
        assertEquals(300, parseScale(999))
    }
}
