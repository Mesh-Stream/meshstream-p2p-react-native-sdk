#import "MeshStreamP2P.h"
#import "MeshStreamP2PValidation.h"
#import <React/RCTBridgeModule.h>
#import <MeshStreamKit/MeshStreamKit.h>

static NSString * const MeshStreamEventName = @"MeshStreamP2P:event";

static NSString *MeshStreamReasonName(P2PUnavailableReason reason) {
    switch (reason) {
        case P2PUnavailableReasonOK: return @"OK";
        case P2PUnavailableReasonNoPeers: return @"NO_PEERS";
        case P2PUnavailableReasonTrackerError: return @"TRACKER_ERROR";
        case P2PUnavailableReasonAuthFailed: return @"AUTH_FAILED";
        case P2PUnavailableReasonAccountDisabled: return @"ACCOUNT_DISABLED";
        case P2PUnavailableReasonAppDisabled: return @"APP_DISABLED";
        case P2PUnavailableReasonAppNotFound: return @"APP_NOT_FOUND";
        case P2PUnavailableReasonKeyDisabled: return @"KEY_DISABLED";
        case P2PUnavailableReasonPlatformDisabled: return @"PLATFORM_DISABLED";
        case P2PUnavailableReasonOriginDenied: return @"ORIGIN_DENIED";
        case P2PUnavailableReasonPackageDenied: return @"PACKAGE_DENIED";
        case P2PUnavailableReasonBundleDenied: return @"BUNDLE_DENIED";
        case P2PUnavailableReasonSigningCertDenied: return @"SIGNING_CERT_DENIED";
        case P2PUnavailableReasonTeamDenied: return @"TEAM_DENIED";
        case P2PUnavailableReasonConfigUnavailable: return @"CONFIG_UNAVAILABLE";
        case P2PUnavailableReasonInitializationFailed: return @"INITIALIZATION_FAILED";
        case P2PUnavailableReasonUnsupported: return @"UNSUPPORTED";
        case P2PUnavailableReasonDisabled: return @"DISABLED";
        case P2PUnavailableReasonKeyP2PDisabled: return @"KEY_P2P_DISABLED";
        case P2PUnavailableReasonQuotaExhausted: return @"QUOTA_EXHAUSTED";
        case P2PUnavailableReasonQuotaDisabled: return @"QUOTA_DISABLED";
    }
    return @"INITIALIZATION_FAILED";
}

static NSDictionary *MeshStreamStatusMap(P2PSdkStatus *status) {
    NSMutableDictionary *result = [@{
        @"accountEnabled": @(status.accountEnabled),
        @"applicationEnabled": @(status.applicationEnabled),
        @"keyEnabled": @(status.keyEnabled),
        @"platformEnabled": @(status.platformEnabled),
        @"effectiveP2pEnabled": @(status.effectiveP2PEnabled),
        @"reason": MeshStreamReasonName(status.reason),
    } mutableCopy];
    if (status.configVersion != nil) result[@"configVersion"] = status.configVersion;
    if (status.edgeRegion != nil) result[@"edgeRegion"] = status.edgeRegion;
    if (status.quotaStatus != nil) result[@"quotaStatus"] = status.quotaStatus;
    return result;
}

