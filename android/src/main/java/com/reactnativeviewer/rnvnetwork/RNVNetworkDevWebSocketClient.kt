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
    private var maxQueueSize: Int = 200
    private var socketOpen = false
    private var connectionHeaders: Map<String, String> = emptyMap()
    private val pendingMessages = mutableListOf<String>()

    fun configure(
        urlString: String?,
        maxQueueSize: Int,
        connectionHeaders: Map<String, String>
    ) {
        synchronized(lock) {
            val normalizedURL = urlString?.takeIf { it.isNotBlank() }
            val urlChanged = this.urlString != normalizedURL

            this.urlString = normalizedURL
            this.maxQueueSize = maxOf(maxQueueSize, 50)
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

            if (pendingMessages.size >= maxQueueSize) {
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
            val wasQueued = activeWebSocket.send(message)
            if (!wasQueued) {
                emitStatus("send_error", "Unable to queue websocket message.")
            }
        }
    }

    private fun disconnectLocked() {
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
                    socketOpen = true
                    emitStatus("connected", null)
                    flushPendingMessagesLocked()
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                synchronized(lock) {
                    handleClosedLocked(code, reason)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                synchronized(lock) {
                    handleClosedLocked(code, reason)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                synchronized(lock) {
                    socketOpen = false
                    this@RNVNetworkDevWebSocketClient.webSocket = null
                    shutdownClientLocked()
                    emitStatus(
                        "receive_error",
                        response?.message?.takeIf { it.isNotBlank() } ?: (t.message ?: "Unknown websocket failure.")
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
