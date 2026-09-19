package com.marius4lui.display.network

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress

class NetworkPolicyTest {
    @Test fun privateRangesAreAccepted() {
        assertTrue(NetworkPolicy.isPrivate(InetAddress.getByName("10.0.0.1")))
        assertTrue(NetworkPolicy.isPrivate(InetAddress.getByName("172.16.2.1")))
        assertTrue(NetworkPolicy.isPrivate(InetAddress.getByName("192.168.10.2")))
        assertTrue(NetworkPolicy.isPrivate(InetAddress.getByName("127.0.0.1")))
    }

    @Test fun publicRangesAreRejected() {
        assertFalse(NetworkPolicy.isPrivate(InetAddress.getByName("8.8.8.8")))
        assertFalse(NetworkPolicy.isPrivate(InetAddress.getByName("1.1.1.1")))
    }
}
