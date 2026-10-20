import { NativeModules } from 'react-native';

import type {
  MeshStreamConfig,
  MeshStreamDiagnostics,
  MeshStreamSessionInfo,
  MeshStreamStats,
  MeshStreamStatus,
  PlaybackSessionOptions,
} from './types';

interface NativeMeshStreamP2P {
  createClient(config: MeshStreamConfig): Promise<{ clientId: string; status: MeshStreamStatus }>;
  createPlaybackSession(clientId: string, options: PlaybackSessionOptions): Promise<MeshStreamSessionInfo>;
  preload(clientId: string, sessionId: string): Promise<boolean>;
  setP2pEnabled(clientId: string, sessionId: string, enabled: boolean): Promise<void>;
  updateBufferedDurationMs(clientId: string, sessionId: string, durationMs: number): Promise<void>;
  updateCurrentPositionMs(clientId: string, sessionId: string, positionMs: number): Promise<void>;
  getStats(clientId: string, sessionId: string): Promise<MeshStreamStats>;
  getDiagnostics(clientId: string, sessionId: string): Promise<MeshStreamDiagnostics>;
  getStatus(clientId: string): Promise<MeshStreamStatus>;
  closeSession(clientId: string, sessionId: string): Promise<void>;
  closeClient(clientId: string): Promise<void>;
}

const nativeModule = NativeModules.MeshStreamP2P as NativeMeshStreamP2P | undefined;

export function requireNativeModule(): NativeMeshStreamP2P {
  if (!nativeModule) {
    throw new Error(
      'MeshStreamP2P is not linked. Rebuild the iOS or Android app after installing @meshstream/react-native-p2p.',
    );
  }
  return nativeModule;
}
