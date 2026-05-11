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
import { toggleLike } from '../services/db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EditFlightModal from './EditFlightModal';
import TripActionSheet from './TripActionSheet';

const { width: W } = Dimensions.get('window');

type TripType = 'roundtrip' | 'oneway' | 'multicity';

// ── Helpers ───────────────────────────────────────────────────────────────
function parseDDMMYYYY(d: string): Date | null {
  const p = d.split('-');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}
function fmtShort(s: string): string {
  const d = parseDDMMYYYY(s);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : s;
}
function fmtFull(s: string): string {
  const d = parseDDMMYYYY(s);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : s;
}
function fmtRange(start: string, end: string | null): string {
  if (!end) return `${fmtShort(start)} – now`;
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

// ── Status badge ───────────────────────────────────────────────────────────
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
  return (
    <View style={[sb.wrap, { backgroundColor: theme.pastBg }]}>
      <Text style={[sb.text, { color: theme.past }]}>PAST</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});

// ── Trip type pill ─────────────────────────────────────────────────────────
function TypePill({ type, theme }: { type: TripType; theme: Theme }) {
  const cfg = {
    roundtrip: { icon: 'repeat-outline' as const,      label: 'Round trip' },
    oneway:    { icon: 'arrow-forward-outline' as const, label: 'One way' },
    multicity: { icon: 'shuffle-outline' as const,     label: 'Multi-city' },
  }[type];
  return (
    <View style={[tp.wrap, { backgroundColor: theme.accentBg }]}>
      <Ionicons name={cfg.icon} size={11} color={theme.accent} />
      <Text style={[tp.text, { color: theme.accent }]}>{cfg.label}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ── Per-leg photo carousel ─────────────────────────────────────────────────
function LegPhotos({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;
  return (
    <View style={lp.wrap}>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
      >
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={lp.img} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={lp.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[lp.dot, { opacity: i === idx ? 1 : 0.4 }]} />
          ))}
        </View>
      )}
    </View>
  );
}
const lp = StyleSheet.create({
  wrap: { marginBottom: 0 },
  img:  { width: W, height: W * 0.72 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});

// ── Trip post ──────────────────────────────────────────────────────────────
function TripPost({
  trip, theme, currentUserId, onLikeChange, onEditFlight, onDeleteFlight,
  onAddFlight, onDeleteTrip, onChangePrivacy,
}: {
  trip: Trip; theme: Theme; currentUserId?: string;
  onLikeChange?:   (flightId: string, liked: boolean) => void;
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
  const [liked, setLiked]         = useState(() => trip.legs.some(l => l.liked));
  const [likeCount, setLikeCount] = useState(() => trip.legs.reduce((n, l) => n + (l.likes ?? 0), 0));
  const heartScale = useRef(new Animated.Value(1)).current;
  const pulse      = useRef(new Animated.Value(1)).current;

  const type          = detectType(trip);
  const hasLive       = trip.legs.some(l => l.status === 'live');
  const totalComments = trip.legs.reduce((n, l) => n + (l.comments ?? 0), 0);

  // Build stops array (same approach as TripCard)
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
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
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

  const displayTitle = tripName || trip.primaryDestinationCity || trip.primaryDestination || trip.airportSequence.join(' › ');

  function startRename() {
    setNameInput(tripName);
    setIsRenaming(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  }
  function commitRename() {
    const t = nameInput.trim();
    setTripName(t);
    setIsRenaming(false);
    if (t) AsyncStorage.setItem(`trip_name_${trip.id}`, t).catch(() => {});
    else   AsyncStorage.removeItem(`trip_name_${trip.id}`).catch(() => {});
  }

  function handleLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    if (next) {
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.45, duration: 140, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
      ]).start();
    }
    const leg = trip.legs[0];
    if (leg) {
      toggleLike(leg.id, currentUserId, next).catch(() => {});
      onLikeChange?.(leg.id, next);
    }
  }

  return (
    <View style={s.post}>
      {/* ── Trip header ── */}
      <View style={s.tripHeader}>
        <View style={{ flex: 1 }}>
          {isRenaming ? (
            <TextInput
              ref={nameRef}
              style={[s.tripTitle, { color: theme.text, padding: 0 }]}
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
            <Text style={[s.tripTitle, { color: theme.text }]} numberOfLines={1}>{displayTitle}</Text>
          )}
          <View style={s.tripMeta}>
            <Text style={[s.tripDate, { color: theme.textMuted }]}>{fmtRange(trip.departedAt, trip.returnedAt)}</Text>
            <TypePill type={type} theme={theme} />
            <Text style={[s.flightCount, { color: theme.textMuted }]}>
              {trip.legs.length} {trip.legs.length === 1 ? 'flight' : 'flights'}
            </Text>
          </View>
        </View>
        {isRenaming ? (
          <TouchableOpacity onPress={commitRename} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="checkmark" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={[s.divider, { backgroundColor: theme.sep }]} />

      {/* ── Timeline ── */}
      <View style={s.timeline}>
        {stops.map((stop, si) => {
          const isLast      = si === stops.length - 1;
          const isHome      = isLast && type === 'roundtrip';
          const connecting  = !isLast && stop.stay === 0;
          const stayCity    = stop.city || stop.code;
          const leg         = stop.legAfter;
          const note        = leg?.note;

          return (
            <View key={si}>
              {/* Full-width photos for this stop (arrival photos of the leg before this stop) */}
              {stop.photos.length > 0 && (
                <View style={s.legPhotosWrap}>
                  <LegPhotos photos={stop.photos} />
                </View>
              )}

              <View style={s.stopRow}>
                {/* Rail */}
                <View style={s.railCol}>
                  <View style={[
                    s.stopDot,
                    isHome || stop.isFirst
                      ? { backgroundColor: theme.accent }
                      : { backgroundColor: 'transparent', borderWidth: 2.5, borderColor: theme.accent },
                  ]} />
                  {!isLast && <View style={[s.railLine, { backgroundColor: theme.sep }]} />}
                </View>

                {/* Content */}
                <View style={[s.stopContent, !isLast && { paddingBottom: 4 }]}>
                  {/* Airport + home indicator */}
                  <View style={s.cityRow}>
                    <Text style={[s.stopCode, { color: theme.text }]}>{stop.code}</Text>
                    {isHome && (
                      <View style={[s.homePill, { backgroundColor: theme.accentBg }]}>
                        <Ionicons name="home-outline" size={10} color={theme.accent} />
                        <Text style={[s.homePillText, { color: theme.accent }]}>home</Text>
                      </View>
                    )}
                  </View>

                  {/* City name */}
                  {stop.city ? (
                    <Text style={[s.stopCity, { color: theme.textMuted }]}>{stop.city}</Text>
                  ) : null}

                  {/* Stay or connecting info */}
                  {!isLast && stop.stay >= 1 && (
                    <View style={s.stayRow}>
                      <View style={[s.stayLine, { backgroundColor: theme.sep }]} />
                      <View style={[s.stayBadge, { backgroundColor: theme.accentBg }]}>
                        <Ionicons name="moon-outline" size={12} color={theme.accent} />
                        <Text style={[s.stayLabel, { color: theme.accent }]}>
                          {stop.stay === 1 ? '1 day' : `${stop.stay} days`} in {stayCity}
                        </Text>
                      </View>
                      <View style={[s.stayLine, { backgroundColor: theme.sep }]} />
                    </View>
                  )}
                  {connecting && !isLast && (
                    <Text style={[s.connectText, { color: theme.textMuted }]}>Connecting</Text>
                  )}

                  {/* Flight segment departing from this stop */}
                  {leg && (
                    <View style={s.segmentCard}>
                      <View style={s.segmentTop}>
                        {/* From → To */}
                        <View style={s.segRoute}>
                          <Text style={[s.segCode, { color: theme.text }]}>{leg.from.code}</Text>
                          <View style={s.segArrow}>
                            <View style={[s.segLine, { backgroundColor: theme.sep }]} />
                            <Ionicons name="airplane" size={13} color={theme.accent} />
                            <View style={[s.segLine, { backgroundColor: theme.sep }]} />
                          </View>
                          <Text style={[s.segCode, { color: theme.text }]}>{leg.to.code}</Text>
                        </View>
                        <StatusBadge status={leg.status} theme={theme} pulse={pulse} />
                      </View>

                      <View style={s.segMeta}>
                        {leg.flightNum ? (
                          <Text style={[s.segNum, { color: theme.textSub }]}>{leg.flightNum}</Text>
                        ) : null}
                        {leg.flightNum ? <Text style={[s.segDot, { color: theme.textMuted }]}>·</Text> : null}
                        <Text style={[s.segInfo, { color: theme.textMuted }]}>{fmtFull(leg.date)}</Text>
                        {leg.duration ? (
                          <>
                            <Text style={[s.segDot, { color: theme.textMuted }]}>·</Text>
                            <Text style={[s.segInfo, { color: theme.textMuted }]}>{leg.duration}</Text>
                          </>
                        ) : null}
                      </View>

                      {/* Note */}
                      {note ? (
                        <Text style={[s.segNote, { color: theme.textSub }]}>{note}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Divider ── */}
      <View style={[s.divider, { backgroundColor: theme.sep }]} />

      {/* ── Actions ── */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? theme.live : theme.textMuted} />
          </Animated.View>
          <Text style={[s.actionCount, { color: liked ? theme.live : theme.textMuted }]}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}>
          <Ionicons name="chatbubble-outline" size={21} color={theme.textMuted} />
          <Text style={[s.actionCount, { color: theme.textMuted }]}>{totalComments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}>
          <Ionicons name="share-outline" size={21} color={theme.textMuted} />
          <Text style={[s.actionCount, { color: theme.textMuted }]}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Trip action sheet */}
      <TripActionSheet
        visible={sheetOpen}
        trip={trip}
        theme={theme}
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

      {/* Edit modal */}
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
  onLikeChange?:   (flightId: string, liked: boolean) => void;
  onEditFlight?:   (flightId: string, updates: import('./EditFlightModal').FlightEditUpdates) => void;
  onDeleteFlight?: (flightId: string) => void;
  onAddFlight?:    () => void;
  onDeleteTrip?:   (tripId: string) => void;
  onChangePrivacy?:(tripId: string, privacy: 'public' | 'followers' | 'private') => void;
  onClose: () => void;
}

export default function TripViewerModal({ visible, trips, initialIndex, theme, isDark, currentUserId, onLikeChange, onEditFlight, onDeleteFlight, onAddFlight, onDeleteTrip, onChangePrivacy, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[s.safe, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>Trip</Text>
          <View style={s.closeBtn} />
        </View>

        <FlatList
          data={trips}
          keyExtractor={t => t.id}
          renderItem={({ item }: ListRenderItemInfo<Trip>) => (
            <TripPost
              trip={item}
              theme={theme}
              currentUserId={currentUserId}
              onLikeChange={onLikeChange}
              onEditFlight={onEditFlight}
              onDeleteFlight={onDeleteFlight}
              onAddFlight={onAddFlight}
              onDeleteTrip={onDeleteTrip ? () => onDeleteTrip(item.id) : undefined}
              onChangePrivacy={onChangePrivacy ? (p) => onChangePrivacy(item.id, p) : undefined}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={[s.tripSep, { backgroundColor: theme.sep }]} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Modal header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5,
  },
  closeBtn:    { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  tripSep:     { height: 10 },

  post: {},

  // Trip header
  tripHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
  },
  tripTitle:  { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, lineHeight: 26 },
  tripMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  tripDate:   { fontSize: 13, fontWeight: '500' },
  flightCount:{ fontSize: 12, fontWeight: '500' },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },

  // Timeline
  timeline: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  legPhotosWrap: { marginHorizontal: -20, marginBottom: 16, marginTop: 4 },

  stopRow:    { flexDirection: 'row' },
  railCol:    { width: 24, alignItems: 'center' },
  stopDot:    { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  railLine:   { width: 2, flex: 1, minHeight: 32, marginTop: 3 },
  stopContent:{ flex: 1, paddingLeft: 14, paddingBottom: 8 },

  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopCode:{ fontSize: 28, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  stopCity:{ fontSize: 13, fontWeight: '500', marginTop: 2, marginBottom: 4 },

  stayRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  stayLine: { flex: 1, height: 1 },
  stayBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  stayLabel:{ fontSize: 12, fontWeight: '700' },
  connectText: { fontSize: 12, fontWeight: '500', marginTop: 2, marginBottom: 6 },

  homePill:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12 },
  homePillText:{ fontSize: 11, fontWeight: '700' },

  // Flight segment card inside the timeline
  segmentCard: { marginTop: 8, marginBottom: 4 },
  segmentTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  segRoute:    { flexDirection: 'row', alignItems: 'center', gap: 0, flex: 1, marginRight: 10 },
  segCode:     { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  segArrow:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  segLine:     { flex: 1, height: 1 },
  segMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  segNum:      { fontSize: 13, fontWeight: '700' },
  segDot:      { fontSize: 13 },
  segInfo:     { fontSize: 13, fontWeight: '500' },
  segNote:     { fontSize: 13, fontWeight: '400', lineHeight: 19, marginTop: 8 },

  // Actions
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 22 },
  actionCount: { fontSize: 14, fontWeight: '600' },
});
