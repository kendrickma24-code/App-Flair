import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  TouchableOpacity, ScrollView, Image, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { SearchUser, sendFollowRequest, unfollowUser, getFollowCounts } from '../services/db';
import { supabase } from '../lib/supabase';
import FollowListModal from './FollowListModal';

interface FlightRow {
  id: string;
  fromCode: string;
  toCode: string;
  date: string;
  flightNum: string;
  status: string;
  photos: string[];
}

interface Props {
  user: SearchUser | null;
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AVATAR_COLORS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
];

function avatarColor(id: string): [string, string] {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function UserProfileModal({ user, visible, theme, isDark, currentUserId, onClose }: Props) {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState<SearchUser['followStatus']>('none');
  const [bio, setBio] = useState('');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    if (visible && user) {
      setFollowStatus(user.followStatus);
      loadProfile();
      loadFlights(user.followStatus);
      getFollowCounts(user.id).then(setFollowCounts).catch(() => {});
    }
  }, [visible, user]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', user.id)
      .single();
    setBio(data?.bio ?? '');
  }

  async function loadFlights(status: SearchUser['followStatus']) {
    if (!user) return;
    const canSee = !user.isPrivate || status === 'accepted';
    if (!canSee) { setFlights([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase.rpc('get_user_flights', {
        p_viewer_id: currentUserId,
        p_target_user_id: user.id,
      });
      setFlights((data ?? []).map((r: any) => ({
        id: r.id,
        fromCode: r.from_code,
        toCode: r.to_code,
        date: r.date,
        flightNum: r.flight_num ?? '',
        status: r.status,
        photos: Array.isArray(r.photos) ? r.photos : [],
      })));
    } catch {}
    setLoading(false);
  }

  async function handleFollowPress() {
    if (!user) return;
    if (followStatus === 'accepted' || followStatus === 'pending') {
      const prev = followStatus;
      setFollowStatus('none');
      setFlights([]);
      try { await unfollowUser(currentUserId, user.id); } catch { setFollowStatus(prev); }
    } else {
      const optimistic: SearchUser['followStatus'] = user.isPrivate ? 'pending' : 'accepted';
      setFollowStatus(optimistic);
      try {
        const result = await sendFollowRequest(currentUserId, user.id) as SearchUser['followStatus'];
        setFollowStatus(result);
        if (result === 'accepted') loadFlights('accepted');
      } catch { setFollowStatus('none'); }
    }
  }

  function handleClose() {
    setFlights([]);
    setBio('');
    onClose();
  }

  if (!user) return null;

  const initials = (user.fullName || user.username || '?')[0]?.toUpperCase() ?? '?';
  const colors = avatarColor(user.id);
  const canSee = !user.isPrivate || followStatus === 'accepted';

  const statusColor = (s: string) => s === 'upcoming' ? theme.upcoming : s === 'live' ? theme.live : theme.past;
  const statusLabel = (s: string) => s === 'upcoming' ? 'Upcoming' : s === 'live' ? 'Live' : 'Past';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>


        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            @{user.username}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Profile hero */}
          <View style={styles.hero}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={colors} style={styles.avatar}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </LinearGradient>
            )}

            <View style={styles.nameRow}>
              <Text style={[styles.username, { color: theme.text }]}>
                @{user.username}
              </Text>
              {user.isPrivate && (
                <Ionicons name="lock-closed" size={14} color={theme.textMuted} style={{ marginLeft: 6, marginTop: 2 }} />
              )}
            </View>
            {user.fullName ? (
              <Text style={[styles.fullName, { color: theme.textSub }]}>{user.fullName}</Text>
            ) : null}
            {bio ? <Text style={[styles.bio, { color: theme.textSub }]}>{bio}</Text> : null}

            {/* Stats */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.stat} onPress={() => setFollowList('followers')}>
                <Text style={[styles.statNum, { color: theme.text }]}>{followCounts.followers}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stat} onPress={() => setFollowList('following')}>
                <Text style={[styles.statNum, { color: theme.text }]}>{followCounts.following}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Following</Text>
              </TouchableOpacity>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: theme.text }]}>{flights.filter(f => f.photos.length > 0).length}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Trips</Text>
              </View>
            </View>

            {/* Follow button */}
            {followStatus === 'accepted' ? (
              <TouchableOpacity
                style={[styles.followBtn, { borderColor: theme.sep, borderWidth: 1.5 }]}
                onPress={handleFollowPress}
              >
                <Text style={[styles.followBtnText, { color: theme.textSub }]}>Following</Text>
              </TouchableOpacity>
            ) : followStatus === 'pending' ? (
              <TouchableOpacity
                style={[styles.followBtn, { backgroundColor: theme.surface }]}
                onPress={handleFollowPress}
              >
                <Text style={[styles.followBtnText, { color: theme.textSub }]}>Requested</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.followBtn, { backgroundColor: theme.accent }]}
                onPress={handleFollowPress}
              >
                <Text style={[styles.followBtnText, { color: '#fff' }]}>
                  {user.isPrivate ? 'Request to Follow' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Flights section */}
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
          ) : !canSee ? (
            <View style={styles.locked}>
              <View style={[styles.lockIconWrap, { backgroundColor: theme.surface }]}>
                <Ionicons name="lock-closed" size={32} color={theme.textMuted} />
              </View>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>This account is private</Text>
              <Text style={[styles.lockedSub, { color: theme.textMuted }]}>
                Follow this account to see their flights
              </Text>
            </View>
          ) : flights.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="airplane-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No flights logged yet</Text>
            </View>
          ) : (
            <View style={styles.flightList}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FLIGHTS</Text>
              {flights.map(f => (
                <View key={f.id} style={[styles.flightCard, { backgroundColor: theme.card }]}>
                  <View style={styles.flightRowTop}>
                    <View style={[styles.flightIcon, { backgroundColor: theme.accentBg }]}>
                      <Ionicons name="airplane-outline" size={16} color={theme.accent} />
                    </View>
                    <View style={styles.flightInfo}>
                      <View style={styles.routeRow}>
                        <Text style={[styles.routeCode, { color: theme.text }]}>{f.fromCode}</Text>
                        <Ionicons name="arrow-forward" size={11} color={theme.accent} />
                        <Text style={[styles.routeCode, { color: theme.text }]}>{f.toCode}</Text>
                      </View>
                      <Text style={[styles.flightMeta, { color: theme.textMuted }]}>
                        {f.flightNum ? `${f.flightNum} · ` : ''}{f.date}
                      </Text>
                    </View>
                    <Text style={[styles.flightStatus, { color: statusColor(f.status) }]}>
                      {statusLabel(f.status)}
                    </Text>
                  </View>
                  {f.photos.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.photoStrip}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {f.photos.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {user && (
        <FollowListModal
          visible={!!followList}
          type={followList ?? 'followers'}
          userId={user.id}
          currentUserId={currentUserId}
          theme={theme}
          isDark={isDark}
          onClose={() => setFollowList(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  closeBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitial: { color: '#fff', fontSize: 34, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  fullName: { fontSize: 14, fontWeight: '500', marginTop: 2, marginBottom: 4 },
  bio: { fontSize: 13, fontWeight: '500', lineHeight: 20, textAlign: 'center', marginBottom: 8, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 28, marginTop: 16, marginBottom: 18 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  followBtn: { paddingHorizontal: 32, paddingVertical: 11, borderRadius: 22 },
  followBtnText: { fontSize: 15, fontWeight: '700' },

  locked: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40, gap: 12 },
  lockIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle: { fontSize: 18, fontWeight: '700' },
  lockedSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '500' },

  flightList: { paddingHorizontal: 16, gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    textTransform: 'uppercase', marginBottom: 4, paddingHorizontal: 4,
  },
  flightCard: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  flightRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  flightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flightInfo: { flex: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeCode: { fontSize: 15, fontWeight: '800' },
  flightMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  flightStatus: { fontSize: 12, fontWeight: '700' },
  photoStrip: { paddingHorizontal: 14, paddingBottom: 12 },
  photo: { width: 120, height: 90, borderRadius: 10 },
});