static NSDictionary *MeshStreamStatsMap(P2PStats *stats) {
    double downloadTotal = (double)(stats.httpDownloaded + stats.p2pDownloaded);
    double segmentDownloadTotal = (double)(stats.p2pSegmentDownloadSuccesses + stats.p2pSegmentDownloadFailures);
    double segmentUploadTotal = (double)(stats.p2pSegmentUploadSuccesses + stats.p2pSegmentUploadFailures);
    return @{
        @"httpDownloaded": @((double)stats.httpDownloaded),
        @"p2pDownloaded": @((double)stats.p2pDownloaded),
        @"p2pUploaded": @((double)stats.p2pUploaded),
        @"httpSegmentDownloadSuccesses": @((double)stats.httpSegmentDownloadSuccesses),
        @"httpSegmentDownloadFailures": @((double)stats.httpSegmentDownloadFailures),
        @"p2pSegmentDownloadSuccesses": @((double)stats.p2pSegmentDownloadSuccesses),
        @"p2pSegmentDownloadFailures": @((double)stats.p2pSegmentDownloadFailures),
        @"p2pSegmentUploadSuccesses": @((double)stats.p2pSegmentUploadSuccesses),
        @"p2pSegmentUploadFailures": @((double)stats.p2pSegmentUploadFailures),
        @"connectedPeers": @(stats.connectedPeers),
        @"peerConnectErrors": @((double)stats.peerConnectErrors),
        @"trackerErrors": @((double)stats.trackerErrors),
        @"downloadOffloadRatio": @(downloadTotal == 0 ? 0 : stats.p2pDownloaded / downloadTotal),
        @"p2pSegmentDownloadSuccessRatio": @(segmentDownloadTotal == 0 ? 0 : stats.p2pSegmentDownloadSuccesses / segmentDownloadTotal),
        @"p2pSegmentUploadSuccessRatio": @(segmentUploadTotal == 0 ? 0 : stats.p2pSegmentUploadSuccesses / segmentUploadTotal),
    };
}

static NSDictionary *MeshStreamDiagnosticsMap(P2PDiagnostics *diagnostics) {
    NSMutableDictionary *result = [@{
        @"fallbackCount": @((double)diagnostics.fallbackCount),
        @"iceAttempts": @((double)diagnostics.iceAttempts),
        @"iceSuccesses": @((double)diagnostics.iceSuccesses),
        @"iceFailures": @((double)diagnostics.iceFailures),
        @"iceDurationMs": @((double)diagnostics.iceDurationMs),
    } mutableCopy];
    if (diagnostics.firstPeerConnectMs > 0) result[@"firstPeerConnectMs"] = @((double)diagnostics.firstPeerConnectMs);
    if (diagnostics.coldStartP2PDownloaded > 0 || diagnostics.coldStartHTTPDownloaded > 0) {
        result[@"coldStart"] = @{
            @"p2pDownloaded": @((double)diagnostics.coldStartP2PDownloaded),
            @"httpDownloaded": @((double)diagnostics.coldStartHTTPDownloaded),
        };
    }
    if (diagnostics.lastTrackerError != nil) result[@"lastTrackerError"] = diagnostics.lastTrackerError;
    if (diagnostics.lastPeerError != nil) result[@"lastPeerError"] = diagnostics.lastPeerError;
    if (diagnostics.lastErrorAtMs > 0) result[@"lastErrorAtMs"] = @((double)diagnostics.lastErrorAtMs);
    return result;
}

@interface MeshStreamBridgeClient : NSObject
@property(nonatomic, strong) P2PClient *client;
@property(nonatomic, strong) NSMutableDictionary<NSString *, PlaybackSession *> *sessions;
@end

@implementation MeshStreamBridgeClient
@end

@interface MeshStreamP2P () <P2PEventListener>
@property(nonatomic, strong) NSMutableDictionary<NSString *, MeshStreamBridgeClient *> *clients;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray<NSDictionary *> *> *pendingEvents;
@end

@implementation MeshStreamP2P

