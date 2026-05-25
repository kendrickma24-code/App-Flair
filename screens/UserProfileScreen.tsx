import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { SearchUser, sendFollowRequest, unfollowUser, getFollowCounts } from '../services/db';
import { supabase } from '../lib/supabase';
import FollowListModal from '../components/FollowListModal';
import { userProfileStore } from './userProfileStore';

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
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
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
    return {
      id: `trip_${i}`,
      legs,
      startDate: legs[0].date,
      endDate: legs[legs.length - 1].date,
      route: codes.join(' › '),
      photos: legs.flatMap(l => l.photos),
    };
  });
}

export default function UserProfileScreen({ theme, isDark, currentUserId }: Props) {
  const navigation = useNavigation();
  const user = userProfileStore.get();

  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState<SearchUser['followStatus']>('none');
  const [bio, setBio] = useState('');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
  const [tab, setTab] = useState<'trips' | 'logbook'>('trips');

  useEffect(() => {
    if (!user) return;
    setTab('trips');
    setBio('');
    setFlights([]);
    setFollowCounts({ followers: 0, following: 0 });

    supabase.from('profiles').select('bio').eq('id', user.id).single()
      .then(({ data }) => setBio(data?.bio ?? ''))
      .catch(() => {});

    getFollowCounts(user.id).then(setFollowCounts).catch(() => {});

    supabase
      .from('follows')
      .select('status')
      .eq('follower_id', currentUserId)
      .eq('following_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const status: SearchUser['followStatus'] =
          data?.status === 'accepted' ? 'accepted'
          : data?.status === 'pending' ? 'pending'
          : 'none';
        setFollowStatus(status);
        loadFlights(status);
      })
      .catch(() => {
        setFollowStatus(user.followStatus);
        loadFlights(user.followStatus);
      });
  }, [user?.id]);

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
        {trips.map(trip => {
          const allPhotos = trip.photos;
          const stops = [
            { code: trip.legs[0].fromCode, city: trip.legs[0].fromCity, legAfter: trip.legs[0], isFirst: true },
            ...trip.legs.map((leg, i) => ({
              code: leg.toCode,
              city: leg.toCity,
              legAfter: trip.legs[i + 1] ?? null,
              isFirst: false,
            })),
          ];
          const isRoundTrip = trip.legs.length > 1 &&
            trip.legs[0].fromCode === trip.legs[trip.legs.length - 1].toCode;

          return (
            <View key={trip.id} style={[styles.tripCard, { backgroundColor: theme.card, borderColor: theme.sep }]}>
              {/* Header */}
              <View style={styles.tripHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tripTitle, { color: theme.text }]} numberOfLines={1}>
                    {trip.legs[trip.legs.length - 1].toCity || trip.legs[trip.legs.length - 1].toCode}
                  </Text>
                  <Text style={[styles.tripDateRange, { color: theme.textMuted }]}>
                    {formatDate(trip.startDate)}{trip.startDate !== trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''}
                  </Text>
                </View>
                <View style={[styles.tripTypePill, { backgroundColor: theme.accentBg }]}>
                  <Ionicons
                    name={isRoundTrip ? 'repeat-outline' : trip.legs.length > 1 ? 'shuffle-outline' : 'arrow-forward-outline'}
                    size={10} color={theme.accent}
                  />
                  <Text style={[styles.tripTypePillText, { color: theme.accent }]}>
                    {isRoundTrip ? 'Round trip' : trip.legs.length > 1 ? 'Multi-city' : 'One way'}
                  </Text>
                </View>
              </View>

              {/* Breadcrumb */}
              <View style={styles.tripBreadcrumb}>
                {[trip.legs[0].fromCode, ...trip.legs.map(l => l.toCode)].map((code, ci, arr) => (
                  <React.Fragment key={ci}>
                    {ci > 0 && <Ionicons name="arrow-forward" size={10} color={theme.textMuted} style={{ marginTop: 1 }} />}
                    <Text style={[styles.tripBreadcrumbCode, { color: theme.textMuted }]}>{code}</Text>
                  </React.Fragment>
                ))}
                <Text style={[styles.tripLegCount, { color: theme.textMuted }]}>
                  {'  ·  '}{trip.legs.length} {trip.legs.length === 1 ? 'flight' : 'flights'}
                </Text>
              </View>

              <View style={[styles.tripDivider, { backgroundColor: theme.sep }]} />

              {/* Photos */}
              {allPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={styles.tripPhotoStrip} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
                  {allPhotos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.tripPhotoThumb} resizeMode="cover" />
                  ))}
                </ScrollView>
              )}

              {allPhotos.length > 0 && <View style={[styles.tripDivider, { backgroundColor: theme.sep }]} />}

              {/* Timeline */}
              <View style={styles.tripTimeline}>
                {stops.map((stop, si) => {
                  const isLast = si === stops.length - 1;
                  const isEndpoint = stop.isFirst || (isLast && isRoundTrip);
                  return (
                    <View key={si} style={styles.stopRow}>
                      <View style={styles.railCol}>
                        <View style={[styles.stopDot, isEndpoint
                          ? { backgroundColor: theme.accent }
                          : { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.accent }
                        ]} />
                        {!isLast && <View style={[styles.railLine, { backgroundColor: theme.sep }]} />}
                      </View>
                      <View style={[styles.stopContent, isLast && { paddingBottom: 0 }]}>
                        <Text style={[styles.stopCode, { color: theme.text }]}>{stop.code}</Text>
                        {stop.city ? <Text style={[styles.stopCity, { color: theme.textMuted }]}>{stop.city}</Text> : null}
                        {stop.legAfter && (
                          <View style={styles.flightRowInner}>
                            <Ionicons name="airplane-outline" size={11} color={theme.textMuted} style={{ marginTop: 1 }} />
                            {stop.legAfter.flightNum ? (
                              <Text style={[styles.flightNumText, { color: theme.textSub }]}>{stop.legAfter.flightNum}</Text>
                            ) : null}
                            <Text style={[styles.flightDateText, { color: theme.textMuted }]}>
                              {(() => { const p = stop.legAfter.date.split('-'); return p.length === 3 ? `${p[1]}-${p[0]}` : stop.legAfter.date; })()}
                            </Text>
                            {stop.legAfter.status === 'live' ? (
                              <View style={[styles.logBadge, { backgroundColor: theme.liveBg }]}>
                                <Text style={[styles.logBadgeText, { color: theme.live }]}>LIVE</Text>
                              </View>
                            ) : stop.legAfter.status === 'upcoming' ? (
                              <View style={[styles.logBadge, { backgroundColor: theme.upcomingBg }]}>
                                <Text style={[styles.logBadgeText, { color: theme.upcoming }]}>UPCOMING</Text>
                              </View>
                            ) : null}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={{ height: 6 }} />
            </View>
          );
        })}
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
    const sorted = [...flights].sort((a, b) => parseDate(b.date) - parseDate(a.date));
    return (
      <View style={styles.logbook}>
        {sorted.map((f, i) => {
          const p = f.date.split('-');
          const dateObj = p.length === 3
            ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
            : null;
          const mon = dateObj ? dateObj.toLocaleString('default', { month: 'short' }).toUpperCase() : '';
          const day = dateObj ? dateObj.getDate() : '';
          return (
            <View key={f.id}>
              {i > 0 && <View style={[styles.logDivider, { backgroundColor: theme.sep }]} />}
              <View style={styles.logRow}>
                <View style={styles.logDate}>
                  <Text style={[styles.logMon, { color: theme.textMuted }]}>{mon}</Text>
                  <Text style={[styles.logDay, { color: theme.text }]}>{day}</Text>
                </View>
                <View style={styles.logInfo}>
                  <Text style={[styles.logRoute, { color: theme.text }]}>{f.fromCode} → {f.toCode}</Text>
                  {f.flightNum ? (
                    <Text style={[styles.logMeta, { color: theme.textMuted }]}>{f.flightNum}</Text>
                  ) : null}
                </View>
                {f.status === 'live' ? (
                  <View style={[styles.logBadge, { backgroundColor: theme.liveBg }]}>
                    <View style={[styles.logLiveDot, { backgroundColor: theme.live }]} />
                    <Text style={[styles.logBadgeText, { color: theme.live }]}>LIVE</Text>
                  </View>
                ) : f.status === 'upcoming' ? (
                  <View style={[styles.logBadge, { backgroundColor: theme.upcomingBg }]}>
                    <Text style={[styles.logBadgeText, { color: theme.upcoming }]}>UPCOMING</Text>
                  </View>
                ) : (
                  <View style={[styles.logBadge, { backgroundColor: theme.pastBg ?? theme.surface }]}>
                    <Text style={[styles.logBadgeText, { color: theme.past }]}>PAST</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: theme.sep }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>@{user.username}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
            <View style={[styles.tabRow, { borderBottomColor: theme.sep }]}>
              {(['trips', 'logbook'] as const).map(t => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, alignItems: 'flex-start', paddingLeft: 4 },
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

  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, marginBottom: 4, marginTop: 20 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },

  listWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },

  // ── Trip card (matches TripCard style) ──
  tripCard: {
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  tripHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 10 },
  tripTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 23 },
  tripDateRange: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  tripTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, marginTop: 2 },
  tripTypePillText: { fontSize: 10, fontWeight: '700' },
  tripBreadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8 },
  tripBreadcrumbCode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  tripLegCount: { fontSize: 11, fontWeight: '500' },
  tripDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  tripPhotoStrip: { maxHeight: 110 },
  tripPhotoThumb: { width: 96, height: 80, borderRadius: 10 },
  tripTimeline: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  stopRow: { flexDirection: 'row' },
  railCol: { width: 20, alignItems: 'center' },
  stopDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  railLine: { width: 2, flex: 1, minHeight: 24, marginTop: 3 },
  stopContent: { flex: 1, paddingLeft: 10, paddingBottom: 8 },
  stopCode: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, lineHeight: 21 },
  stopCity: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  flightRowInner: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  flightNumText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  flightDateText: { fontSize: 11, fontWeight: '500', flex: 1 },

  // ── Logbook (matches ProfileScreen style) ──
  logbook: { paddingHorizontal: 20, paddingTop: 8 },
  logDivider: { height: StyleSheet.hairlineWidth },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  logDate: { alignItems: 'center', width: 32 },
  logMon: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  logDay: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  logInfo: { flex: 1 },
  logRoute: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  logMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  logBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  logLiveDot: { width: 5, height: 5, borderRadius: 3 },
  logBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  locked: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40, gap: 12 },
  lockIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle: { fontSize: 18, fontWeight: '700' },
  lockedSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
