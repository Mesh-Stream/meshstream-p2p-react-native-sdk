import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';

import { requireNativeModule } from './NativeMeshStreamP2P';
import type {
  MeshStreamConfig,
  MeshStreamDiagnostics,
  MeshStreamEvent,
  MeshStreamEventName,
  MeshStreamSessionInfo,
  MeshStreamStats,
  MeshStreamStatus,
  PlaybackSessionOptions,
} from './types';

export * from './types';

const EVENT_NAME = 'MeshStreamP2P:event';

function assertNonEmpty(value: string | undefined, field: string): asserts value is string {
  if (!value?.trim()) throw new Error(`${field} must not be empty.`);
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number.`);
}

export class MeshStreamPlaybackSession {
  readonly clientId: string;
  readonly sessionId: string;
  readonly playbackUrl: string;
  readonly playbackMode: MeshStreamSessionInfo['playbackMode'];
  readonly fallbackReason?: MeshStreamSessionInfo['fallbackReason'];
  private closed = false;
  private closing?: Promise<void>;

  constructor(info: MeshStreamSessionInfo) {
    this.clientId = info.clientId;
    this.sessionId = info.sessionId;
    this.playbackUrl = info.playbackUrl;
    this.playbackMode = info.playbackMode;
    this.fallbackReason = info.fallbackReason;
  }

  async preload(): Promise<boolean> {
    return this.withOpen(() => requireNativeModule().preload(this.clientId, this.sessionId));
  }

  async setP2pEnabled(enabled: boolean): Promise<void> {
    return this.withOpen(() => requireNativeModule().setP2pEnabled(this.clientId, this.sessionId, enabled));
  }

  async updateBufferedDurationMs(durationMs: number): Promise<void> {
    assertNonNegative(durationMs, 'durationMs');
    return this.withOpen(() => requireNativeModule().updateBufferedDurationMs(this.clientId, this.sessionId, durationMs));
  }

  async updateCurrentPositionMs(positionMs: number): Promise<void> {
    assertNonNegative(positionMs, 'positionMs');
    return this.withOpen(() => requireNativeModule().updateCurrentPositionMs(this.clientId, this.sessionId, positionMs));
  }

  async getStats(): Promise<MeshStreamStats> {
    return this.withOpen(() => requireNativeModule().getStats(this.clientId, this.sessionId));
  }

  async getDiagnostics(): Promise<MeshStreamDiagnostics> {
    return this.withOpen(() => requireNativeModule().getDiagnostics(this.clientId, this.sessionId));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    if (!this.closing) {
      this.closing = requireNativeModule()
        .closeSession(this.clientId, this.sessionId)
        .then(() => { this.closed = true; })
        .finally(() => { this.closing = undefined; });
    }
    return this.closing;
  }

  private async withOpen<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed || this.closing) throw new Error('Playback session is closed.');
    return operation();
  }
}

export class MeshStreamClient {
  readonly clientId: string;
  private closed = false;
  private closing?: Promise<void>;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async createPlaybackSession(options: PlaybackSessionOptions): Promise<MeshStreamPlaybackSession> {
    assertNonEmpty(options.url, 'options.url');
    return this.withOpen(async () => new MeshStreamPlaybackSession(
      await requireNativeModule().createPlaybackSession(this.clientId, options),
    ));
  }

  async getStatus(): Promise<MeshStreamStatus> {
    return this.withOpen(() => requireNativeModule().getStatus(this.clientId));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    if (!this.closing) {
      this.closing = requireNativeModule()
        .closeClient(this.clientId)
        .then(() => { this.closed = true; })
        .finally(() => { this.closing = undefined; });
    }
    return this.closing;
  }

  private async withOpen<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed || this.closing) throw new Error('MeshStream client is closed.');
    return operation();
  }
}

export const MeshStream = {
  async create(config: MeshStreamConfig): Promise<MeshStreamClient> {
    assertNonEmpty(config.key, 'config.key');
    const result = await requireNativeModule().createClient(config);
    return new MeshStreamClient(result.clientId);
  },

  addEventListener(listener: (event: MeshStreamEvent) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener(EVENT_NAME, listener);
  },
};

/** Filtered event subscription for a particular client or playback session. */
export function addMeshStreamEventListener(
  listener: (event: MeshStreamEvent) => void,
  filter?: { clientId?: string; sessionId?: string; type?: MeshStreamEventName },
): EmitterSubscription {
  return MeshStream.addEventListener((event) => {
    if (filter?.clientId && event.clientId !== filter.clientId) return;
    if (filter?.sessionId && event.sessionId !== filter.sessionId) return;
    if (filter?.type && event.type !== filter.type) return;
    listener(event);
  });
}
