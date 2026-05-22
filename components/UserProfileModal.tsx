import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  TouchableOpacity, ScrollView, Image, ActivityIndicator,
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
  fromCity: string;
  toCode: string;
  toCity: string;
  date: string;
  flightNum: string;
  status: string;
  photos: string[];
}

interface Trip {
  id: string;
  legs: FlightRow[];
  startDate: string;
  endDate: string;
  route: string;
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

const AVATAR_COLORS: [string, string][] = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'],
];
function avatarColor(id: string): [string, string] {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function parseDate(ddmmyyyy: string): number {
  const p = ddmmyyyy.split('-');
  if (p.length !== 3) return 0;
  return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
}

function formatDate(ddmmyyyy: string): string {
  const p = ddmmyyyy.split('-');
  if (p.length !== 3) return ddmmyyyy;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mo = parseInt(p[1], 10) - 1;
  return `${months[mo]} ${parseInt(p[0], 10)}, ${p[2]}`;
}

function groupIntoTrips(flights: FlightRow[]): Trip[] {
  if (flights.length === 0) return [];
  const sorted = [...flights].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const groups: FlightRow[][] = [];
  let current: FlightRow[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];
    const daysDiff = Math.abs(parseDate(curr.date) - parseDate(prev.date)) / 86400000;
    if (prev.toCode === curr.fromCode && daysDiff <= 4) {
      current.push(curr);
    } else {
      groups.push(current);
      current = [curr];
    }
  }
  groups.push(current);

  return groups.map((legs, i) => {
    const codes = [legs[0].fromCode, ...legs.map(l => l.toCode)];
    const route = codes.join(' › ');
    const allPhotos = legs.flatMap(l => l.photos);
    return {
      id: `trip_${i}`,
      legs,
      startDate: legs[0].date,
      endDate: legs[legs.length - 1].date,
      route,
      photos: allPhotos,
    };
  });
}

