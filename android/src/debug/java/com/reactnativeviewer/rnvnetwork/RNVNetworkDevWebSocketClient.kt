package com.reactnativeviewer.rnvnetwork

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal class RNVNetworkDevWebSocketClient {
    var statusHandler: ((String, String?) -> Unit)? = null

    private val lock = Any()
    private var client: OkHttpClient? = null
    private var webSocket: WebSocket? = null
    private var urlString: String? = null
    private var maxQueueSize: Int = 8
    private var limitCapture = true
    private var socketOpen = false
    private var connectionHeaders: Map<String, String> = emptyMap()
    private val pendingMessages = mutableListOf<String>()

    fun configure(
        urlString: String?,
        maxQueueSize: Int,
        limitCapture: Boolean,
        connectionHeaders: Map<String, String>
    ) {
        synchronized(lock) {
            val normalizedURL = urlString?.takeIf { it.isNotBlank() }
            val urlChanged = this.urlString != normalizedURL || this.connectionHeaders != connectionHeaders

            this.urlString = normalizedURL
            this.maxQueueSize = maxQueueSize.coerceIn(1, 8)
            this.limitCapture = limitCapture
            this.connectionHeaders = connectionHeaders

            if (urlChanged) {
                disconnectLocked()
            }

            if (this.urlString != null) {
                emitStatus("configured", null)
                connectIfNeededLocked()
            } else {
                emitStatus("disabled", "Missing viewer URL.")
            }
        }
    }

    fun enqueueEnvelope(envelope: JSONObject) {
        synchronized(lock) {
            val message = envelope.toString()
            if (limitCapture && message.toByteArray(Charsets.UTF_8).size > 512 * 1024) return

            if (limitCapture && pendingMessages.size >= maxQueueSize) {
                pendingMessages.removeAt(0)
            }

            pendingMessages.add(message)
            connectIfNeededLocked()

            if (socketOpen) {
                flushPendingMessagesLocked()
            }
        }
    }

    fun disconnect() {
        synchronized(lock) {
            disconnectLocked()
        }
    }

    private fun connectIfNeededLocked() {
        if (socketOpen || webSocket != null || urlString.isNullOrBlank()) {
            return
        }

        val request = try {
            val builder = Request.Builder().url(requireNotNull(urlString))
            connectionHeaders.forEach { (key, value) ->
                builder.addHeader(key, value)
            }
            builder.build()
        } catch (error: IllegalArgumentException) {
            emitStatus("configuration_error", "Viewer URL is invalid.")
            return
        }

        val nextClient = OkHttpClient.Builder()
            .retryOnConnectionFailure(true)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

        client = nextClient
        webSocket = nextClient.newWebSocket(request, createListener())
        emitStatus("connecting", null)
    }

    private fun flushPendingMessagesLocked() {
        val activeWebSocket = webSocket ?: return
        if (!socketOpen || pendingMessages.isEmpty()) {
            return
        }

        val messages = pendingMessages.toList()
        pendingMessages.clear()

        for (message in messages) {
            val wasQueued = (!limitCapture || activeWebSocket.queueSize() < 4 * 1024 * 1024) && activeWebSocket.send(message)
            if (!wasQueued) {
                emitStatus("send_error", "Unable to queue websocket message.")
            }
        }
    }

    private fun disconnectLocked() {
        pendingMessages.clear()
        socketOpen = false
        webSocket?.close(1001, null)
        webSocket?.cancel()
        webSocket = null
        shutdownClientLocked()
    }

    private fun shutdownClientLocked() {
        client?.dispatcher?.executorService?.shutdown()
        client?.connectionPool?.evictAll()
        client = null
    }

    private fun createListener(): WebSocketListener {
        return object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                synchronized(lock) {
                    if (webSocket !== this@RNVNetworkDevWebSocketClient.webSocket) return
                    socketOpen = true
                    emitStatus("connected", null)
                    flushPendingMessagesLocked()
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                synchronized(lock) {
                    if (webSocket !== this@RNVNetworkDevWebSocketClient.webSocket) return
                    handleClosedLocked(code, reason)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                synchronized(lock) {
                    if (webSocket !== this@RNVNetworkDevWebSocketClient.webSocket) return
                    handleClosedLocked(code, reason)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                synchronized(lock) {
                    if (webSocket !== this@RNVNetworkDevWebSocketClient.webSocket) return
                    socketOpen = false
                    this@RNVNetworkDevWebSocketClient.webSocket = null
                    shutdownClientLocked()
                    emitStatus(
                        "receive_error",
                        "WebSocket connection failed."
                    )
                }
            }
        }
    }

    private fun emitStatus(state: String, detail: String?) {
        statusHandler?.invoke(state, detail)
    }

    private fun handleClosedLocked(code: Int, reason: String) {
        if (!socketOpen && webSocket == null && client == null) {
            return
        }

        socketOpen = false
        webSocket = null
        shutdownClientLocked()
        emitStatus("disconnected", reason.ifBlank { "Close code: $code" })
    }
}
