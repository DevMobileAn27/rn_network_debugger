package com.reactnativeviewer.rnvnetwork

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class RNVNetworkDevModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val MODULE_NAME = "RNVNetworkDevModule"
        private const val STATUS_EVENT_NAME = "RNVNetworkDevStatus"
        private const val SDK_VERSION = "0.1.0"
    }

    private val client = RNVNetworkDevWebSocketClient()
    private var enabled = true
    private val sessionIdentifier = UUID.randomUUID().toString()
    private var listenerCount = 0

    init {
        client.statusHandler = { state, detail ->
            emitStatus(state, detail)
        }
    }

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "statusEventName" to STATUS_EVENT_NAME,
            "sdkVersion" to SDK_VERSION
        )
    }

    @ReactMethod
    fun configure(options: ReadableMap?) {
        enabled = options?.getOptionalBoolean("enabled") ?: true

        if (!enabled) {
            client.disconnect()
            emitStatus("disabled", "SDK disabled by configuration.")
            return
        }

        val viewerURL = options?.getOptionalString("viewerURL")
        val maxQueueSize = options?.getOptionalInt("maxQueueSize") ?: 200
        val connectionHeaders = options?.getOptionalMap("connectionHeaders")?.toStringMap() ?: emptyMap()

        client.configure(
            urlString = viewerURL,
            maxQueueSize = maxQueueSize,
            connectionHeaders = connectionHeaders
        )
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean) {
        this.enabled = enabled
        if (!enabled) {
            client.disconnect()
            emitStatus("disabled", "SDK disabled at runtime.")
        }
    }

    @ReactMethod
    fun captureEvent(event: ReadableMap?) {
        if (event == null) {
            return
        }

        val events = JSONArray().put(event.toJSONObject())
        enqueueEvents(events)
    }

    @ReactMethod
    fun captureEvents(events: ReadableArray?) {
        if (events == null || events.size() == 0) {
            return
        }

        val array = JSONArray()
        for (index in 0 until events.size()) {
            val event = events.getMap(index) ?: continue
            array.put(event.toJSONObject())
        }

        enqueueEvents(array)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = maxOf(0, listenerCount - count)
    }

    override fun invalidate() {
        client.disconnect()
        super.invalidate()
    }

    private fun enqueueEvents(events: JSONArray) {
        if (!enabled || events.length() == 0) {
            return
        }

        client.enqueueEnvelope(buildEnvelope(events))
    }

    private fun buildEnvelope(events: JSONArray): JSONObject {
        return JSONObject()
            .put(
                "sdk",
                JSONObject()
                    .put("name", "rnv_network_sdk_android")
                    .put("version", SDK_VERSION)
                    .put("schemaVersion", 1)
            )
            .put("session", sessionMetadata())
            .put("events", events)
    }

    private fun sessionMetadata(): JSONObject {
        val packageName = reactApplicationContext.packageName
        val packageManager = reactApplicationContext.packageManager
        val applicationInfo = reactApplicationContext.applicationInfo
        val appName = packageManager.getApplicationLabel(applicationInfo)?.toString().orEmpty()

        return JSONObject()
            .put("id", sessionIdentifier)
            .put("platform", "android")
            .put("bundleIdentifier", packageName)
            .put("appName", appName)
            .put("deviceName", deviceName())
            .put("systemName", "Android")
            .put("systemVersion", Build.VERSION.RELEASE ?: "")
            .put("isSimulator", isEmulator())
    }

    private fun emitStatus(state: String, detail: String?) {
        if (listenerCount <= 0 || !reactApplicationContext.hasActiveCatalystInstance()) {
            return
        }

        val payload = Arguments.createMap().apply {
            putString("state", state)
            putString("sessionId", sessionIdentifier)
            if (!detail.isNullOrBlank()) {
                putString("detail", detail)
            }
        }

        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(STATUS_EVENT_NAME, payload)
    }

    private fun deviceName(): String {
        val manufacturer = Build.MANUFACTURER?.trim().orEmpty()
        val model = Build.MODEL?.trim().orEmpty()

        return when {
            manufacturer.isEmpty() -> model
            model.startsWith(manufacturer, ignoreCase = true) -> model
            model.isEmpty() -> manufacturer
            else -> "$manufacturer $model"
        }
    }

    private fun isEmulator(): Boolean {
        return (
            Build.FINGERPRINT.startsWith("generic") ||
                Build.FINGERPRINT.startsWith("unknown") ||
                Build.MODEL.contains("google_sdk") ||
                Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for x86") ||
                Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
                "google_sdk" == Build.PRODUCT
            )
    }
}

private fun ReadableMap.getOptionalBoolean(key: String): Boolean? {
    if (!hasKey(key) || isNull(key)) {
        return null
    }
    return getBoolean(key)
}

private fun ReadableMap.getOptionalString(key: String): String? {
    if (!hasKey(key) || isNull(key)) {
        return null
    }
    return getString(key)
}

private fun ReadableMap.getOptionalInt(key: String): Int? {
    if (!hasKey(key) || isNull(key)) {
        return null
    }

    return when (getType(key)) {
        ReadableType.Number -> getDouble(key).toInt()
        else -> null
    }
}

private fun ReadableMap.getOptionalMap(key: String): ReadableMap? {
    if (!hasKey(key) || isNull(key)) {
        return null
    }
    return getMap(key)
}

private fun ReadableMap.toStringMap(): Map<String, String> {
    val result = mutableMapOf<String, String>()
    val iterator = keySetIterator()
    while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        if (isNull(key)) {
            continue
        }
        val value = when (getType(key)) {
            ReadableType.String -> getString(key).orEmpty()
            ReadableType.Boolean -> getBoolean(key).toString()
            ReadableType.Number -> getDouble(key).toString()
            else -> null
        }
        if (value != null) {
            result[key] = value
        }
    }
    return result
}

private fun ReadableMap.toJSONObject(): JSONObject {
    val json = JSONObject()
    val iterator = keySetIterator()
    while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        json.put(key, toJSONValue(this, key))
    }
    return json
}

private fun ReadableArray.toJSONArray(): JSONArray {
    val json = JSONArray()
    for (index in 0 until size()) {
        json.put(toJSONValue(this, index))
    }
    return json
}

private fun toJSONValue(map: ReadableMap, key: String): Any? {
    if (map.isNull(key)) {
        return JSONObject.NULL
    }

    return when (map.getType(key)) {
        ReadableType.Null -> JSONObject.NULL
        ReadableType.Boolean -> map.getBoolean(key)
        ReadableType.Number -> numberValue(map.getDouble(key))
        ReadableType.String -> map.getString(key)
        ReadableType.Map -> map.getMap(key)?.toJSONObject()
        ReadableType.Array -> map.getArray(key)?.toJSONArray()
    }
}

private fun toJSONValue(array: ReadableArray, index: Int): Any? {
    if (array.isNull(index)) {
        return JSONObject.NULL
    }

    return when (array.getType(index)) {
        ReadableType.Null -> JSONObject.NULL
        ReadableType.Boolean -> array.getBoolean(index)
        ReadableType.Number -> numberValue(array.getDouble(index))
        ReadableType.String -> array.getString(index)
        ReadableType.Map -> array.getMap(index)?.toJSONObject()
        ReadableType.Array -> array.getArray(index)?.toJSONArray()
    }
}

private fun numberValue(value: Double): Number {
    val longValue = value.toLong()
    return if (value == longValue.toDouble()) {
        longValue
    } else {
        value
    }
}
