import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity,
  Image, ScrollView, Dimensions, StatusBar,
  ListRenderItemInfo, Animated, Easing, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Trip } from '../services/tripGrouping';
import { Flight } from '../data/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EditFlightModal from './EditFlightModal';
import TripActionSheet from './TripActionSheet';

const { width: W } = Dimensions.get('window');

type TripType = 'roundtrip' | 'oneway' | 'multicity';

// ── Helpers ────────────────────────────────────────────────────────────────
function parseDDMMYYYY(d: string): Date | null {
  const p = d.split('-');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}
function fmtShort(s: string): string {
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[1]}-${p[0]}`;
}
function fmtFull(s: string): string {
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[1]}-${p[0]}-${p[2].slice(-2)}`;
}
function fmtRange(start: string, end: string | null): string {
  if (!end) return `${fmtShort(start)} – ongoing`;
  const s = parseDDMMYYYY(start), e = parseDDMMYYYY(end);
  const sameYear = s && e && s.getFullYear() === e.getFullYear();
  return sameYear
    ? `${fmtShort(start)} – ${fmtShort(end)}`
    : `${fmtShort(start)} – ${fmtFull(end)}`;
}
function stayDays(d1: string, d2: string): number {
  const a = parseDDMMYYYY(d1), b = parseDDMMYYYY(d2);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}
function detectType(trip: Trip): TripType {
  if (trip.legs.length === 1) return 'oneway';
  const first = trip.legs[0].from.code.toUpperCase();
  const last  = trip.legs[trip.legs.length - 1].to.code.toUpperCase();
  return first === last ? 'roundtrip' : 'multicity';
}
function typeLabel(t: TripType): string {
  return t === 'roundtrip' ? 'Round trip' : t === 'oneway' ? 'One way' : 'Multi-city';
}
function typeIcon(t: TripType): 'repeat-outline' | 'arrow-forward-outline' | 'shuffle-outline' {
  if (t === 'roundtrip') return 'repeat-outline';
  if (t === 'oneway') return 'arrow-forward-outline';
  return 'shuffle-outline';
}

// ── Type pill ──────────────────────────────────────────────────────────────
function TypePill({ type, theme }: { type: TripType; theme: Theme }) {
  return (
    <View style={[tp.wrap, { backgroundColor: theme.accentBg }]}>
      <Ionicons name={typeIcon(type)} size={10} color={theme.accent} />
      <Text style={[tp.text, { color: theme.accent }]}>{typeLabel(type)}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 10, fontWeight: '700' },
});

// ── Status badge — uppercase, matches TripCard ────────────────────────────
function StatusBadge({ status, theme, pulse }: { status: string; theme: Theme; pulse: Animated.Value }) {
  if (status === 'live') {
    return (
      <View style={[sb.wrap, { backgroundColor: theme.liveBg }]}>
        <Animated.View style={[sb.dot, { backgroundColor: theme.live, opacity: pulse }]} />
        <Text style={[sb.text, { color: theme.live }]}>LIVE</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={[sb.wrap, { backgroundColor: theme.upcomingBg }]}>
        <Text style={[sb.text, { color: theme.upcoming }]}>UPCOMING</Text>
      </View>
    );
  }
  return null;
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});

// ── Full-width photo pager (snaps correctly) ───────────────────────────────
function LegPhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
      >
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={{ width: W, height: W * 0.72 }} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={pc.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[pc.dot, { backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.45)' }]} />
          ))}
        </View>
      )}
    </View>
  );
}
const pc = StyleSheet.create({
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
});