RCT_EXPORT_MODULE(MeshStreamP2P)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (instancetype)init {
    if ((self = [super init])) {
        _clients = [NSMutableDictionary dictionary];
        _pendingEvents = [NSMutableDictionary dictionary];
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents { return @[MeshStreamEventName]; }

RCT_REMAP_METHOD(createClient,
                 createClientWithConfig:(NSDictionary *)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *key = MeshStreamTrimmedString(config[@"key"]) ?: @"";
    if (key.length == 0) {
        reject(@"MESHSTREAM_CREATE_CLIENT_FAILED", @"key must not be empty", nil);
        return;
    }
    P2PConfig *nativeConfig = [[P2PConfig alloc] initWithKey:key];
    if ([config[@"p2pEnabled"] isKindOfClass:NSNumber.class]) nativeConfig.p2pEnabled = [config[@"p2pEnabled"] boolValue];
    NSError *error = nil;
    P2PClient *client = [P2PSDK clientWithConfig:nativeConfig error:&error];
    if (client == nil) {
        reject(@"MESHSTREAM_CREATE_CLIENT_FAILED", error.localizedDescription ?: @"Unable to create MeshStream client.", error);
        return;
    }
    MeshStreamBridgeClient *bridgeClient = [MeshStreamBridgeClient new];
    bridgeClient.client = client;
    bridgeClient.sessions = [NSMutableDictionary dictionary];
    [client addEventListener:self];
    NSString *clientId = NSUUID.UUID.UUIDString;
    @synchronized (self.clients) { self.clients[clientId] = bridgeClient; }
    resolve(@{ @"clientId": clientId, @"status": MeshStreamStatusMap(client.sdkStatus) });
}

RCT_EXPORT_METHOD(createPlaybackSession:(NSString *)clientId
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    MeshStreamBridgeClient *bridgeClient = [self bridgeClient:clientId];
    NSURL *url = MeshStreamHTTPURLFromValue(options[@"url"]);
    if (bridgeClient == nil || url == nil) {
        reject(@"MESHSTREAM_CREATE_SESSION_FAILED", bridgeClient == nil ? @"Unknown or closed MeshStream client." : @"options.url must be a valid URL.", nil);
        return;
    }
    P2PPlaybackOptions *nativeOptions = [P2PPlaybackOptions new];
    nativeOptions.contentId = MeshStreamTrimmedString(options[@"contentId"]);
    nativeOptions.mimeType = MeshStreamTrimmedString(options[@"mimeType"]);
    nativeOptions.originHeaders = MeshStreamStringHeaders(options[@"originHeaders"]);
    NSError *error = nil;
    PlaybackSession *session = [bridgeClient.client createPlaybackSessionWithURL:url options:nativeOptions error:&error];
    if (session == nil) {
        reject(@"MESHSTREAM_CREATE_SESSION_FAILED", error.localizedDescription ?: @"Unable to create MeshStream playback session.", error);
        return;
    }
    NSString *sessionId = NSUUID.UUID.UUIDString;
    @synchronized (bridgeClient.sessions) { bridgeClient.sessions[sessionId] = session; }
    [self flushPendingEventsForNativeSessionId:session.sessionId clientId:clientId sessionId:sessionId];
    NSMutableDictionary *result = [@{
        @"clientId": clientId,
        @"sessionId": sessionId,
        @"playbackUrl": session.playbackUrl.absoluteString,
        @"playbackMode": session.playbackMode == P2PPlaybackModeNativeP2P ? @"NATIVE_P2P" : @"NATIVE_CDN",
    } mutableCopy];
    if (session.playbackMode == P2PPlaybackModeNativeCDN) result[@"fallbackReason"] = MeshStreamReasonName(session.fallbackReason);
    resolve(result);
}

RCT_EXPORT_METHOD(preload:(NSString *)clientId sessionId:(NSString *)sessionId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) resolve(@([session preload]));
}

RCT_EXPORT_METHOD(setP2pEnabled:(NSString *)clientId sessionId:(NSString *)sessionId enabled:(BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) { [session setP2PEnabled:enabled]; resolve(nil); }
}

RCT_EXPORT_METHOD(updateBufferedDurationMs:(NSString *)clientId sessionId:(NSString *)sessionId durationMs:(double)durationMs resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) { [session updateBufferedDurationMs:(int64_t)MAX(0, durationMs)]; resolve(nil); }
}

RCT_EXPORT_METHOD(updateCurrentPositionMs:(NSString *)clientId sessionId:(NSString *)sessionId positionMs:(double)positionMs resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) { [session updateCurrentPositionMs:(int64_t)MAX(0, positionMs)]; resolve(nil); }
}

RCT_EXPORT_METHOD(getStats:(NSString *)clientId sessionId:(NSString *)sessionId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) resolve(MeshStreamStatsMap(session.statistics));
}

RCT_EXPORT_METHOD(getDiagnostics:(NSString *)clientId sessionId:(NSString *)sessionId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    PlaybackSession *session = [self sessionForClient:clientId sessionId:sessionId reject:reject];
    if (session != nil) resolve(MeshStreamDiagnosticsMap(session.diagnostics));
}

