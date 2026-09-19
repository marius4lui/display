package com.marius4lui.display.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.net.InetAddress

object NetworkPolicy {
    fun validateHomeAssistantUrl(rawUrl: String, allowPrivateHttp: Boolean): Result<HttpUrl> = runCatching {
        val url = rawUrl.trim().trimEnd('/').toHttpUrl()
        require(url.scheme == "https" || url.scheme == "http") { "Only HTTP and HTTPS are supported" }
        if (url.scheme == "http") {
            require(allowPrivateHttp) { "HTTP must be explicitly enabled" }
            val addresses = InetAddress.getAllByName(url.host)
            require(addresses.isNotEmpty() && addresses.all(::isPrivate)) { "HTTP is restricted to private networks" }
        }
        url
    }

    internal fun isPrivate(address: InetAddress): Boolean {
        if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress || address.isSiteLocalAddress) return true
        val bytes = address.address.map(Byte::toInt).map { it and 0xff }
        if (bytes.size == 4) {
            return bytes[0] == 10 ||
                (bytes[0] == 172 && bytes[1] in 16..31) ||
                (bytes[0] == 192 && bytes[1] == 168) ||
                (bytes[0] == 100 && bytes[1] in 64..127)
        }
        return address.hostAddress?.startsWith("fc", true) == true || address.hostAddress?.startsWith("fd", true) == true
    }
}
