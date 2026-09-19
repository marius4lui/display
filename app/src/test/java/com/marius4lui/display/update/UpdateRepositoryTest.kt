package com.marius4lui.display.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UpdateRepositoryTest {
    @Test fun semanticTagMapsToMonotonicCode() {
        assertEquals(100, releaseVersionCode("v0.1.0"))
        assertEquals(10_203, releaseVersionCode("v1.2.3"))
        assertNull(releaseVersionCode("latest"))
    }
}
