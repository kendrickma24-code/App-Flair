import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import {
  loadNotifications, Notification,
  loadFollowRequests, acceptFollowRequest, declineFollowRequest, FollowRequest,
} from '../services/db';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  isPrivate: boolean;
  onClearBadge: () => void;
}

type Section = 'notifications' | 'requests';

function InitialsBubble({ initials, avatarUrl, theme }: { initials: string; avatarUrl?: string | null; theme: Theme }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.bubble} />;
  }
  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.bubble}>
      <Text style={[styles.bubbleText, { color: '#fff' }]}>{initials}</Text>
    </LinearGradient>
  );
}

export default function NotificationsScreen({ theme, isDark, currentUserId, isPrivate, onClearBadge }: Props) {
  const [section, setSection] = useState<Section>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;

    setLoadingNotifs(true);
    loadNotifications(currentUserId)
      .then(data => {
        setNotifications(data);
        // Mark as seen
        if (data.length > 0) {
          onClearBadge();
          AsyncStorage.setItem(`notif_seen_${currentUserId}`, new Date().toISOString()).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingNotifs(false));

    if (isPrivate) {
      setLoadingRequests(true);
      loadFollowRequests(currentUserId)
        .then(setRequests)
        .catch(() => {})
        .finally(() => setLoadingRequests(false));
    }
  }, [currentUserId, isPrivate]);

  async function handleAccept(req: FollowRequest) {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try { await acceptFollowRequest(req.id); } catch {}
  }

  async function handleDecline(req: FollowRequest) {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try { await declineFollowRequest(req.id); } catch {}
  }

  function renderNotification({ item }: { item: Notification }) {
    const isSameFlight = item.type === 'same_flight';
    const isComment = item.type === 'comment';
    const verb = isComment ? ' commented on your ' : isSameFlight ? ' is on your ' : ' liked your ';
    return (
      <View style={[styles.item, { borderBottomColor: theme.sep }]}>
        <InitialsBubble initials={item.authorInitials} theme={theme} />
        <View style={styles.itemBody}>
          <Text style={[styles.itemText, { color: theme.text }]}>
            <Text style={styles.itemName}>{item.authorName}</Text>
            {verb}
            <Text style={[styles.itemRoute, { color: theme.accent }]}>
              {item.fromCode} → {item.toCode}
            </Text>
            {' flight'}
          </Text>
          {isComment && item.text ? (
            <Text style={[styles.itemComment, { color: theme.textSub }]} numberOfLines={2}>
              "{item.text}"
            </Text>
          ) : null}
          <Text style={[styles.itemTime, { color: theme.textMuted }]}>{item.timeAgo}</Text>
        </View>
        <Ionicons
          name={isComment ? 'chatbubble' : isSameFlight ? 'airplane' : 'heart'}
          size={14}
          color={isComment ? theme.accent : isSameFlight ? theme.accent : '#FF3B30'}
          style={styles.itemIcon}
        />
      </View>
    );
  }

  function renderRequest({ item }: { item: FollowRequest }) {
    const displayName = item.fullName || item.username || 'Someone';
    return (
      <View style={[styles.item, { borderBottomColor: theme.sep }]}>
        <InitialsBubble initials={item.initials} avatarUrl={item.avatarUrl} theme={theme} />
        <View style={styles.itemBody}>
          <Text style={[styles.itemText, { color: theme.text }]}>
            <Text style={styles.itemName}>{displayName}</Text>
            {item.username ? <Text style={[styles.itemHandle, { color: theme.textMuted }]}> @{item.username}</Text> : null}
            <Text style={{ fontWeight: '400' }}> wants to follow you</Text>
          </Text>
          <Text style={[styles.itemTime, { color: theme.textMuted }]}>{item.timeAgo}</Text>
          <View style={styles.reqBtns}>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: theme.accent }]}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.reqBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: theme.surface }]}
              onPress={() => handleDecline(item)}
            >
              <Text style={[styles.reqBtnText, { color: theme.text }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const loading = section === 'notifications' ? loadingNotifs : loadingRequests;
  const data = section === 'notifications' ? notifications : requests;
  const isEmpty = !loading && data.length === 0;

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: theme.sep }]}>
        <Text style={[styles.title, { color: theme.text }]}>Activity</Text>
      </View>

      {isPrivate && (
        <View style={[styles.segmentRow, { borderBottomColor: theme.sep }]}>
          {(['notifications', 'requests'] as Section[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.segmentBtn, section === s && { borderBottomColor: theme.accent, borderBottomWidth: 2.5 }]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.segmentText, { color: section === s ? theme.accent : theme.textMuted }]}>
                {s === 'notifications' ? 'Activity' : `Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : isEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name={section === 'notifications' ? 'notifications-outline' : 'person-add-outline'}
            size={44}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {section === 'notifications' ? 'No notifications yet' : 'No follow requests'}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
            {section === 'notifications'
              ? "When someone likes or comments on your flights, you'll see it here"
              : 'New follower requests will appear here'}
          </Text>
        </View>
      ) : section === 'notifications' ? (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={r => r.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },

  segmentRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segmentBtn: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  segmentText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },

  list: { paddingTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 13,
  },
  bubble: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubbleText: { fontSize: 16, fontWeight: '700' },
  itemBody: { flex: 1, gap: 3 },
  itemText: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  itemName: { fontWeight: '700' },
  itemHandle: { fontWeight: '400', fontSize: 13 },
  itemRoute: { fontWeight: '700' },
  itemComment: { fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  itemTime: { fontSize: 11, fontWeight: '500', marginTop: 3, letterSpacing: 0.1 },
  itemIcon: { marginTop: 3, flexShrink: 0 },

  reqBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reqBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  reqBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 48, gap: 14 },
  emptyText: { fontSize: 16, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  emptySubtext: { fontSize: 13, textAlign: 'center', lineHeight: 21 },
});
