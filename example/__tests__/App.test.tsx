/**
 * @format
 */

import 'react-native';
import React from 'react';
import {Pressable, Switch, TextInput} from 'react-native';

jest.mock('react-native-meshstream', () => ({
  addMeshStreamEventListener: jest.fn(() => ({remove: jest.fn()})),
  MeshStream: {create: jest.fn(), getVersion: jest.fn().mockResolvedValue({packageVersion: '1.0.2', nativeSdkVersion: '1.0.6', platform: 'ios'})},
}));

import App from '../App';
import {MeshStream} from 'react-native-meshstream';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

it('shows package and native versions before creating a client', async () => {
  (MeshStream.create as jest.Mock).mockClear();
  let app: ReturnType<typeof renderer.create>;

  await renderer.act(async () => {
    app = renderer.create(<App />);
  });
  expect(JSON.stringify(app!.toJSON())).toContain('1.0.2');
  expect(JSON.stringify(app!.toJSON())).toContain('1.0.6');
  expect(MeshStream.create).not.toHaveBeenCalled();
  await renderer.act(async () => {
    app!.unmount();
  });
});

it('does not expose a P2P toggle while creating a session', async () => {
  let app: ReturnType<typeof renderer.create>;

  await renderer.act(async () => {
    app = renderer.create(<App />);
  });

  expect(app!.root.findAllByType(Switch)).toHaveLength(0);

  await renderer.act(async () => {
    app!.unmount();
  });
});

it('does not expose preload as a demo action', async () => {
  const session = {
    clientId: 'client-1',
    sessionId: 'session-1',
    playbackUrl: 'http://127.0.0.1:8080/playback.m3u8',
    playbackMode: 'NATIVE_CDN',
    close: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({}),
    getDiagnostics: jest.fn().mockResolvedValue({}),
  };
  const client = {
    clientId: 'client-1',
    close: jest.fn().mockResolvedValue(undefined),
    createPlaybackSession: jest.fn().mockResolvedValue(session),
    getStatus: jest.fn().mockResolvedValue({}),
  };
  (MeshStream.create as jest.Mock).mockResolvedValue(client);
  let app: ReturnType<typeof renderer.create>;

  await renderer.act(async () => {
    app = renderer.create(<App />);
  });

  const inputs = app!.root.findAllByType(TextInput);
  await renderer.act(async () => {
    inputs[0].props.onChangeText('key_demo');
    inputs[1].props.onChangeText('https://example.com/live.m3u8');
  });
  await renderer.act(async () => {
    await app!.root.findAllByType(Pressable)[0].props.onPress();
  });

  try {
    expect(app!.root.findAllByType(Pressable)).toHaveLength(2);
  } finally {
    await renderer.act(async () => {
      app!.unmount();
    });
  }
});

it('refreshes telemetry once per second after creating a session', async () => {
  jest.useFakeTimers();
  const session = {
    clientId: 'client-1',
    sessionId: 'session-1',
    playbackUrl: 'http://127.0.0.1:8080/playback.m3u8',
    playbackMode: 'NATIVE_P2P',
    close: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({
      httpDownloaded: 0,
      p2pDownloaded: 0,
      p2pUploaded: 0,
      httpSegmentDownloadSuccesses: 0,
      httpSegmentDownloadFailures: 0,
      p2pSegmentDownloadSuccesses: 0,
      p2pSegmentDownloadFailures: 0,
      p2pSegmentUploadSuccesses: 0,
      p2pSegmentUploadFailures: 0,
      connectedPeers: 0,
      peerConnectErrors: 0,
      trackerErrors: 0,
      downloadOffloadRatio: 0,
      p2pSegmentDownloadSuccessRatio: 0,
      p2pSegmentUploadSuccessRatio: 0,
    }),
    getDiagnostics: jest.fn().mockResolvedValue({
      fallbackCount: 0,
      iceAttempts: 0,
      iceSuccesses: 0,
      iceFailures: 0,
      iceDurationMs: 0,
    }),
  };
  const client = {
    clientId: 'client-1',
    close: jest.fn().mockResolvedValue(undefined),
    createPlaybackSession: jest.fn().mockResolvedValue(session),
    getStatus: jest.fn().mockResolvedValue({
      accountEnabled: true,
      applicationEnabled: true,
      keyEnabled: true,
      platformEnabled: true,
      effectiveP2pEnabled: true,
      reason: 'OK',
    }),
  };
  const create = MeshStream.create as jest.Mock;
  create.mockResolvedValue(client);
  let app: ReturnType<typeof renderer.create>;

  await renderer.act(async () => {
    app = renderer.create(<App />);
  });
  const inputs = app!.root.findAllByType(TextInput);
  await renderer.act(async () => {
    inputs[0].props.onChangeText('key_demo');
    inputs[1].props.onChangeText('https://example.com/live.m3u8');
  });
  await renderer.act(async () => {
    await app!.root.findAllByType(Pressable)[0].props.onPress();
  });

  expect(create).toHaveBeenCalledWith({key: 'key_demo', p2pEnabled: true});

  await renderer.act(async () => {
    jest.advanceTimersByTime(1_000);
  });

  expect(client.getStatus).toHaveBeenCalledTimes(2);
  expect(session.getStats).toHaveBeenCalledTimes(2);
  expect(session.getDiagnostics).toHaveBeenCalledTimes(2);

  await renderer.act(async () => {
    app!.unmount();
  });
  jest.useRealTimers();
});