// ── Trip post ──────────────────────────────────────────────────────────────
function TripPost({
  trip, theme, isDark, onEditFlight, onDeleteFlight, onAddFlight, onDeleteTrip, onChangePrivacy,
}: {
  trip: Trip; theme: Theme; isDark?: boolean;
  onEditFlight?:   (flightId: string, updates: import('./EditFlightModal').FlightEditUpdates) => void;
  onDeleteFlight?: (flightId: string) => void;
  onAddFlight?:    () => void;
  onDeleteTrip?:   () => void;
  onChangePrivacy?:(privacy: 'public' | 'followers' | 'private') => void;
}) {
  const [editing, setEditing]       = useState<Flight | null>(null);
  const [tripName, setTripName]     = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput]   = useState('');
  const [sheetOpen, setSheetOpen]   = useState(false);
  const nameRef = useRef<TextInput>(null);
  const pulse   = useRef(new Animated.Value(1)).current;

  const type    = detectType(trip);
  const hasLive = trip.legs.some(l => l.status === 'live');

  const stops = [
    {
      code:     trip.legs[0].from.code,
      city:     trip.legs[0].from.city ?? '',
      legAfter: trip.legs[0],
      stay:     0,
      photos:   [] as string[],
      isFirst:  true,
    },
    ...trip.legs.map((leg, i) => ({
      code:     leg.to.code,
      city:     leg.to.city ?? '',
      legAfter: trip.legs[i + 1] ?? null,
      stay:     i < trip.legs.length - 1 ? stayDays(leg.date, trip.legs[i + 1].date) : 0,
      photos:   leg.photos ?? [],
      isFirst:  false,
    })),
  ];

  useEffect(() => {
    if (!hasLive) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [hasLive]);

  useEffect(() => {
    async function load() {
      try {
        const v = await AsyncStorage.getItem(`trip_name_${trip.id}`);
        if (v) { setTripName(v); return; }
        for (const leg of trip.legs) {
          const u = await AsyncStorage.getItem(`trip_name_trip_${leg.id}`);
          if (u) { setTripName(u); return; }
        }
      } catch {}
    }
    load();
  }, [trip.id]);

  const displayTitle = tripName
    || trip.primaryDestinationCity
    || trip.primaryDestination
    || trip.airportSequence.join(' – ');

  function commitRename() {
    const t = nameInput.trim();
    setTripName(t);
    setIsRenaming(false);
    if (t) AsyncStorage.setItem(`trip_name_${trip.id}`, t).catch(() => {});
    else   AsyncStorage.removeItem(`trip_name_${trip.id}`).catch(() => {});
  }

  return (
    <View style={[s.post, { backgroundColor: theme.card, borderColor: theme.sep }]}>

      {/* ── Trip header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          {isRenaming ? (
            <TextInput
              ref={nameRef}
              style={[s.title, { color: theme.text, padding: 0 }]}
              value={nameInput}
              onChangeText={setNameInput}
              onSubmitEditing={commitRename}
              onBlur={commitRename}
              placeholder={trip.primaryDestinationCity || '—'}
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
              selectionColor={theme.accent}
              autoCapitalize="words"
            />
          ) : (
            <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{displayTitle}</Text>
          )}
          <View style={s.headerMeta}>
            <Text style={[s.dateRange, { color: theme.textMuted }]}>{fmtRange(trip.departedAt, trip.returnedAt)}</Text>
            <TypePill type={type} theme={theme} />
          </View>
        </View>
        {isRenaming ? (
          <TouchableOpacity onPress={commitRename} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <View style={[s.menuBtn, { backgroundColor: theme.accentBg }]}>
              <Ionicons name="checkmark" size={15} color={theme.accent} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <View style={[s.menuBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="ellipsis-horizontal" size={15} color={theme.textMuted} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Breadcrumb ── */}
      <View style={s.breadcrumb}>
        {trip.airportSequence?.map((code, ci) => (
          <React.Fragment key={ci}>
            {ci > 0 && <Ionicons name="arrow-forward" size={10} color={theme.textMuted} style={{ marginTop: 1 }} />}
            <Text style={[s.breadcrumbCode, { color: theme.textMuted }]}>{code}</Text>
          </React.Fragment>
        ))}
        <Text style={[s.legCount, { color: theme.textMuted }]}>
          {'  ·  '}{trip.legs.length} {trip.legs.length === 1 ? 'flight' : 'flights'}
        </Text>
      </View>

      {/* ── Individual flights (FlightDetailModal style) ── */}
      {trip.legs.map((leg, li) => (
        <View key={leg.id}>
          <View style={[s.divider, { backgroundColor: theme.sep }]} />

          {/* Photos for this flight */}
          <LegPhotoCarousel photos={leg.photos ?? []} />

          {/* Flight info */}
          <View style={s.legInfo}>
            <View style={s.routeRow}>
              <Text style={[s.routeCode, { color: theme.text }]}>{leg.from.code}</Text>
              <View style={s.routeLine}>
                <View style={[s.routeDash, { backgroundColor: theme.sep }]} />
                <Ionicons name="airplane" size={16} color={theme.accent} />
                <View style={[s.routeDash, { backgroundColor: theme.sep }]} />
              </View>
              <Text style={[s.routeCode, { color: theme.text }]}>{leg.to.code}</Text>
            </View>
            {(leg.from.city || leg.to.city) && (
              <View style={s.cityRow}>
                <Text style={[s.cityText, { color: theme.textMuted }]}>{leg.from.city ?? ''}</Text>
                <Text style={[s.cityText, { color: theme.textMuted }]}>{leg.to.city ?? ''}</Text>
              </View>
            )}
            <View style={s.metaRow}>
              {leg.flightNum ? <Text style={[s.metaText, { color: theme.textSub }]}>{leg.flightNum}</Text> : null}
              {leg.flightNum ? <View style={[s.metaDot, { backgroundColor: theme.textMuted }]} /> : null}
              <Text style={[s.metaText, { color: theme.textMuted }]}>{fmtShort(leg.date)}</Text>
              {leg.duration ? (
                <>
                  <View style={[s.metaDot, { backgroundColor: theme.textMuted }]} />
                  <Text style={[s.metaText, { color: theme.textMuted }]}>{leg.duration}</Text>
                </>
              ) : null}
              <StatusBadge status={leg.status} theme={theme} pulse={pulse} />
            </View>
            {leg.note ? <Text style={[s.note, { color: theme.textSub }]}>{leg.note}</Text> : null}
          </View>
        </View>
      ))}

      <TripActionSheet
        visible={sheetOpen}
        trip={trip}
        theme={theme}
        isDark={isDark}
        onClose={() => setSheetOpen(false)}
        onRename={() => {
          setNameInput(tripName);
          setIsRenaming(true);
          setTimeout(() => nameRef.current?.focus(), 80);
        }}
        onAddFlight={onAddFlight}
        onEditLeg={leg => setEditing(leg)}
        onDeleteLeg={leg => onDeleteFlight?.(leg.id)}
        onChangePrivacy={onChangePrivacy}
        onDeleteTrip={onDeleteTrip}
      />

      {editing && (
        <EditFlightModal
          flight={editing}
          visible
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={updates => { onEditFlight?.(editing.id, updates); setEditing(null); }}
        />
      )}
    </View>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  trips: Trip[];
  initialIndex: number;
  theme: Theme;
  isDark?: boolean;
  currentUserId?: string;
  onEditFlight?:   (flightId: string, updates: import('./EditFlightModal').FlightEditUpdates) => void;
  onDeleteFlight?: (flightId: string) => void;
  onAddFlight?:    () => void;
  onDeleteTrip?:   (tripId: string) => void;
  onChangePrivacy?:(tripId: string, privacy: 'public' | 'followers' | 'private') => void;
  onClose: () => void;
}

export default function TripViewerModal({
  visible, trips, initialIndex, theme, isDark,
  currentUserId,
  onEditFlight, onDeleteFlight, onAddFlight, onDeleteTrip, onChangePrivacy, onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[s.safe, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Drag handle */}
        <View style={s.handleRow}>
          <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }]} />
        </View>

        {/* Top bar */}
        <View style={[s.topBar, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={[s.closeBtn, { backgroundColor: theme.surface }]}>
            <Ionicons name="chevron-down" size={17} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.topBarLabel, { color: theme.textMuted }]}>
            {trips.length === 1 ? '' : `${trips.length} trips`}
          </Text>
          <View style={s.closeBtn} />
        </View>

        <FlatList
          data={trips}
          keyExtractor={t => t.id}
          renderItem={({ item }: ListRenderItemInfo<Trip>) => (
            <TripPost
              trip={item}
              theme={theme}
              isDark={isDark}
              onEditFlight={onEditFlight}
              onDeleteFlight={onDeleteFlight}
              onAddFlight={onAddFlight}
              onDeleteTrip={onDeleteTrip ? () => onDeleteTrip(item.id) : undefined}
              onChangePrivacy={onChangePrivacy ? p => onChangePrivacy(item.id, p) : undefined}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle:    { width: 32, height: 4, borderRadius: 2 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topBarLabel: { fontSize: 13, fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },

  // ── Post card ──────────────────────────────────────────────────────────
  post: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#001233', shadowOpacity: 0.08, shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, gap: 12,
  },
  title: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26, marginBottom: 4,
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  dateRange:  { fontSize: 12, fontWeight: '600' },
  menuBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },

  // ── Breadcrumb ────────────────────────────────────────────────────────
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap',
    paddingHorizontal: 18, paddingBottom: 12,
  },
  breadcrumbCode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  legCount:       { fontSize: 11, fontWeight: '500' },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 18, marginBottom: 4 },

  // ── Journey timeline ───────────────────────────────────────────────────
  journey: {
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20,
  },

  // ── Per-leg FlightDetailModal style ──
  legInfo: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  routeCode: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeDash: { flex: 1, height: 1 },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cityText: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  metaText: { fontSize: 13, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  note: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
