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

// ── Photo strip ────────────────────────────────────────────────────────────
const PHOTO_W = W - 32 - 40;

function PhotoStrip({ photos, theme }: { photos: string[]; theme: Theme }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;
  return (
    <View style={ph.wrap}>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / PHOTO_W))}
      >
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={[ph.img, { width: PHOTO_W }]} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={ph.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[ph.dot, { opacity: i === idx ? 0.85 : 0.22 }]} />
          ))}
        </View>
      )}
    </View>
  );
}
const ph = StyleSheet.create({
  wrap: { marginTop: 0, marginBottom: 0, overflow: 'hidden' },
  img:  { height: PHOTO_W * 0.68 },
  dots: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
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

  const allPhotos = trip.legs.flatMap(l => l.photos ?? []);

  return (
    <View style={[s.post, { backgroundColor: theme.card, borderColor: theme.sep }]}>

      {/* ── Hero photo gallery ── */}
      {allPhotos.length > 0 && (
        <PhotoStrip photos={allPhotos} theme={theme} />
      )}

      {/* ── Header ── */}
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

      <View style={[s.divider, { backgroundColor: theme.sep }]} />

      {/* ── Journey timeline ── */}
      <View style={s.journey}>
        {stops.map((stop, si) => {
          const isLast     = si === stops.length - 1;
          const isHome     = isLast && type === 'roundtrip';
          const isEndpoint = stop.isFirst || isHome;
          const stayCity   = stop.city || stop.code;
          const leg        = stop.legAfter;

          return (
            <View key={si} style={s.stopWrap}>

              {/* ── Rail column ── */}
              <View style={s.railCol}>
                <View style={[
                  s.dot,
                  isEndpoint
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.accent },
                ]} />
                {!isLast && <View style={[s.railLine, { backgroundColor: theme.sep }]} />}
              </View>

              {/* ── Stop content ── */}
              <View style={[s.stopContent, isLast && { paddingBottom: 0 }]}>

                {/* Airport */}
                <Text style={[s.code, { color: theme.text }]}>{stop.code}</Text>
                {stop.city ? (
                  <Text style={[s.city, { color: theme.textMuted }]}>{stop.city}</Text>
                ) : null}

                {/* Photos */}
                {stop.photos.length > 0 && (
                  <PhotoStrip photos={stop.photos} theme={theme} />
                )}

                {/* Stay chip — matches TripCard */}
                {!isLast && stop.stay >= 1 && (
                  <View style={[s.stayChip, { backgroundColor: theme.accentBg }]}>
                    <Ionicons name="moon-outline" size={10} color={theme.accent} />
                    <Text style={[s.stayText, { color: theme.accent }]}>
                      {stop.stay === 1 ? '1 night' : `${stop.stay} nights`} in {stayCity}
                    </Text>
                  </View>
                )}

                {/* Flight row — matches TripCard layout */}
                {leg && (
                  <View style={s.flightBlock}>
                    <View style={s.flightRow}>
                      <Ionicons name="airplane-outline" size={11} color={theme.textMuted} style={{ marginTop: 1 }} />
                      <View style={s.flightMeta}>
                        {leg.flightNum ? (
                          <Text style={[s.flightNum, { color: theme.textSub }]}>{leg.flightNum}</Text>
                        ) : null}
                        {leg.flightNum && leg.duration ? (
                          <Text style={[s.dotSep, { color: theme.textMuted }]}>·</Text>
                        ) : null}
                        {leg.duration ? (
                          <Text style={[s.flightDuration, { color: theme.textMuted }]}>{leg.duration}</Text>
                        ) : null}
                      </View>
                      <Text style={[s.flightDate, { color: theme.textMuted }]}>{fmtShort(leg.date)}</Text>
                      <StatusBadge status={leg.status} theme={theme} pulse={pulse} />
                    </View>
                  </View>
                )}

              </View>
            </View>
          );
        })}
      </View>

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

  stopWrap: { flexDirection: 'row' },

  // Rail
  railCol:  { width: 22, alignItems: 'center', paddingTop: 4 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    zIndex: 1,
  },
  railLine: {
    width: 2, flex: 1, minHeight: 28, marginTop: 4,
  },

  // Stop content
  stopContent: {
    flex: 1, paddingLeft: 12, paddingBottom: 28,
  },
  code: {
    fontSize: 18, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24,
  },
  city: {
    fontSize: 12, fontWeight: '400', marginTop: 1, letterSpacing: 0.1,
  },

  // Stay chip — matches TripCard
  stayChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    alignSelf: 'flex-start', marginTop: 7, marginBottom: 2,
  },
  stayText: { fontSize: 11, fontWeight: '600' },

  // Flight row — matches TripCard layout
  flightBlock: { marginTop: 8 },
  flightRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flightMeta:{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  flightNum: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  flightDuration: { fontSize: 12, fontWeight: '500' },
  flightDate:{ fontSize: 12, fontWeight: '500' },
  dotSep:    { fontSize: 12 },

  // Note
  note: {
    fontSize: 13, fontWeight: '400', lineHeight: 19, marginTop: 6,
    fontStyle: 'italic',
  },
});
