import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { getAirportInfo } from '../data/airports';
import TripDetailCard from '../components/TripDetailCard';

const { width: W } = Dimensions.get('window');
const HERO_H = Math.round(W * 0.9);
const COLS = 3;
const GAP = 3;
const SIDE_PAD = 20;
const PHOTO_TILE = (W - SIDE_PAD * 2 - GAP * (COLS - 1)) / COLS;

interface Props {
  toCode: string;
  toCity: string;
  flights: Flight[];
  theme: Theme;
  isDark: boolean;
  currentUserName: string;
  currentUserInitials: string;
  isOwn?: boolean;
  onClose: () => void;
  onDeleteFlight: (id: string) => void;
  onEditFlight: (id: string, updates: import('../components/EditFlightModal').FlightEditUpdates) => void;
}

function parseDate(d: string) {
  const p = d.split('-');
  if (p.length !== 3) return 0;
  return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
}

export default function DestinationDetailScreen({
  toCode, toCity, flights, theme, isDark,
  currentUserName, currentUserInitials, isOwn,
  onClose, onDeleteFlight, onEditFlight,
}: Props) {
  const [showTrips, setShowTrips] = useState(false);
  const [coverIndex, setCoverIndex] = useState(0);

  const airportInfo = getAirportInfo(toCode);
  const regionLabel = airportInfo?.stateCode
    ? airportInfo.stateName || airportInfo.stateCode
    : airportInfo?.countryName || '';

  // Photos grouped by month, newest first — each photo tagged with its flight date
  const photosByMonth = useMemo(() => {
    // Build flat list of {uri, ts} from all flights (flights already sorted newest-first)
    const tagged: { uri: string; ts: number }[] = [];
    for (const f of flights) {
      const d = new Date(f.date);
      const ts = isNaN(d.getTime()) ? 0 : d.getTime();
      for (const uri of f.photos) {
        if (uri) tagged.push({ uri, ts });
      }
    }

    // Group by "Month YYYY" key
    const map = new Map<string, { label: string; ts: number; photos: string[] }>();
    for (const { uri, ts } of tagged) {
      const d = new Date(ts);
      const key = ts === 0
        ? 'Unknown'
        : `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
      if (!map.has(key)) map.set(key, { label: key, ts, photos: [] });
      map.get(key)!.photos.push(uri);
    }

    // Sort groups newest-first
    return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
  }, [flights]);

  const allPhotos = useMemo(() =>
    flights.flatMap(f => f.photos).filter(Boolean),
    [flights]
  );

  const coverPhoto = allPhotos[coverIndex] ?? null;

  // Latest flight date (already sorted newest-first)
  const latestDate = flights[0]?.date ?? '';

  // Route breakdown: group by from.code, sort by count desc
  const routes = useMemo(() => {
    const map = new Map<string, { fromCode: string; fromCity: string; count: number }>();
    for (const f of flights) {
      const key = f.from.code;
      if (!map.has(key)) map.set(key, { fromCode: key, fromCity: f.from.city, count: 0 });
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [flights]);

  const maxRouteCount = routes[0]?.count ?? 1;

  // Accent bar color matching the screenshot purple
  const BAR_COLOR = '#6B5BFF';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#1a1a2e', '#16213e', '#533483']}
              style={styles.heroImg}
            />
          )}

          {/* Dark gradient overlay at bottom */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
            style={styles.heroGradient}
          />

          {/* Top controls */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={onClose}>
              <View style={styles.heroBtn}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            {allPhotos.length > 1 && (
              <TouchableOpacity onPress={() => setCoverIndex(i => (i + 1) % allPhotos.length)}>
                <View style={styles.heroBtn}>
                  <Ionicons name="image-outline" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Hero text */}
          <View style={styles.heroBottom}>
            <Text style={styles.heroCode}>
              {airportInfo?.stateCode ?? airportInfo?.countryName ?? toCity}
            </Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>AIRPORT</Text>
                <Text style={styles.statValue}>{toCode}</Text>
              </View>
              <View style={[styles.statDivider]} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>TRIPS</Text>
                <Text style={styles.statValue}>{flights.length}</Text>
              </View>
              <View style={[styles.statDivider]} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>LATEST</Text>
                <Text style={styles.statValue}>{latestDate}</Text>
              </View>
              <View style={[styles.statDivider]} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>ROUTES</Text>
                <Text style={styles.statValue}>{routes.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Achievement card ── */}
        <View style={[styles.achievement, { backgroundColor: theme.card }]}>
          <LinearGradient colors={['#6B5BFF', '#9B5CE8']} style={styles.achieveBadge}>
            <Text style={styles.achieveNum}>{flights.length}</Text>
            <Ionicons name="airplane" size={10} color="rgba(255,255,255,0.7)" />
          </LinearGradient>

          <View style={styles.achieveText}>
            <Text style={[styles.achieveTitle, { color: theme.text }]}>
              You've been here {flights.length} {flights.length === 1 ? 'time' : 'times'}
            </Text>
            <Text style={[styles.achieveSub, { color: theme.textMuted }]}>
              Latest: {latestDate}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.viewTripsBtn, { borderColor: theme.accent }]}
            onPress={() => setShowTrips(v => !v)}
          >
            <Text style={[styles.viewTripsBtnText, { color: theme.accent }]}>
              {showTrips ? 'Hide' : 'View trips'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Most flown routes ── */}
        {routes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              MOST FLOWN ROUTES INTO {toCode}
            </Text>
            {routes.slice(0, 5).map(r => (
              <View key={r.fromCode} style={styles.routeRow}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{r.fromCode}</Text>
                <Ionicons name="arrow-forward" size={11} color={theme.textMuted} style={{ marginHorizontal: 4 }} />
                <Text style={[styles.routeCode, { color: theme.textMuted }]}>{toCode}</Text>
                <View style={styles.routeBarWrap}>
                  <View style={[styles.routeBarBg, { backgroundColor: theme.surface }]}>
                    <View
                      style={[
                        styles.routeBarFill,
                        { backgroundColor: BAR_COLOR, width: `${(r.count / maxRouteCount) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.routeCount, { color: theme.textMuted }]}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Photos by month ── */}
        {photosByMonth.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PHOTOS</Text>
            {photosByMonth.map(group => (
              <View key={group.label} style={styles.monthGroup}>
                <Text style={[styles.monthHeader, { color: theme.text }]}>{group.label}</Text>
                <View style={styles.photoGrid}>
                  {group.photos.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={styles.photoTile}>
                      <Image source={{ uri }} style={styles.photoTileImg} resizeMode="cover" />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Individual trips (toggled) ── */}
        {showTrips && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ALL TRIPS</Text>
            {flights.map(f => (
              <TripDetailCard
                key={f.id}
                flight={f}
                theme={theme}
                isDark={isDark}
                isOwn={isOwn}
                currentUserName={currentUserName}
                currentUserInitials={currentUserInitials}
                onDelete={() => onDeleteFlight(f.id)}
                onEdit={updates => onEditFlight(f.id, updates)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Hero
  hero: { width: W, height: HERO_H, position: 'relative' },
  heroImg: { width: W, height: HERO_H, position: 'absolute' },
  heroGradient: {
    position: 'absolute', left: 0, right: 0,
    bottom: 0, height: HERO_H * 0.65,
  },
  heroTopRow: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14,
  },
  heroBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 22,
  },
  regionTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
    alignSelf: 'flex-start', borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  regionDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80',
  },
  regionText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3,
  },
  heroCode: {
    color: '#fff', fontSize: 64, fontWeight: '900', letterSpacing: -2, lineHeight: 68,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.38)',
    paddingVertical: 10, paddingHorizontal: 4,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: {
    color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3,
  },
  statValue: {
    color: '#fff', fontSize: 12, fontWeight: '700',
  },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Achievement
  achievement: {
    margin: 16, borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  achieveBadge: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  achieveNum: { color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 20 },
  achieveText: { flex: 1 },
  achieveTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  achieveSub: { fontSize: 12, fontWeight: '500' },
  viewTripsBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  viewTripsBtnText: { fontSize: 12, fontWeight: '700' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 14,
  },

  // Routes
  routeRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  routeCode: { fontSize: 13, fontWeight: '700', minWidth: 36 },
  routeBarWrap: { flex: 1, marginHorizontal: 10 },
  routeBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  routeBarFill: { height: 6, borderRadius: 3 },
  routeCount: { fontSize: 12, fontWeight: '600', minWidth: 24, textAlign: 'right' },

  // Photo grid — 3-col, Apple Photos month style
  monthGroup: { marginBottom: 24 },
  monthHeader: {
    fontSize: 22, fontWeight: '700', letterSpacing: -0.5,
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
  },
  photoTile: {
    width: PHOTO_TILE, height: PHOTO_TILE, borderRadius: 6, overflow: 'hidden',
    backgroundColor: '#ccc',
  },
  photoTileImg: { width: PHOTO_TILE, height: PHOTO_TILE },
});
