import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList,
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

interface Props {
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  isPrivate: boolean;
  onClose: () => void;
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

export default function NotificationsModal({ visible, theme, isDark, currentUserId, isPrivate, onClose }: Props) {
  const [section, setSection] = useState<Section>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (!visible || !currentUserId) return;

    setLoadingNotifs(true);
    loadNotifications(currentUserId)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoadingNotifs(false));

    if (isPrivate) {
      setLoadingRequests(true);
      loadFollowRequests(currentUserId)
        .then(setRequests)
        .catch(() => {})
        .finally(() => setLoadingRequests(false));
    }
  }, [visible, currentUserId, isPrivate]);

  async function handleAccept(req: FollowRequest) {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try { await acceptFollowRequest(req.id); } catch {}
  }

  async function handleDecline(req: FollowRequest) {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try { await declineFollowRequest(req.id); } catch {}
  }

  function renderNotification({ item }: { item: Notification }) {
    return (
      <View style={[styles.item, { borderBottomColor: theme.sep }]}>
        <InitialsBubble initials={item.authorInitials} theme={theme} />
        <View style={styles.itemBody}>
          <Text style={[styles.itemText, { color: theme.text }]}>
            <Text style={styles.itemName}>{item.authorName}</Text>
            {item.type === 'comment' ? ' commented on your ' : ' liked your '}
            <Text style={[styles.itemRoute, { color: theme.accent }]}>
              {item.fromCode} → {item.toCode}
            </Text>
            {' flight'}
          </Text>
          {item.type === 'comment' && item.text ? (
            <Text style={[styles.itemComment, { color: theme.textSub }]} numberOfLines={2}>
              "{item.text}"
            </Text>
          ) : null}
          <Text style={[styles.itemTime, { color: theme.textMuted }]}>{item.timeAgo}</Text>
        </View>
        <Ionicons
          name={item.type === 'comment' ? 'chatbubble' : 'heart'}
          size={14}
          color={item.type === 'comment' ? theme.accent : '#FF3B30'}
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

  const showRequests = isPrivate;
  const loading = section === 'notifications' ? loadingNotifs : loadingRequests;
  const data = section === 'notifications' ? notifications : requests;
  const isEmpty = !loading && data.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Segment tabs (only if private account with requests) */}
        {showRequests && (
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5,
  },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  segmentRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  segmentText: { fontSize: 14, fontWeight: '600' },

  list: { paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, gap: 12,
  },
  bubble: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubbleText: { fontSize: 15, fontWeight: '700' },
  itemBody: { flex: 1, gap: 3 },
  itemText: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  itemName: { fontWeight: '700' },
  itemHandle: { fontWeight: '400', fontSize: 13 },
  itemRoute: { fontWeight: '700' },
  itemComment: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  itemTime: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  itemIcon: { marginTop: 2, flexShrink: 0 },

  reqBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  reqBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  reqBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtext: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