RCT_EXPORT_METHOD(getStatus:(NSString *)clientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    MeshStreamBridgeClient *bridgeClient = [self bridgeClient:clientId];
    if (bridgeClient == nil) { reject(@"MESHSTREAM_STATUS_FAILED", @"Unknown or closed MeshStream client.", nil); return; }
    resolve(MeshStreamStatusMap(bridgeClient.client.sdkStatus));
}

RCT_EXPORT_METHOD(closeSession:(NSString *)clientId sessionId:(NSString *)sessionId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    MeshStreamBridgeClient *bridgeClient = [self bridgeClient:clientId];
    if (bridgeClient == nil) { reject(@"MESHSTREAM_CLOSE_SESSION_FAILED", @"Unknown or closed MeshStream client.", nil); return; }
    PlaybackSession *session;
    @synchronized (bridgeClient.sessions) { session = bridgeClient.sessions[sessionId]; [bridgeClient.sessions removeObjectForKey:sessionId]; }
    if (session != nil) [self removePendingEventsForNativeSessionId:session.sessionId];
    [session close];
    resolve(nil);
}

RCT_EXPORT_METHOD(closeClient:(NSString *)clientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    MeshStreamBridgeClient *bridgeClient;
    @synchronized (self.clients) { bridgeClient = self.clients[clientId]; [self.clients removeObjectForKey:clientId]; }
    if (bridgeClient != nil) {
        [bridgeClient.client removeEventListener:self];
        NSArray<PlaybackSession *> *sessions;
        @synchronized (bridgeClient.sessions) { sessions = bridgeClient.sessions.allValues; [bridgeClient.sessions removeAllObjects]; }
        for (PlaybackSession *session in sessions) {
            [self removePendingEventsForNativeSessionId:session.sessionId];
            [session close];
        }
        [bridgeClient.client close];
        bridgeClient.client = nil;
    }
    resolve(nil);
}

- (MeshStreamBridgeClient *)bridgeClient:(NSString *)clientId {
    @synchronized (self.clients) { return self.clients[clientId]; }
}

- (PlaybackSession *)sessionForClient:(NSString *)clientId sessionId:(NSString *)sessionId reject:(RCTPromiseRejectBlock)reject {
    MeshStreamBridgeClient *bridgeClient = [self bridgeClient:clientId];
    if (bridgeClient == nil) {
        reject(@"MESHSTREAM_SESSION_OPERATION_FAILED", @"Unknown or closed MeshStream client.", nil);
        return nil;
    }
    PlaybackSession *session;
    @synchronized (bridgeClient.sessions) { session = bridgeClient.sessions[sessionId]; }
    if (session == nil) reject(@"MESHSTREAM_SESSION_OPERATION_FAILED", @"Unknown or closed MeshStream playback session.", nil);
    return session;
}

- (void)emitForNativeSessionId:(NSString *)nativeSessionId type:(NSString *)type extras:(NSDictionary *)extras {
    __block NSString *clientId;
    __block NSString *sessionId;
    @synchronized (self.clients) {
        [self.clients enumerateKeysAndObjectsUsingBlock:^(NSString *key, MeshStreamBridgeClient *bridgeClient, BOOL *stop) {
            @synchronized (bridgeClient.sessions) {
                [bridgeClient.sessions enumerateKeysAndObjectsUsingBlock:^(NSString *jsId, PlaybackSession *session, BOOL *sessionStop) {
                    if ([session.sessionId isEqualToString:nativeSessionId]) { clientId = key; sessionId = jsId; *stop = YES; *sessionStop = YES; }
                }];
            }
        }];
    }
    if (clientId == nil || sessionId == nil) {
        [self bufferPendingEventForNativeSessionId:nativeSessionId type:type extras:extras];
        return;
    }
    [self sendSessionEventForClientId:clientId sessionId:sessionId type:type extras:extras];
}

- (void)sendSessionEventForClientId:(NSString *)clientId sessionId:(NSString *)sessionId type:(NSString *)type extras:(NSDictionary *)extras {
    NSMutableDictionary *event = [@{ @"type": type, @"clientId": clientId, @"sessionId": sessionId } mutableCopy];
    [event addEntriesFromDictionary:extras ?: @{}];
    [self sendEventWithName:MeshStreamEventName body:event];
}

