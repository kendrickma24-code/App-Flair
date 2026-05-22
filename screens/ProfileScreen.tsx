import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Image, Modal, Alert, Animated, Easing, PanResponder, Dimensions, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './ProfileNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { UserProfile } from '../App';
import SettingsScreen from './SettingsScreen';
import { getFollowCounts } from '../services/db';
import { supabase } from '../lib/supabase';
import FollowListModal from '../components/FollowListModal';
import GlobeView from '../components/GlobeView';
import TripCard from '../components/TripCard';
import TripViewerModal from '../components/TripViewerModal';
import { syncTripsForUser, inferHomeAirport } from '../services/tripGrouping';
import { getVisitedCountryIds, getVisitedStateCodes, getAirportInfo } from '../data/airports';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InsightDetailModal, { InsightKey } from '../components/InsightDetailModal';

// ── Achievement stat definitions ───────────────────────────────────────────
type StatKey = 'countries' | 'miles' | 'flights' | 'trips' | 'states';
const ALL_STAT_KEYS: StatKey[] = ['countries', 'miles', 'flights', 'trips', 'states'];
const STAT_META: Record<StatKey, { label: string; icon: string }> = {
  countries: { label: 'Countries',  icon: 'earth-outline' },
  miles:     { label: 'mi flown',   icon: 'speedometer-outline' },
  flights:   { label: 'Flights',    icon: 'airplane-outline' },
  trips:     { label: 'Trips',      icon: 'map-outline' },
  states:    { label: 'US States',  icon: 'flag-outline' },
};
const DEFAULT_STATS: StatKey[] = ['countries', 'miles', 'flights'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GLOBE_VERTICAL_OFFSET = 140;
const GLOBE_SCALE = 0.42;
const GLOBE_RADIUS = Math.min(SCREEN_W, SCREEN_H) * GLOBE_SCALE;
// Position the sheet top just below the globe's bottom edge
const PEEK_VISIBLE = Math.round(SCREEN_H / 2 + GLOBE_VERTICAL_OFFSET - GLOBE_RADIUS) + 20;
// Collapsed: only the drag handle + stats row visible
const STATS_VISIBLE = 110;

// ── Twinkling star field (same as onboarding) ──────────────────────
const STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: Math.random() * SCREEN_W,
  y: Math.random() * SCREEN_H * 0.75,
  size: Math.random() * 1.8 + 0.6,
  maxOpacity: Math.random() * 0.55 + 0.2,
  duration: Math.random() * 2800 + 1400,
  delay: Math.random() * 4000,
}));

