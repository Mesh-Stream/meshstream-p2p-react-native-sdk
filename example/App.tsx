import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
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
  type MeshStreamVersionInfo,
} from 'react-native-meshstream';

type LogEntry = {id: number; text: string};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function App(): React.JSX.Element {
  const clientRef = useRef<MeshStreamClient>();
  const sessionRef = useRef<MeshStreamPlaybackSession>();
  const [version, setVersion] = useState<MeshStreamVersionInfo>();
  const [sdkKey, setSdkKey] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [contentId, setContentId] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const [status, setStatus] = useState<MeshStreamStatus>();
  const [stats, setStats] = useState<MeshStreamStats>();
  const [diagnostics, setDiagnostics] = useState<MeshStreamDiagnostics>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [working, setWorking] = useState(false);
  const refreshingRef = useRef(false);

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

  const refreshTelemetry = useCallback(async () => {
    const client = clientRef.current;
    const session = sessionRef.current;
    if (!client || !session || refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    try {
      const [nextStatus, nextStats, nextDiagnostics] = await Promise.all([
        client.getStatus(),
        session.getStats(),
        session.getDiagnostics(),
      ]);
      if (clientRef.current === client && sessionRef.current === session) {
        setStatus(nextStatus);
        setStats(nextStats);
        setDiagnostics(nextDiagnostics);
      }
    } catch {
      // Event delivery and the next refresh keep the dashboard current after a transient failure.
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    MeshStream.getVersion().then(value => {
      if (active) setVersion(value);
    }).catch(error => {
      if (active) appendLog(`版本读取失败: ${String(error)}`);
    });
    return () => { active = false; };
  }, [appendLog]);

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

  useEffect(() => {
    if (!playbackUrl) {
      return;
    }
    const timer = setInterval(() => {
      refreshTelemetry().catch(() => undefined);
    }, 1_000);
    return () => clearInterval(timer);
  }, [playbackUrl, refreshTelemetry]);

  const start = async () => {
    if (!sdkKey.trim() || !mediaUrl.trim()) {
      Alert.alert('缺少参数', '请输入 SDK Key 和媒体源地址。');
      return;
    }
    setWorking(true);
    try {
      await closeResources();
      const client = await MeshStream.create({key: sdkKey.trim(), p2pEnabled: true});
      clientRef.current = client;
      const session = await client.createPlaybackSession({
        url: mediaUrl.trim(),
        contentId: contentId.trim() || undefined,
      });
      sessionRef.current = session;
      setPlaybackUrl(session.playbackUrl);
      await refreshTelemetry();
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
        <Text style={styles.subtitle}>验证工具。Key 仅保存在当前应用内存中。</Text>
        {version ? <Text style={styles.subtitle}>React Native {version.packageVersion} · {version.platform} SDK {version.nativeSdkVersion}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>SDK Key</Text>
          <TextInput value={sdkKey} onChangeText={setSdkKey} autoCapitalize="none" autoCorrect={false} placeholder="key_..." placeholderTextColor="#73809a" style={styles.input} />
          <Text style={styles.label}>媒体源地址</Text>
          <TextInput value={mediaUrl} onChangeText={setMediaUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://example.com/live.m3u8" placeholderTextColor="#73809a" style={styles.input} />
          <Text style={styles.label}>Content ID（可选）</Text>
          <TextInput value={contentId} onChangeText={setContentId} autoCapitalize="none" autoCorrect={false} placeholder="留空时由 SDK 生成" placeholderTextColor="#73809a" style={styles.input} />
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
            <Action label="关闭" onPress={close} disabled={working} danger />
          </View>
        </View> : null}

        <TelemetryPanel status={status} stats={stats} diagnostics={diagnostics} />
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

function TelemetryPanel({status, stats, diagnostics}: {status?: MeshStreamStatus; stats?: MeshStreamStats; diagnostics?: MeshStreamDiagnostics}): React.JSX.Element | null {
  if (!status && !stats && !diagnostics) {
    return null;
  }
  const metrics = [
    ['Peers', String(stats?.connectedPeers ?? 0)],
    ['P2P Down', formatBytes(stats?.p2pDownloaded ?? 0)],
    ['HTTP Down', formatBytes(stats?.httpDownloaded ?? 0)],
    ['P2P Up', formatBytes(stats?.p2pUploaded ?? 0)],
    ['Offload', formatPercent(stats?.downloadOffloadRatio ?? 0)],
    ['Config Version', status?.configVersion ?? '—'],
  ];
  const details = [
    ['P2P 状态', status?.effectiveP2pEnabled ? '已启用' : '不可用'],
    ['原因', status?.reason ?? '—'],
    ['边缘地域', status?.edgeRegion ?? '—'],
    ['配额', status?.quotaStatus ?? '—'],
    ['Tracker', status?.trackerPoolReady === undefined ? '—' : status.trackerPoolReady ? '就绪' : '未就绪'],
    ['回源次数', String(diagnostics?.fallbackCount ?? 0)],
    ['首个 Peer', diagnostics?.firstPeerConnectMs === undefined ? '—' : `${diagnostics.firstPeerConnectMs} ms`],
    ['Tracker 错误', String(stats?.trackerErrors ?? 0)],
  ];
  return <>
    <View style={styles.card}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>实时传输</Text><Text style={styles.refreshHint}>每秒更新</Text></View>
      <View style={styles.metricList}>{metrics.map(([label, value]) => <MetricRow key={label} label={label} value={value} prominent />)}</View>
    </View>
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>P2P 状态</Text>
      <View style={styles.metricList}>{details.map(([label, value]) => <MetricRow key={label} label={label} value={value} />)}</View>
    </View>
  </>;
}

function MetricRow({label, value, prominent}: {label: string; value: string; prominent?: boolean}): React.JSX.Element {
  return <View style={styles.metricRow}><Text style={styles.metricLabel}>{label}</Text><Text selectable style={[styles.metricValue, prominent && styles.metricValueProminent]} numberOfLines={1}>{value}</Text></View>;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${Math.round(value)} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#0b1220'}, page: {padding: 16, gap: 12},
  title: {color: '#f8fafc', fontSize: 24, fontWeight: '700'}, subtitle: {color: '#aab7ca', fontSize: 14, marginBottom: 4},
  card: {backgroundColor: '#131e31', borderColor: '#263754', borderWidth: 1, borderRadius: 8, padding: 14},
  label: {color: '#d8e2f0', fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 5},
  input: {backgroundColor: '#0b1424', borderColor: '#314768', borderWidth: 1, borderRadius: 6, color: '#f8fafc', minHeight: 44, paddingHorizontal: 11},
  action: {alignItems: 'center', backgroundColor: '#34445f', borderRadius: 6, flexGrow: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 10}, primaryAction: {backgroundColor: '#1479d1'}, dangerAction: {backgroundColor: '#b53a4a'}, disabledAction: {opacity: 0.45}, actionText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  sectionTitle: {color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 8}, url: {color: '#71c4ff', fontSize: 12, marginBottom: 10}, video: {aspectRatio: 16 / 9, backgroundColor: '#020617', width: '100%'}, actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  sectionHeader: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'}, refreshHint: {color: '#8fa0b8', fontSize: 12, marginBottom: 8}, metricList: {borderTopColor: '#263754', borderTopWidth: 1}, metricRow: {alignItems: 'center', borderBottomColor: '#263754', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingVertical: 8}, metricLabel: {color: '#aab7ca', fontSize: 13}, metricValue: {color: '#d8e2f0', flexShrink: 1, fontSize: 13, fontWeight: '600', marginLeft: 16, textAlign: 'right'}, metricValueProminent: {color: '#71c4ff', fontFamily: 'monospace', fontSize: 16}, log: {color: '#c7d5e8', fontFamily: 'monospace', fontSize: 11, lineHeight: 17, marginBottom: 5}, muted: {color: '#8fa0b8', fontSize: 13},
});

export default App;
