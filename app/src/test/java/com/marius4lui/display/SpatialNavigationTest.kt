package com.marius4lui.display

import org.junit.Assert.assertEquals
import org.junit.Test

class SpatialNavigationTest {
    @Test
    fun clockSwipesToThePageInThatDirection() {
        assertEquals("apps", SpatialNavigation.destination("clock", 200f))
        assertEquals("home", SpatialNavigation.destination("clock", -200f))
    }

    @Test
    fun reverseSwipeReturnsToClock() {
        assertEquals("clock", SpatialNavigation.destination("apps", -200f))
        assertEquals("clock", SpatialNavigation.destination("home", 200f))
    }

    @Test
    fun outerEdgesDoNotWrap() {
        assertEquals("apps", SpatialNavigation.destination("apps", 200f))
        assertEquals("home", SpatialNavigation.destination("home", -200f))
    }
}