function StarField() {
  const anims = useRef(STARS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    STARS.forEach((star, i) => {
      Animated.sequence([
        Animated.delay(star.delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anims[i], { toValue: star.maxOpacity, duration: star.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(anims[i], { toValue: 0.04, duration: star.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
      ]).start();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={{
            position: 'absolute', left: star.x, top: star.y,
            width: star.size, height: star.size, borderRadius: star.size / 2,
            backgroundColor: '#fff', opacity: anims[i],
            ...(star.size > 2 ? { shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } } : {}),
          }}
        />
      ))}
    </View>
  );
}

interface Props {
  theme: Theme;
  isDark: boolean;
  userProfile: UserProfile;
  flights: Flight[];
  deletedFlights: Flight[];
  onUpdateProfile: (profile: UserProfile) => void;
  onDeleteFlight: (id: string) => void;
  onChangeFlightPrivacy: (id: string, privacy: 'public' | 'followers' | 'private') => void;
  onEditFlight: (flightId: string, updates: import('../components/EditFlightModal').FlightEditUpdates) => void;
  onRestoreFlight: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onSignOut: () => void;
  onAddReturnFlight?: (flight: Flight) => void;
  onAddFlight?: () => void;
}

type Tab = 'trips' | 'logbook';

export default function ProfileScreen({
  theme, isDark, userProfile, flights, deletedFlights,
  onUpdateProfile, onDeleteFlight, onChangeFlightPrivacy, onEditFlight, onRestoreFlight, onPermanentDelete, onSignOut, onAddReturnFlight, onAddFlight,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const [tab, setTab] = useState<Tab>('trips');
  const [showSettings, setShowSettings] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedStats, setSelectedStats] = useState<StatKey[]>(DEFAULT_STATS);
  const [showStatPicker, setShowStatPicker] = useState(false);
  const [insightKey, setInsightKey] = useState<InsightKey | null>(null);
  const [tripViewerIndex, setTripViewerIndex] = useState<number | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  // Sheet geometry — recomputed each render but initial Animated.Value is correct
  // Stop the sheet below the profile row (avatar 56px + top offset 10px + padding 18px)
  const FULL_TOP = insets.top + 84;
  const SHEET_HEIGHT = SCREEN_H - FULL_TOP;
  const PEEK_OFFSET = SHEET_HEIGHT - PEEK_VISIBLE;
  const STATS_OFFSET = SHEET_HEIGHT - STATS_VISIBLE;
  const peekOffRef = useRef(PEEK_OFFSET);
  peekOffRef.current = PEEK_OFFSET;

  const sheetAnim = useRef(new Animated.Value(PEEK_OFFSET)).current;
  const sheetBaseRef = useRef(PEEK_OFFSET);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (userProfile.id) {
        getFollowCounts(userProfile.id).then(setFollowCounts).catch(() => {});
      }
    }, [userProfile.id])
  );

  // Real-time follower count — increments/decrements as follows change
  useEffect(() => {
    if (!userProfile.id) return;
    const channel = supabase
      .channel(`follows:${userProfile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'follows',
        filter: `following_id=eq.${userProfile.id}`,
      }, () => {
        getFollowCounts(userProfile.id).then(setFollowCounts).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile.id]);

  useEffect(() => {
    AsyncStorage.getItem(`profile_stats_${userProfile.id}`).then(raw => {
      if (raw) {
        try {
          const parsed = (JSON.parse(raw) as string[]).filter(k => ALL_STAT_KEYS.includes(k as StatKey)) as StatKey[];
          setSelectedStats(parsed.length > 0 ? parsed : DEFAULT_STATS);
        } catch {}
      }
    }).catch(() => {});
  }, [userProfile.id]);

  function saveSelectedStats(keys: StatKey[]) {
    setSelectedStats(keys);
    AsyncStorage.setItem(`profile_stats_${userProfile.id}`, JSON.stringify(keys)).catch(() => {});
  }

  const initials = (userProfile.name || userProfile.username || '?')[0]?.toUpperCase() ?? '?';

  // ── Globe data ─────────────────────────────────────────────────────
  const allCodes = useMemo(() => {
    const codes: string[] = [];
    for (const f of flights) codes.push(f.from.code, f.to.code);
    return codes;
  }, [flights]);

  const visitedCountryIds = useMemo(() => getVisitedCountryIds(allCodes), [allCodes]);
  const visitedStateCodes = useMemo(() => getVisitedStateCodes(allCodes), [allCodes]);
  const flightRoutes = useMemo(() =>
    flights.filter(f => f.status === 'past').map(f => ({ fromCode: f.from.code, toCode: f.to.code, flightId: f.id })),
    [flights]
  );

  const countriesCount = useMemo(() => {
    const ids = new Set(visitedCountryIds.filter(id => id !== '840'));
    if (visitedStateCodes.length > 0) ids.add('840');
    return ids.size;
  }, [visitedCountryIds, visitedStateCodes]);

  const totalMilesLabel = useMemo(() => {
    let mins = 0;
    for (const f of flights) {
      if (f.status !== 'past') continue;
      if (!f.duration) continue;
      const h = f.duration.match(/(\d+)h/);
      const m = f.duration.match(/(\d+)m/);
      mins += (h ? parseInt(h[1]) : 0) * 60 + (m ? parseInt(m[1]) : 0);
    }
    const miles = Math.round((mins / 60) * 550);
    if (miles === 0) return '0';
    if (miles >= 1000) return `${(miles / 1000).toFixed(1)}k`;
    return miles.toLocaleString();
  }, [flights]);

  // ── Trip grouping ──────────────────────────────────────────────────
  const homeAirport = useMemo(() => inferHomeAirport(flights), [flights]);
  const trips = useMemo(() => syncTripsForUser(flights, homeAirport), [flights, homeAirport]);

  // ── Stat value lookup ──────────────────────────────────────────────
  function getStatValue(key: StatKey): string {
    switch (key) {
      case 'countries': return String(countriesCount);
      case 'miles':     return totalMilesLabel;
      case 'flights':   return String(flights.length);
      case 'trips':     return String(trips.length);
      case 'states':    return String(visitedStateCodes.length);
    }
  }

  // ── Globe region tap ───────────────────────────────────────────────
  function handleGlobeRegionTap(name: string, id: string, isState: boolean) {
    const matching = flights.filter(f =>
      [f.from.code, f.to.code].some(code => {
        const info = getAirportInfo(code);
        if (!info) return false;
        return isState ? info.stateCode === id : info.countryId === id;
      })
    );
    if (matching.length === 0) return;
    const list = matching.slice(0, 5).map(f =>
      `• ${f.from.code} → ${f.to.code}${f.flightNum ? ` (${f.flightNum})` : ''} · ${f.date}`
    ).join('\n');
    Alert.alert(name, `${matching.length} flight${matching.length !== 1 ? 's' : ''}:\n\n${list}${matching.length > 5 ? `\n…and ${matching.length - 5} more` : ''}`);
  }

  // ── Route detail sheet (tapping a route arc on the globe) ──────────
  const [tappedFlightId, setTappedFlightId] = useState<string | null>(null);
  const tappedFlight = tappedFlightId ? flights.find(f => f.id === tappedFlightId) ?? null : null;
  const [routeSheetVisible, setRouteSheetVisible] = useState(false);
  const routeSheetY = useRef(new Animated.Value(320)).current;
  const routeSheetBase = useRef(0);

  function openRouteSheet(id: string) {
    setTappedFlightId(id);
    setRouteSheetVisible(true);
    routeSheetY.setValue(320);
    Animated.spring(routeSheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }

  function closeRouteSheet() {
    Animated.timing(routeSheetY, { toValue: 320, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => { setRouteSheetVisible(false); setTappedFlightId(null); });
  }

  const routeSheetPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      routeSheetY.stopAnimation(val => { routeSheetBase.current = val; });
    },
    onPanResponderMove: (_, g) => { if (g.dy > 0) routeSheetY.setValue(routeSheetBase.current + g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60 || g.vy > 0.5) closeRouteSheet();
      else Animated.spring(routeSheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
  })).current;

  // ── Main bottom sheet — three snap positions ───────────────────────
  // 0 = full open, PEEK_OFFSET = tabs visible, STATS_OFFSET = stats only
  const statsOffRef = useRef(STATS_OFFSET);
  statsOffRef.current = STATS_OFFSET;

  function snapSheet(target: number) {
    sheetBaseRef.current = target;
    setSheetOpen(target === 0);
    if (target !== 0) scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(sheetAnim, { toValue: target, useNativeDriver: true, bounciness: 3 }).start();
  }

  function openSheetFull() { snapSheet(0); }

  function snapToNearest(projected: number, vy: number) {
    const peek = peekOffRef.current;
    const stats = statsOffRef.current;
    const points = [0, peek, stats];
    // Fast swipe overrides: up → go one step higher, down → go one step lower
    if (vy < -0.5) {
      const higher = points.filter(p => p < sheetBaseRef.current);
      return higher.length ? Math.max(...higher) : 0;
    }
    if (vy > 0.5) {
      const lower = points.filter(p => p > sheetBaseRef.current);
      return lower.length ? Math.min(...lower) : stats;
    }
    // Nearest
    return points.reduce((best, p) => Math.abs(p - projected) < Math.abs(best - projected) ? p : best);
  }

  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      sheetAnim.stopAnimation(val => { sheetBaseRef.current = val; });
    },
    onPanResponderMove: (_, g) => {
      const next = Math.max(0, Math.min(statsOffRef.current, sheetBaseRef.current + g.dy));
      sheetAnim.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const projected = sheetBaseRef.current + g.dy;
      snapSheet(snapToNearest(projected, g.vy));
    },
  })).current;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {/* Dark blue gradient background — same as sign-in */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
      {/* Twinkling stars */}
      <StarField />

      {/* Globe — behind profile row */}
      <View style={StyleSheet.absoluteFill}>
        <GlobeView
          theme={theme}
          isDark={isDark}
          visitedCountryIds={visitedCountryIds}
          visitedStateCodes={visitedStateCodes}
          routes={flightRoutes}
          verticalOffset={isLandscape ? 0 : 120}
          scale={GLOBE_SCALE}
          onRegionTap={handleGlobeRegionTap}
          onRouteTap={openRouteSheet}
        />
      </View>

      {/* Profile row — left-justified at top */}
      <View style={[styles.profileOverlay, { top: insets.top + 10 }]}>
        {userProfile.avatarUri ? (
          <Image source={{ uri: userProfile.avatarUri }} style={styles.overlayAvatar} />
        ) : (
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.overlayAvatar}>
            <Text style={styles.overlayAvatarText}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={styles.overlayInfo}>
          <Text style={styles.overlayUsername} numberOfLines={1}>
            {userProfile.username ? `@${userProfile.username}` : 'Set a username'}
          </Text>
          {userProfile.name ? (
            <Text style={styles.overlayName} numberOfLines={1}>{userProfile.name}</Text>
          ) : null}
          <View style={styles.overlayFollowRow}>
            <TouchableOpacity onPress={() => setFollowList('followers')}>
              <Text style={styles.overlayFollowText}>
                <Text style={styles.overlayFollowNum}>{followCounts.followers}</Text>
                {' followers'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.overlayFollowDot}>·</Text>
            <TouchableOpacity onPress={() => setFollowList('following')}>
              <Text style={styles.overlayFollowText}>
                <Text style={styles.overlayFollowNum}>{followCounts.following}</Text>
                {' following'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Settings button — floating top-right */}
      <View style={[styles.floatingTopRight, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.floatingBtn} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            top: FULL_TOP,
            height: SHEET_HEIGHT,
            transform: [{ translateY: sheetAnim }],
          },
        ]}
      >
        <View style={styles.sheetInner}>
        {/* Glass layers */}
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.sheetGlassOverlay} />

        {/* Drag handle — only this area drives the pan gesture */}
        <View {...dragPan.panHandlers} style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]} />
        </View>

        {/* Stats row — fixed above tabs */}
        <View style={styles.statsRowWrap}>
          <View style={[styles.statsRow, { borderColor: 'rgba(255,255,255,0.10)' }]}>
            {selectedStats.filter(key => !!STAT_META[key]).map((key, i) => (
              <React.Fragment key={key}>
                {i > 0 && <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />}
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => setInsightKey(key as InsightKey)}
                  onLongPress={() => setShowStatPicker(true)}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statNum, { color: '#fff' }]}>{getStatValue(key)}</Text>
                  <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>{STAT_META[key].label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.statsHint}>Hold to customize</Text>
        </View>

        {/* Tab bar — fixed, center-justified */}
        <View style={[styles.tabs, { borderBottomColor: 'rgba(255,255,255,0.10)' }]}>
          {(['trips', 'logbook'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                styles.tabItem,
                tab === t && { borderBottomColor: theme.accent, borderBottomWidth: 2.5 },
              ]}
              onPress={() => setTab(t)}
            >
              <Ionicons
                name={t === 'trips'
                  ? (tab === t ? 'map' : 'map-outline')
                  : (tab === t ? 'list' : 'list-outline')}
                size={17}
                color={tab === t ? theme.accent : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.tabText, { color: tab === t ? theme.accent : 'rgba(255,255,255,0.45)' }]}>
                {t === 'trips' ? 'Trips' : 'Logbook'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scrollable content */}
        <ScrollView
          ref={scrollRef}
          scrollEnabled={true}
          onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Trips tab */}
          {tab === 'trips' && (
            <View style={styles.tripsContent}>
              {trips.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="map-outline" size={36} color="rgba(255,255,255,0.35)" />
                  <Text style={[styles.emptyText, { color: 'rgba(255,255,255,0.45)' }]}>No trips logged yet</Text>
                </View>
              ) : (
                trips.map((trip, i) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    theme={theme}
                    isDark={isDark}
                    onOpen={() => setTripViewerIndex(i)}
                    onDeleteTrip={() => trip.legs.forEach(leg => onDeleteFlight(leg.id))}
                    onChangePrivacy={privacy =>
                      trip.legs.forEach(leg => onChangeFlightPrivacy(leg.id, privacy))
                    }
                    onAddReturn={trip.legs.length === 1 && onAddReturnFlight
                      ? () => onAddReturnFlight(trip.legs[0])
                      : undefined}
                    onAddFlight={onAddFlight}
                    onEditFlight={onEditFlight}
                    onDeleteFlight={onDeleteFlight}
                  />
                ))
              )}
            </View>
          )}

          {/* Logbook tab */}
          {tab === 'logbook' && (
            <View style={styles.logbook}>
              {flights.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="book-outline" size={36} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No flights logged yet</Text>
                </View>
              ) : [...flights].sort((a, b) => {
                const toMs = (ddmmyyyy: string) => {
                  const p = ddmmyyyy.split('-');
                  return p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime() : 0;
                };
                return toMs(b.date) - toMs(a.date); // newest first
              }).map((f, i) => {
                const parts = f.date.split('-');
                const dateObj = parts.length === 3
                  ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
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
                        <Text style={[styles.logRoute, { color: theme.text }]}>{f.from.code} → {f.to.code}</Text>
                        <Text style={[styles.logMeta, { color: theme.textMuted }]}>
                          {[f.flightNum, f.duration].filter(Boolean).join(' · ')}
                        </Text>
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
                        <View style={[styles.logBadge, { backgroundColor: theme.pastBg }]}>
                          <Text style={[styles.logBadgeText, { color: theme.past }]}>PAST</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        </View>{/* end sheetInner */}
      </Animated.View>

      {/* Route detail sheet — shown when a route arc on the globe is tapped */}
      {routeSheetVisible && (
        <Animated.View style={[
          routeSheet.sheet,
          { backgroundColor: theme.card, borderColor: theme.sep },
          { transform: [{ translateY: routeSheetY }] },
        ]}>
          <View {...routeSheetPan.panHandlers} style={routeSheet.handleArea}>
            <View style={[routeSheet.handle, { backgroundColor: theme.sep }]} />
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={routeSheet.scrollContent}>
            {tappedFlight && (
              <>
                <View style={routeSheet.routeRow}>
                  <Text style={[routeSheet.code, { color: theme.text }]}>{tappedFlight.from.code}</Text>
                  <Ionicons name="airplane" size={18} color={theme.accent} style={{ marginHorizontal: 10 }} />
                  <Text style={[routeSheet.code, { color: theme.text }]}>{tappedFlight.to.code}</Text>
                </View>
                <Text style={[routeSheet.cities, { color: theme.textMuted }]}>
                  {tappedFlight.from.city} → {tappedFlight.to.city}
                </Text>
                <View style={[routeSheet.divider, { backgroundColor: theme.sep }]} />
                {[
                  { label: 'Flight', value: tappedFlight.flightNum },
                  { label: 'Date', value: tappedFlight.date },
                  { label: 'Duration', value: tappedFlight.duration },
                ].filter(r => r.value).map(r => (
                  <View key={r.label} style={routeSheet.infoRow}>
                    <Text style={[routeSheet.label, { color: theme.textMuted }]}>{r.label}</Text>
                    <Text style={[routeSheet.value, { color: theme.text }]}>{r.value}</Text>
                  </View>
                ))}
                {tappedFlight.note ? (
                  <Text style={[routeSheet.note, { color: theme.textMuted }]}>{tappedFlight.note}</Text>
                ) : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Trip viewer — full screen paged modal */}
      <TripViewerModal
        visible={tripViewerIndex !== null}
        trips={trips}
        initialIndex={tripViewerIndex ?? 0}
        theme={theme}
        isDark={isDark}
        currentUserId={userProfile.id}
        onEditFlight={onEditFlight}
        onDeleteFlight={onDeleteFlight}
        onAddFlight={onAddFlight}
        onDeleteTrip={_id => trips.find(t => t.id === _id)?.legs.forEach(l => onDeleteFlight(l.id))}
        onChangePrivacy={(_id, privacy) => trips.find(t => t.id === _id)?.legs.forEach(l => onChangeFlightPrivacy(l.id, privacy))}
        onClose={() => setTripViewerIndex(null)}
      />

      {/* Insight detail modal */}
      <InsightDetailModal
        visible={insightKey !== null}
        statKey={insightKey}
        flights={flights}
        trips={trips}
        theme={theme}
        isDark={isDark}
        onClose={() => setInsightKey(null)}
      />

      {/* Stat picker modal */}
      <Modal visible={showStatPicker} transparent animationType="fade" onRequestClose={() => setShowStatPicker(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setShowStatPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.pickerGlass} />
            <Text style={styles.pickerTitle}>Choose Stats to Display</Text>
            <Text style={styles.pickerSub}>Pick up to 3</Text>
            <View style={styles.pickerList}>
              {ALL_STAT_KEYS.map(key => {
                const selected = selectedStats.includes(key);
                const canAdd = selectedStats.length < 3;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.pickerItem, selected && { borderColor: theme.accent, backgroundColor: `${theme.accent}18` }]}
                    onPress={() => {
                      if (selected) {
                        saveSelectedStats(selectedStats.filter(k => k !== key));
                      } else if (canAdd) {
                        saveSelectedStats([...selectedStats, key]);
                      }
                    }}
                  >
                    <Ionicons
                      name={STAT_META[key].icon as any}
                      size={20}
                      color={selected ? theme.accent : 'rgba(255,255,255,0.5)'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemLabel, { color: selected ? '#fff' : 'rgba(255,255,255,0.7)' }]}>
                        {STAT_META[key].label}
                      </Text>
                      <Text style={styles.pickerItemValue}>{getStatValue(key)}</Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.pickerDoneBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowStatPicker(false)}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <FollowListModal
        visible={!!followList}
        type={followList ?? 'followers'}
        userId={userProfile.id}
        currentUserId={userProfile.id}
        theme={theme}
        isDark={isDark}
        onClose={() => setFollowList(null)}
      />

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SettingsScreen
          theme={theme}
          isDark={isDark}
          userProfile={userProfile}
          deletedFlights={deletedFlights}
          onUpdateProfile={profile => { onUpdateProfile(profile); setShowSettings(false); }}
          onRestoreFlight={onRestoreFlight}
          onPermanentDelete={onPermanentDelete}
          onClose={() => setShowSettings(false)}
          onSignOut={() => { setShowSettings(false); onSignOut(); }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f3460' },

  // Floating settings button
  floatingTopRight: { position: 'absolute', right: 16, zIndex: 10 },
  floatingBtn: {
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },

  // Stats row (inside sheet)
  statsRowWrap: { marginHorizontal: 16, marginBottom: 14 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 0.5, borderRadius: 16, paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 0.5, height: 28 },
  statsHint: { textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 6, letterSpacing: 0.2 },

  // Stat picker modal
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
  },
  pickerGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.75)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 2 },
  pickerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 18 },
  pickerList: { gap: 10 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)', padding: 14,
  },
  pickerItemLabel: { fontSize: 15, fontWeight: '600' },
  pickerItemValue: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  pickerDoneBtn: { marginTop: 20, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  pickerDoneText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Bottom sheet — glass
  sheet: {
    position: 'absolute', left: 0, right: 0,
    // overflow and borderRadius moved to sheetInner so native-driver translateY
    // doesn't break touch hit-testing (overflow:hidden on Animated.View + useNativeDriver
    // causes touch area to not follow the visual transform position)
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 32, shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  sheetInner: {
    flex: 1,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.55)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  handleArea: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2 },

  // Profile overlay — horizontal row at top-left
  profileOverlay: {
    position: 'absolute', left: 20, right: 60,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  overlayAvatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  overlayAvatarText: { fontSize: 22, color: '#fff', fontWeight: '700' },
  overlayInfo: { flex: 1 },
  overlayUsername: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  overlayName: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  overlayFollowRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  overlayFollowText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  overlayFollowNum: { fontSize: 12, fontWeight: '700', color: '#fff' },
  overlayFollowDot: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginHorizontal: 5 },

  // Tabs
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, justifyContent: 'center' },
  tabItem: {
    paddingVertical: 10, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
    flexDirection: 'row', gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Trips
  tripsContent: { paddingTop: 12, paddingHorizontal: 16 },
  emptyTab: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22 },

  // Logbook
  logbook: { paddingHorizontal: 20, paddingTop: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  logDate: { width: 44, alignItems: 'flex-start' },
  logMon: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, lineHeight: 13 },
  logDay: { fontSize: 28, fontWeight: '800', letterSpacing: -1, lineHeight: 30 },
  logInfo: { flex: 1, paddingLeft: 4 },
  logRoute: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  logMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  logDivider: { height: 0.5 },
  logBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  logBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  logLiveDot: { width: 6, height: 6, borderRadius: 3 },
});

const routeSheet = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 80, left: 12, right: 12, height: 260,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  scrollContent: { paddingBottom: 20 },
  handleArea: { paddingVertical: 10, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  cities: { textAlign: 'center', fontSize: 13, marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
  note: { marginTop: 12, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
});
