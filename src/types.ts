export type MeshStreamMimeType = 'm3u8' | 'mpd' | 'mp4' | 'mp3';

/** A client can own multiple independent playback sessions. */
export interface MeshStreamConfig {
  key: string;
  p2pEnabled?: boolean;
}

/** Versions of the JavaScript wrapper and native engine used by this application. */
export interface MeshStreamVersionInfo {
  /** Version of the installed react-native-meshstream package. */
  packageVersion: string;
  /** Version of the Android or Apple MeshStream engine loaded by the bridge. */
  nativeSdkVersion: string;
  /** Native platform that supplied nativeSdkVersion. */
  platform: 'android' | 'ios';
}

export interface PlaybackSessionOptions {
  url: string;
  contentId?: string;
  mimeType?: MeshStreamMimeType;
  originHeaders?: Record<string, string>;
}

export type MeshStreamPlaybackMode = 'NATIVE_P2P' | 'NATIVE_CDN';

export type MeshStreamUnavailableReason =
  | 'OK'
  | 'ACCOUNT_DISABLED'
  | 'APP_DISABLED'
  | 'APP_NOT_FOUND'
  | 'KEY_DISABLED'
  | 'PLATFORM_DISABLED'
  | 'ORIGIN_DENIED'
  | 'PACKAGE_DENIED'
  | 'BUNDLE_DENIED'
  | 'SIGNING_CERT_DENIED'
  | 'TEAM_DENIED'
  | 'AUTH_FAILED'
  | 'CONFIG_UNAVAILABLE'
  | 'TRACKER_ERROR'
  | 'NO_PEERS'
  | 'UNSUPPORTED'
  | 'INITIALIZATION_FAILED'
  | 'DISABLED'
  | 'KEY_P2P_DISABLED'
  | 'QUOTA_EXHAUSTED'
  | 'QUOTA_DISABLED';

export interface MeshStreamStatus {
  accountEnabled: boolean;
  applicationEnabled: boolean;
  keyEnabled: boolean;
  platformEnabled: boolean;
  effectiveP2pEnabled: boolean;
  reason: MeshStreamUnavailableReason;
  configVersion?: string;
  edgeRegion?: string;
  quotaStatus?: string;
  trackerPoolReady?: boolean;
}

export interface MeshStreamStats {
  httpDownloaded: number;
  p2pDownloaded: number;
  p2pUploaded: number;
  httpSegmentDownloadSuccesses: number;
  httpSegmentDownloadFailures: number;
  p2pSegmentDownloadSuccesses: number;
  p2pSegmentDownloadFailures: number;
  p2pSegmentUploadSuccesses: number;
  p2pSegmentUploadFailures: number;
  connectedPeers: number;
  peerConnectErrors: number;
  trackerErrors: number;
  downloadOffloadRatio: number;
  p2pSegmentDownloadSuccessRatio: number;
  p2pSegmentUploadSuccessRatio: number;
}

export interface MeshStreamColdStartSnapshot {
  p2pDownloaded: number;
  httpDownloaded: number;
}

export interface MeshStreamDiagnostics {
  fallbackCount: number;
  firstPeerConnectMs?: number;
  coldStart?: MeshStreamColdStartSnapshot;
  lastTrackerError?: string;
  lastPeerError?: string;
  lastErrorAtMs?: number;
  iceAttempts: number;
  iceSuccesses: number;
  iceFailures: number;
  iceDurationMs: number;
}

export interface MeshStreamSessionInfo {
  clientId: string;
  sessionId: string;
  playbackUrl: string;
  playbackMode: MeshStreamPlaybackMode;
  fallbackReason?: MeshStreamUnavailableReason;
}

export type MeshStreamEventName =
  | 'peerCountChanged'
  | 'playbackPrepared'
  | 'p2pReady'
  | 'p2pUnavailable'
  | 'statistics'
  | 'cdnFallback'
  | 'trackerError'
  | 'peerConnectError';

export interface MeshStreamEvent {
  type: MeshStreamEventName;
  clientId: string;
  sessionId: string;
  peerCount?: number;
  playbackUrl?: string;
  reason?: MeshStreamUnavailableReason;
  statistics?: MeshStreamStats;
  bytes?: number;
  totalErrors?: number;
}
