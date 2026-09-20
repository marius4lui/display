package com.marius4lui.display.system

internal class AmbientPowerState {
    enum class State { NORMAL, REQUESTING_AMBIENT, AMBIENT, OFF }
    enum class Action { NONE, SHOW_AMBIENT, SHOW_CLOCK }

    var state = State.NORMAL
        private set

    fun screenOff(): Action = when (state) {
        State.NORMAL -> {
            state = State.REQUESTING_AMBIENT
            Action.SHOW_AMBIENT
        }
        State.REQUESTING_AMBIENT -> Action.NONE
        State.AMBIENT -> {
            state = State.OFF
            Action.NONE
        }
        State.OFF -> Action.NONE
    }

    fun screenOn(): Action = when (state) {
        State.OFF -> {
            state = State.NORMAL
            Action.SHOW_CLOCK
        }
        else -> Action.NONE
    }

    fun ambientShown() {
        state = State.AMBIENT
    }

    fun normalShown() {
        state = State.NORMAL
    }
}
