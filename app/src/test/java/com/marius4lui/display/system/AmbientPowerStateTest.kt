package com.marius4lui.display.system

import org.junit.Assert.assertEquals
import org.junit.Test

class AmbientPowerStateTest {
    @Test fun `first off shows ambient and second off stays off`() {
        val state = AmbientPowerState()
        assertEquals(AmbientPowerState.Action.SHOW_AMBIENT, state.screenOff())
        assertEquals(AmbientPowerState.Action.NONE, state.screenOn())
        state.ambientShown()
        assertEquals(AmbientPowerState.Action.NONE, state.screenOff())
        assertEquals(AmbientPowerState.State.OFF, state.state)
    }

    @Test fun `physical wake after off restores clock`() {
        val state = AmbientPowerState()
        state.screenOff()
        state.ambientShown()
        state.screenOff()
        assertEquals(AmbientPowerState.Action.SHOW_CLOCK, state.screenOn())
        assertEquals(AmbientPowerState.State.NORMAL, state.state)
    }
}