export default function UserProfileModal({ user, visible, theme, isDark, currentUserId, onClose }: Props) {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState<SearchUser['followStatus']>('none');
  const [bio, setBio] = useState('');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
  const [tab, setTab] = useState<'trips' | 'logbook'>('trips');

  useEffect(() => {
    if (visible && user) {
      setFollowStatus(user.followStatus);
      setTab('trips');
      loadProfile();
      loadFlights(user.followStatus);
      getFollowCounts(user.id).then(setFollowCounts).catch(() => {});
    }
  }, [visible, user]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('bio').eq('id', user.id).single();
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
        fromCity: r.from_city ?? '',
        toCode: r.to_code,
        toCity: r.to_city ?? '',
        date: r.date,
        flightNum: r.flight_num ?? '',
        status: r.f_status ?? r.status,
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
    setFlights([]); setBio(''); onClose();
  }

  if (!user) return null;

  const initials = (user.fullName || user.username || '?')[0]?.toUpperCase() ?? '?';
  const colors = avatarColor(user.id);
  const canSee = !user.isPrivate || followStatus === 'accepted';
  const trips = groupIntoTrips(flights);

  const statusColor = (s: string) => s === 'upcoming' ? theme.upcoming : s === 'live' ? theme.live : theme.past;
  const statusLabel = (s: string) => s === 'upcoming' ? 'Upcoming' : s === 'live' ? 'Live' : 'Past';

  function renderTrips() {
    if (trips.length === 0) return (
      <View style={styles.empty}>
        <Ionicons name="airplane-outline" size={36} color={theme.textMuted} />
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No trips yet</Text>
      </View>
    );
    return (
      <View style={styles.listWrap}>
        {trips.map(trip => (
          <View key={trip.id} style={[styles.tripCard, { backgroundColor: theme.card, borderColor: theme.sep }]}>
            {trip.photos.length > 0 && (
              <Image source={{ uri: trip.photos[0] }} style={styles.tripPhoto} resizeMode="cover" />
            )}
            <View style={styles.tripBody}>
              <Text style={[styles.tripRoute, { color: theme.text }]}>{trip.route}</Text>
              <Text style={[styles.tripDate, { color: theme.textMuted }]}>
                {formatDate(trip.startDate)}{trip.startDate !== trip.endDate ? ` — ${formatDate(trip.endDate)}` : ''}
              </Text>
              <View style={styles.tripLegs}>
                {trip.legs.map(leg => (
                  <View key={leg.id} style={styles.legRow}>
                    <View style={[styles.legDot, { backgroundColor: theme.accent }]} />
                    <Text style={[styles.legText, { color: theme.textSub }]}>
                      {leg.fromCode} → {leg.toCode}
                      {leg.flightNum ? `  ·  ${leg.flightNum}` : ''}
                    </Text>
                    <Text style={[styles.legStatus, { color: statusColor(leg.status) }]}>
                      {statusLabel(leg.status)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  function renderLogbook() {
    if (flights.length === 0) return (
      <View style={styles.empty}>
        <Ionicons name="airplane-outline" size={36} color={theme.textMuted} />
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No flights logged yet</Text>
      </View>
    );
    return (
      <View style={styles.listWrap}>
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
                  {f.flightNum ? `${f.flightNum} · ` : ''}{formatDate(f.date)}
                </Text>
              </View>
              <Text style={[styles.flightStatus, { color: statusColor(f.status) }]}>
                {statusLabel(f.status)}
              </Text>
            </View>
            {f.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.photoStrip} contentContainerStyle={{ gap: 6 }}>
                {f.photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
                ))}
              </ScrollView>
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView edges={['top','bottom']} style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>@{user.username}</Text>
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
              <Text style={[styles.username, { color: theme.text }]}>@{user.username}</Text>
              {user.isPrivate && <Ionicons name="lock-closed" size={14} color={theme.textMuted} style={{ marginLeft: 6, marginTop: 2 }} />}
            </View>
            {user.fullName ? <Text style={[styles.fullName, { color: theme.textSub }]}>{user.fullName}</Text> : null}
            {bio ? <Text style={[styles.bio, { color: theme.textSub }]}>{bio}</Text> : null}

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
                <Text style={[styles.statNum, { color: theme.text }]}>{trips.length}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Trips</Text>
              </View>
            </View>

            {followStatus === 'accepted' ? (
              <TouchableOpacity style={[styles.followBtn, { borderColor: theme.sep, borderWidth: 1.5 }]} onPress={handleFollowPress}>
                <Text style={[styles.followBtnText, { color: theme.textSub }]}>Following</Text>
              </TouchableOpacity>
            ) : followStatus === 'pending' ? (
              <TouchableOpacity style={[styles.followBtn, { backgroundColor: theme.surface }]} onPress={handleFollowPress}>
                <Text style={[styles.followBtnText, { color: theme.textSub }]}>Requested</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.followBtn, { backgroundColor: theme.accent }]} onPress={handleFollowPress}>
                <Text style={[styles.followBtnText, { color: '#fff' }]}>{user.isPrivate ? 'Request to Follow' : 'Follow'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
          ) : !canSee ? (
            <View style={styles.locked}>
              <View style={[styles.lockIconWrap, { backgroundColor: theme.surface }]}>
                <Ionicons name="lock-closed" size={32} color={theme.textMuted} />
              </View>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>This account is private</Text>
              <Text style={[styles.lockedSub, { color: theme.textMuted }]}>Follow this account to see their flights</Text>
            </View>
          ) : (
            <>
              {/* Tabs */}
              <View style={[styles.tabRow, { borderBottomColor: theme.sep }]}>
                {(['trips','logbook'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabBtn, tab === t && { borderBottomColor: theme.accent, borderBottomWidth: 2.5 }]}
                    onPress={() => setTab(t)}
                  >
                    <Text style={[styles.tabText, { color: tab === t ? theme.accent : theme.textMuted }]}>
                      {t === 'trips' ? 'Trips' : 'Logbook'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tab === 'trips' ? renderTrips() : renderLogbook()}
            </>
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
  bio: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 8, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 28, marginTop: 16, marginBottom: 18 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  followBtn: { paddingHorizontal: 32, paddingVertical: 11, borderRadius: 22 },
  followBtnText: { fontSize: 15, fontWeight: '700' },

  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, marginBottom: 4 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },

  listWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },

  tripCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5 },
  tripPhoto: { width: '100%', height: 140 },
  tripBody: { padding: 14, gap: 4 },
  tripRoute: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  tripDate: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
  tripLegs: { gap: 6 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legDot: { width: 6, height: 6, borderRadius: 3 },
  legText: { flex: 1, fontSize: 13, fontWeight: '500' },
  legStatus: { fontSize: 11, fontWeight: '700' },

  flightCard: { borderRadius: 14, overflow: 'hidden' },
  flightRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  flightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flightInfo: { flex: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeCode: { fontSize: 15, fontWeight: '800' },
  flightMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  flightStatus: { fontSize: 12, fontWeight: '700' },
  photoStrip: { paddingHorizontal: 14, paddingBottom: 12 },
  photo: { width: 120, height: 90, borderRadius: 10 },

  locked: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40, gap: 12 },
  lockIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle: { fontSize: 18, fontWeight: '700' },
  lockedSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
