package net.meshstream.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.meshstream.sdk.P2pClient
import io.meshstream.sdk.P2pConfig
import io.meshstream.sdk.P2pDiagnosticsSnapshot
import io.meshstream.sdk.P2pEventListener
import io.meshstream.sdk.P2pSdk
import io.meshstream.sdk.P2pSdkStatus
import io.meshstream.sdk.P2pStats
import io.meshstream.sdk.P2pUnavailableReason
import io.meshstream.sdk.PlaybackOptions
import io.meshstream.sdk.PlaybackSession
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Classic React Native module backed by the Android MeshStream SDK. Native state is
 * entirely keyed by the JS-visible client/session IDs so several players can coexist.
 */
class MeshStreamP2PModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private data class BridgeClient(
        val client: P2pClient,
        val sessions: ConcurrentHashMap<String, PlaybackSession> = ConcurrentHashMap(),
        val pendingEvents: ConcurrentHashMap<Long, MutableList<PendingEvent>> = ConcurrentHashMap(),
    )

    private data class PendingEvent(
        val type: String,
        val extras: WritableMap.() -> Unit,
    )

    private val clients = ConcurrentHashMap<String, BridgeClient>()

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun createClient(config: ReadableMap, promise: Promise) {
        try {
            val key = config.requiredString("key")
            val client = P2pSdk.create(
                reactApplicationContext.applicationContext,
                P2pConfig(
                    key = key,
                    p2pEnabled = config.optionalBoolean("p2pEnabled") ?: true,
                ),
            )
            val clientId = UUID.randomUUID().toString()
            val bridgeClient = BridgeClient(client)
            client.addEventListener(createEventListener(clientId, bridgeClient))
            clients[clientId] = bridgeClient
            promise.resolve(Arguments.createMap().apply {
                putString("clientId", clientId)
                putMap("status", client.status.toWritableMap())
            })
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_CREATE_CLIENT_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun createPlaybackSession(clientId: String, options: ReadableMap, promise: Promise) {
        try {
            val bridgeClient = clients.requireClient(clientId)
            val url = options.requiredString("url")
            val session = bridgeClient.client.createPlaybackSession(
                url,
                PlaybackOptions(
                    contentId = options.optionalString("contentId"),
                    mimeType = options.optionalString("mimeType"),
                    originHeaders = options.stringMap("originHeaders"),
                ),
            )
            val sessionId = UUID.randomUUID().toString()
            bridgeClient.sessions[sessionId] = session
            flushPendingEvents(clientId, sessionId, session, bridgeClient)
            promise.resolve(session.toWritableMap(clientId, sessionId))
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_CREATE_SESSION_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun preload(clientId: String, sessionId: String, promise: Promise) = withSession(clientId, sessionId, promise) {
        it.preload()
    }

    @ReactMethod
    fun setP2pEnabled(clientId: String, sessionId: String, enabled: Boolean, promise: Promise) =
        withSession(clientId, sessionId, promise) {
            it.setP2pEnabled(enabled)
            null
        }

    @ReactMethod
    fun updateBufferedDurationMs(clientId: String, sessionId: String, durationMs: Double, promise: Promise) =
        withSession(clientId, sessionId, promise) {
            it.updateBufferedDurationMs(durationMs.toLong().coerceAtLeast(0))
            null
        }

    @ReactMethod
    fun updateCurrentPositionMs(clientId: String, sessionId: String, positionMs: Double, promise: Promise) =
        withSession(clientId, sessionId, promise) {
            it.updateCurrentPositionMs(positionMs.toLong().coerceAtLeast(0))
            null
        }

    @ReactMethod
    fun getStats(clientId: String, sessionId: String, promise: Promise) = withSession(clientId, sessionId, promise) {
        it.statistics().toWritableMap()
    }

    @ReactMethod
    fun getDiagnostics(clientId: String, sessionId: String, promise: Promise) = withSession(clientId, sessionId, promise) {
        it.diagnostics().toWritableMap()
    }

    @ReactMethod
    fun getStatus(clientId: String, promise: Promise) {
        try {
            promise.resolve(clients.requireClient(clientId).client.status.toWritableMap())
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_STATUS_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun closeSession(clientId: String, sessionId: String, promise: Promise) {
        try {
            val bridgeClient = clients.requireClient(clientId)
            bridgeClient.sessions.remove(sessionId)?.let { session ->
                bridgeClient.pendingEvents.remove(session.sessionId)
                session.close()
            }
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_CLOSE_SESSION_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun closeClient(clientId: String, promise: Promise) {
        try {
            clients.remove(clientId)?.let { bridgeClient ->
                bridgeClient.sessions.values.forEach { it.close() }
                bridgeClient.sessions.clear()
                bridgeClient.pendingEvents.clear()
                bridgeClient.client.close()
            }
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_CLOSE_CLIENT_FAILED", error.message, error)
        }
    }

    override fun invalidate() {
        clients.values.forEach { bridgeClient ->
            bridgeClient.sessions.values.forEach { it.close() }
            bridgeClient.pendingEvents.clear()
            bridgeClient.client.close()
        }
        clients.clear()
        super.invalidate()
    }

    private fun withSession(clientId: String, sessionId: String, promise: Promise, operation: (PlaybackSession) -> Any?) {
        try {
            promise.resolve(operation(clients.requireClient(clientId).sessions.requireSession(sessionId)))
        } catch (error: Throwable) {
            promise.reject("MESHSTREAM_SESSION_OPERATION_FAILED", error.message, error)
        }
    }

    private fun createEventListener(clientId: String, bridgeClient: BridgeClient) = object : P2pEventListener {
        private fun sessionId(nativeSessionId: Long): String? = bridgeClient.sessions.entries
            .firstOrNull { it.value.sessionId == nativeSessionId }?.key

        private fun emit(nativeSessionId: Long, type: String, extras: WritableMap.() -> Unit = {}) {
            val jsSessionId = sessionId(nativeSessionId)
            if (jsSessionId == null) {
                bufferPendingEvent(bridgeClient, nativeSessionId, PendingEvent(type, extras))
                return
            }
            sendSessionEvent(clientId, jsSessionId, type, extras)
        }

        override fun onStatistics(sessionId: Long, stats: P2pStats) = emit(sessionId, "statistics") {
            putMap("statistics", stats.toWritableMap())
        }

        override fun onPeerCountChanged(sessionId: Long, peerCount: Int) = emit(sessionId, "peerCountChanged") {
            putInt("peerCount", peerCount)
        }

        override fun onPlaybackPrepared(sessionId: Long, playbackUrl: String) = emit(sessionId, "playbackPrepared") {
            putString("playbackUrl", playbackUrl)
        }

        override fun onP2pReady(sessionId: Long) = emit(sessionId, "p2pReady")

        override fun onP2pUnavailable(sessionId: Long, reason: P2pUnavailableReason) = emit(sessionId, "p2pUnavailable") {
            putString("reason", reason.name)
        }

        override fun onTrackerError(sessionId: Long, totalErrors: Long) = emit(sessionId, "trackerError") {
            putDouble("totalErrors", totalErrors.toDouble())
        }

        override fun onPeerConnectError(sessionId: Long, totalErrors: Long) = emit(sessionId, "peerConnectError") {
            putDouble("totalErrors", totalErrors.toDouble())
        }

        override fun onCdnFallback(sessionId: Long, bytes: Long) = emit(sessionId, "cdnFallback") {
            putDouble("bytes", bytes.toDouble())
        }
    }

    private fun bufferPendingEvent(bridgeClient: BridgeClient, nativeSessionId: Long, event: PendingEvent) {
        synchronized(bridgeClient.pendingEvents) {
            val events = bridgeClient.pendingEvents[nativeSessionId]
            if (events != null) {
                if (events.size < MAX_PENDING_EVENTS_PER_SESSION) events += event
                return
            }
            if (bridgeClient.pendingEvents.size >= MAX_PENDING_EVENT_SESSIONS) return
            bridgeClient.pendingEvents[nativeSessionId] = mutableListOf(event)
        }
    }

    private fun flushPendingEvents(
        clientId: String,
        jsSessionId: String,
        session: PlaybackSession,
        bridgeClient: BridgeClient,
    ) {
        val events = synchronized(bridgeClient.pendingEvents) {
            bridgeClient.pendingEvents.remove(session.sessionId)?.toList().orEmpty()
        }
        events.forEach { event -> sendSessionEvent(clientId, jsSessionId, event.type, event.extras) }
    }

    private fun sendSessionEvent(
        clientId: String,
        sessionId: String,
        type: String,
        extras: WritableMap.() -> Unit,
    ) {
        sendEvent(Arguments.createMap().apply {
            putString("type", type)
            putString("clientId", clientId)
            putString("sessionId", sessionId)
            extras()
        })
    }

    private fun sendEvent(event: WritableMap) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, event)
        }
    }

    private fun ConcurrentHashMap<String, BridgeClient>.requireClient(clientId: String): BridgeClient =
        this[clientId] ?: error("Unknown or closed MeshStream client: $clientId")

    private fun ConcurrentHashMap<String, PlaybackSession>.requireSession(sessionId: String): PlaybackSession =
        this[sessionId] ?: error("Unknown or closed MeshStream playback session: $sessionId")

    private fun ReadableMap.requiredString(name: String): String = optionalString(name)
        ?.takeIf { it.isNotBlank() }
        ?: error("$name must not be empty")

    private fun ReadableMap.optionalString(name: String): String? =
        if (hasKey(name) && !isNull(name) && getType(name) == ReadableType.String) getString(name)?.trim() else null

    private fun ReadableMap.optionalBoolean(name: String): Boolean? =
        if (hasKey(name) && !isNull(name) && getType(name) == ReadableType.Boolean) getBoolean(name) else null

    private fun ReadableMap.stringMap(name: String): Map<String, String> {
        if (!hasKey(name) || isNull(name) || getType(name) != ReadableType.Map) return emptyMap()
        val result = linkedMapOf<String, String>()
        val map = getMap(name) ?: return emptyMap()
        val iterator: ReadableMapKeySetIterator = map.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (map.getType(key) == ReadableType.String) map.getString(key)?.let { result[key] = it }
        }
        return result
    }

    private fun PlaybackSession.toWritableMap(clientId: String, sessionId: String): WritableMap = Arguments.createMap().apply {
        putString("clientId", clientId)
        putString("sessionId", sessionId)
        putString("playbackUrl", playbackUrl)
        putString("playbackMode", playbackMode.name)
        fallbackReason?.let { putString("fallbackReason", it.name) }
    }

    private fun P2pSdkStatus.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putBoolean("accountEnabled", accountEnabled)
        putBoolean("applicationEnabled", applicationEnabled)
        putBoolean("keyEnabled", keyEnabled)
        putBoolean("platformEnabled", platformEnabled)
        putBoolean("effectiveP2pEnabled", effectiveP2pEnabled)
        putString("reason", reason.name)
        configVersion?.let { putString("configVersion", it) }
        edgeRegion?.let { putString("edgeRegion", it) }
        quotaStatus?.let { putString("quotaStatus", it) }
        trackerPoolReady?.let { putBoolean("trackerPoolReady", it) }
    }

    private fun P2pStats.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putDouble("httpDownloaded", httpDownloaded.toDouble())
        putDouble("p2pDownloaded", p2pDownloaded.toDouble())
        putDouble("p2pUploaded", p2pUploaded.toDouble())
        putDouble("httpSegmentDownloadSuccesses", httpSegmentDownloadSuccesses.toDouble())
        putDouble("httpSegmentDownloadFailures", httpSegmentDownloadFailures.toDouble())
        putDouble("p2pSegmentDownloadSuccesses", p2pSegmentDownloadSuccesses.toDouble())
        putDouble("p2pSegmentDownloadFailures", p2pSegmentDownloadFailures.toDouble())
        putDouble("p2pSegmentUploadSuccesses", p2pSegmentUploadSuccesses.toDouble())
        putDouble("p2pSegmentUploadFailures", p2pSegmentUploadFailures.toDouble())
        putInt("connectedPeers", connectedPeers)
        putDouble("peerConnectErrors", peerConnectErrors.toDouble())
        putDouble("trackerErrors", trackerErrors.toDouble())
        putDouble("downloadOffloadRatio", downloadOffloadRatio)
        putDouble("p2pSegmentDownloadSuccessRatio", p2pSegmentDownloadSuccessRatio)
        putDouble("p2pSegmentUploadSuccessRatio", p2pSegmentUploadSuccessRatio)
    }

    private fun P2pDiagnosticsSnapshot.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putDouble("fallbackCount", fallbackCount.toDouble())
        firstPeerConnectMs?.let { putDouble("firstPeerConnectMs", it.toDouble()) }
        coldStart?.let {
            putMap("coldStart", Arguments.createMap().apply {
                putDouble("p2pDownloaded", it.p2pDownloaded.toDouble())
                putDouble("httpDownloaded", it.httpDownloaded.toDouble())
            })
        }
        lastTrackerError?.let { putString("lastTrackerError", it) }
        lastPeerError?.let { putString("lastPeerError", it) }
        lastErrorAtMs?.let { putDouble("lastErrorAtMs", it.toDouble()) }
        putDouble("iceAttempts", iceAttempts.toDouble())
        putDouble("iceSuccesses", iceSuccesses.toDouble())
        putDouble("iceFailures", iceFailures.toDouble())
        putDouble("iceDurationMs", iceDurationMs.toDouble())
    }

    companion object {
        private const val MODULE_NAME = "MeshStreamP2P"
        private const val EVENT_NAME = "MeshStreamP2P:event"
        private const val MAX_PENDING_EVENT_SESSIONS = 64
        private const val MAX_PENDING_EVENTS_PER_SESSION = 8
    }
}
