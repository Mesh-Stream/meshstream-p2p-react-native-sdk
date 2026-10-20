import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';
import {
  addMeshStreamEventListener,
  MeshStream,
  type MeshStreamClient,
  type MeshStreamDiagnostics,
  type MeshStreamEvent,
  type MeshStreamPlaybackSession,
  type MeshStreamStats,
  type MeshStreamStatus,
} from 'react-native-meshstream';

type LogEntry = {id: number; text: string};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function App(): React.JSX.Element {
  const clientRef = useRef<MeshStreamClient>();
  const sessionRef = useRef<MeshStreamPlaybackSession>();
  const [sdkKey, setSdkKey] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [contentId, setContentId] = useState('');
  const [p2pEnabled, setP2pEnabled] = useState(true);
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const [status, setStatus] = useState<MeshStreamStatus>();
  const [stats, setStats] = useState<MeshStreamStats>();
  const [diagnostics, setDiagnostics] = useState<MeshStreamDiagnostics>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [working, setWorking] = useState(false);

  const appendLog = useCallback((message: string) => {
    setLogs(entries => [
      {id: Date.now() + Math.random(), text: `${new Date().toLocaleTimeString()}  ${message}`},
      ...entries,
    ].slice(0, 80));
  }, []);

  const closeResources = useCallback(async () => {
    const session = sessionRef.current;
    const client = clientRef.current;
    sessionRef.current = undefined;
    clientRef.current = undefined;
    setPlaybackUrl(undefined);
    setStatus(undefined);
    setStats(undefined);
    setDiagnostics(undefined);
    if (session) {
      await session.close();
    }
    if (client) {
      await client.close();
    }
  }, []);

  useEffect(() => {
    const subscription = addMeshStreamEventListener((event: MeshStreamEvent) => {
      if (event.clientId !== clientRef.current?.clientId) {
        return;
      }
      if (event.sessionId && event.sessionId !== sessionRef.current?.sessionId) {
        return;
      }
      if (event.statistics) {
        setStats(event.statistics);
      }
      appendLog(`${event.type}${event.reason ? `: ${event.reason}` : ''}${event.peerCount !== undefined ? `, peers=${event.peerCount}` : ''}`);
    });
    return () => {
      subscription.remove();
      closeResources().catch(() => undefined);
    };
  }, [appendLog, closeResources]);

  const start = async () => {
    if (!sdkKey.trim() || !mediaUrl.trim()) {
      Alert.alert('缺少参数', '请输入 Android SDK Key 和媒体源地址。');
      return;
    }
    setWorking(true);
    try {
      await closeResources();
      const client = await MeshStream.create({key: sdkKey.trim(), p2pEnabled});
      clientRef.current = client;
      const session = await client.createPlaybackSession({
        url: mediaUrl.trim(),
        contentId: contentId.trim() || undefined,
      });
      sessionRef.current = session;
      setPlaybackUrl(session.playbackUrl);
      setStatus(await client.getStatus());
      setStats(await session.getStats());
      setDiagnostics(await session.getDiagnostics());
      appendLog(`会话已创建，模式=${session.playbackMode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLog(`创建失败: ${message}`);
      Alert.alert('创建会话失败', message);
      await closeResources().catch(() => undefined);
    } finally {
      setWorking(false);
    }
  };

  const preload = async () => {
    if (!sessionRef.current) {
      return;
    }
    setWorking(true);
    try {
      appendLog(`预加载结果: ${await sessionRef.current.preload()}`);
    } catch (error) {
      appendLog(`预加载失败: ${String(error)}`);
    } finally {
      setWorking(false);
    }
  };

  const refresh = async () => {
    const client = clientRef.current;
    const session = sessionRef.current;
    if (!client || !session) {
      return;
    }
    setWorking(true);
    try {
      setStatus(await client.getStatus());
      setStats(await session.getStats());
      setDiagnostics(await session.getDiagnostics());
      appendLog('已刷新状态、统计与诊断数据');
    } catch (error) {
      appendLog(`刷新失败: ${String(error)}`);
    } finally {
      setWorking(false);
    }
  };

  const toggleP2p = async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const next = !p2pEnabled;
    setWorking(true);
    try {
      await session.setP2pEnabled(next);
      setP2pEnabled(next);
      appendLog(`P2P 已${next ? '启用' : '关闭'}`);
      await refresh();
    } catch (error) {
      appendLog(`更新 P2P 状态失败: ${String(error)}`);
    } finally {
      setWorking(false);
    }
  };

  const close = async () => {
    setWorking(true);
    try {
      await closeResources();
      appendLog('会话与客户端已关闭');
    } catch (error) {
      appendLog(`关闭失败: ${String(error)}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={styles.safeArea.backgroundColor} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>MeshStream React Native Demo</Text>
        <Text style={styles.subtitle}>Android 验证工具。Key 仅保存在当前应用内存中。</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Android SDK Key</Text>
          <TextInput value={sdkKey} onChangeText={setSdkKey} autoCapitalize="none" autoCorrect={false} placeholder="key_..." placeholderTextColor="#73809a" style={styles.input} />
          <Text style={styles.label}>媒体源地址</Text>
          <TextInput value={mediaUrl} onChangeText={setMediaUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://example.com/live.m3u8" placeholderTextColor="#73809a" style={styles.input} />
          <Text style={styles.label}>Content ID（可选）</Text>
          <TextInput value={contentId} onChangeText={setContentId} autoCapitalize="none" autoCorrect={false} placeholder="留空时由 SDK 生成" placeholderTextColor="#73809a" style={styles.input} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>创建时启用 P2P</Text>
            <Switch value={p2pEnabled} onValueChange={setP2pEnabled} disabled={Boolean(sessionRef.current) || working} />
          </View>
          <Action label="创建并播放" onPress={start} disabled={working} primary />
        </View>

        {playbackUrl ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>播放</Text>
          <Text selectable style={styles.url}>{playbackUrl}</Text>
          <Video
            source={{uri: playbackUrl}}
            style={styles.video}
            controls
            resizeMode="contain"
            onProgress={({currentTime}) => {
              sessionRef.current?.updateCurrentPositionMs(currentTime * 1000).catch(() => undefined);
            }}
            onError={(error) => appendLog(`播放器错误: ${formatJson(error)}`)}
            onLoad={() => appendLog('播放器已加载 SDK 返回的播放地址')}
          />
          <View style={styles.actions}>
            <Action label="预加载" onPress={preload} disabled={working} />
            <Action label={p2pEnabled ? '关闭 P2P' : '启用 P2P'} onPress={toggleP2p} disabled={working} />
            <Action label="刷新数据" onPress={refresh} disabled={working} />
            <Action label="关闭" onPress={close} disabled={working} danger />
          </View>
        </View> : null}

        <DataBlock title="连接状态" value={status} />
        <DataBlock title="传输统计" value={stats} />
        <DataBlock title="诊断信息" value={diagnostics} />
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>事件日志</Text>
          {logs.length ? logs.map(log => <Text key={log.id} style={styles.log}>{log.text}</Text>) : <Text style={styles.muted}>创建会话后会显示 SDK 和播放器事件。</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({label, onPress, disabled, primary, danger}: {label: string; onPress: () => void; disabled?: boolean; primary?: boolean; danger?: boolean}): React.JSX.Element {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.action, primary && styles.primaryAction, danger && styles.dangerAction, disabled && styles.disabledAction]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function DataBlock({title, value}: {title: string; value: unknown}): React.JSX.Element | null {
  if (!value) {
    return null;
  }
  return <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text><Text selectable style={styles.json}>{formatJson(value)}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#0b1220'}, page: {padding: 16, gap: 12},
  title: {color: '#f8fafc', fontSize: 24, fontWeight: '700'}, subtitle: {color: '#aab7ca', fontSize: 14, marginBottom: 4},
  card: {backgroundColor: '#131e31', borderColor: '#263754', borderWidth: 1, borderRadius: 8, padding: 14},
  label: {color: '#d8e2f0', fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 5},
  input: {backgroundColor: '#0b1424', borderColor: '#314768', borderWidth: 1, borderRadius: 6, color: '#f8fafc', minHeight: 44, paddingHorizontal: 11},
  switchRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14}, switchLabel: {color: '#d8e2f0', fontSize: 14},
  action: {alignItems: 'center', backgroundColor: '#34445f', borderRadius: 6, flexGrow: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 10}, primaryAction: {backgroundColor: '#1479d1'}, dangerAction: {backgroundColor: '#b53a4a'}, disabledAction: {opacity: 0.45}, actionText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  sectionTitle: {color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 8}, url: {color: '#71c4ff', fontSize: 12, marginBottom: 10}, video: {aspectRatio: 16 / 9, backgroundColor: '#020617', width: '100%'}, actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  json: {color: '#c7d5e8', fontFamily: 'monospace', fontSize: 11, lineHeight: 16}, log: {color: '#c7d5e8', fontFamily: 'monospace', fontSize: 11, lineHeight: 17, marginBottom: 5}, muted: {color: '#8fa0b8', fontSize: 13},
});

export default App;