- (void)bufferPendingEventForNativeSessionId:(NSString *)nativeSessionId type:(NSString *)type extras:(NSDictionary *)extras {
    if (nativeSessionId.length == 0) return;
    @synchronized (self.pendingEvents) {
        NSMutableArray<NSDictionary *> *events = self.pendingEvents[nativeSessionId];
        if (events == nil) {
            if (self.pendingEvents.count >= 64) return;
            events = [NSMutableArray array];
            self.pendingEvents[nativeSessionId] = events;
        }
        if (events.count < 8) [events addObject:@{ @"type": type, @"extras": extras ?: @{} }];
    }
}

- (void)flushPendingEventsForNativeSessionId:(NSString *)nativeSessionId clientId:(NSString *)clientId sessionId:(NSString *)sessionId {
    NSArray<NSDictionary *> *events;
    @synchronized (self.pendingEvents) {
        events = [self.pendingEvents[nativeSessionId] copy] ?: @[];
        [self.pendingEvents removeObjectForKey:nativeSessionId];
    }
    for (NSDictionary *event in events) {
        [self sendSessionEventForClientId:clientId sessionId:sessionId type:event[@"type"] extras:event[@"extras"]];
    }
}

- (void)removePendingEventsForNativeSessionId:(NSString *)nativeSessionId {
    @synchronized (self.pendingEvents) { [self.pendingEvents removeObjectForKey:nativeSessionId]; }
}

- (void)onPlaybackPreparedWithSessionId:(NSString *)sessionId playbackUrl:(NSURL *)playbackUrl { [self emitForNativeSessionId:sessionId type:@"playbackPrepared" extras:@{ @"playbackUrl": playbackUrl.absoluteString ?: @"" }]; }
- (void)onStatisticsWithSessionId:(NSString *)sessionId stats:(P2PStats *)stats { [self emitForNativeSessionId:sessionId type:@"statistics" extras:@{ @"statistics": MeshStreamStatsMap(stats) }]; }
- (void)onPeerCountChangedWithSessionId:(NSString *)sessionId peerCount:(NSInteger)peerCount { [self emitForNativeSessionId:sessionId type:@"peerCountChanged" extras:@{ @"peerCount": @(peerCount) }]; }
- (void)onP2PReadyWithSessionId:(NSString *)sessionId { [self emitForNativeSessionId:sessionId type:@"p2pReady" extras:nil]; }
- (void)onP2PUnavailableWithSessionId:(NSString *)sessionId reason:(P2PUnavailableReason)reason { [self emitForNativeSessionId:sessionId type:@"p2pUnavailable" extras:@{ @"reason": MeshStreamReasonName(reason) }]; }
- (void)onCdnFallbackWithSessionId:(NSString *)sessionId bytes:(int64_t)bytes { [self emitForNativeSessionId:sessionId type:@"cdnFallback" extras:@{ @"bytes": @((double)bytes) }]; }
- (void)onTrackerErrorWithSessionId:(NSString *)sessionId totalErrors:(int64_t)totalErrors { [self emitForNativeSessionId:sessionId type:@"trackerError" extras:@{ @"totalErrors": @((double)totalErrors) }]; }
- (void)onPeerConnectErrorWithSessionId:(NSString *)sessionId totalErrors:(int64_t)totalErrors { [self emitForNativeSessionId:sessionId type:@"peerConnectError" extras:@{ @"totalErrors": @((double)totalErrors) }]; }

- (void)invalidate {
    NSArray<NSString *> *clientIds;
    @synchronized (self.clients) { clientIds = self.clients.allKeys; }
    for (NSString *clientId in clientIds) {
        MeshStreamBridgeClient *bridgeClient = [self bridgeClient:clientId];
        [bridgeClient.client removeEventListener:self];
        for (PlaybackSession *session in bridgeClient.sessions.allValues) [session close];
        [bridgeClient.sessions removeAllObjects];
        [bridgeClient.client close];
        bridgeClient.client = nil;
    }
    @synchronized (self.clients) { [self.clients removeAllObjects]; }
    @synchronized (self.pendingEvents) { [self.pendingEvents removeAllObjects]; }
    [super invalidate];
}

@end
