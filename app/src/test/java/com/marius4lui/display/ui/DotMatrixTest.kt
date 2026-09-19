package com.marius4lui.display.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class DotMatrixTest {
    @Test fun allTimesFitTheClockCardWithoutLayoutJumps() {
        val expected = DotMatrix.clockWidth("00:00", 15.3f)
        assertTrue(expected < 570f)
        for (hour in 0..23) for (minute in 0..59) {
            val value = "%02d:%02d".format(Locale.ROOT, hour, minute)
            assertEquals(expected, DotMatrix.clockWidth(value, 15.3f), .001f)
        }
    }

    @Test fun widthsScaleWithTheCanvasAndEmptyClockHasZeroWidth() {
        assertEquals(0f, DotMatrix.clockWidth("", 15.3f), .001f)
        assertEquals(DotMatrix.clockWidth("12:34", 10f) * 2, DotMatrix.clockWidth("12:34", 20f), .001f)
    }

    @Test fun wordmarkMeasurementMatchesCaseInsensitiveRendering() {
        assertEquals(DotMatrix.width("DISPLAY", 4f), DotMatrix.width("display", 4f), .001f)
        assertEquals(0f, DotMatrix.width("", 4f), .001f)
    }
}
