import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Modal, StatusBar, Dimensions,
  TextInput, Keyboard, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Trip } from '../services/tripGrouping';
import { Flight } from '../data/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EditFlightModal, { FlightEditUpdates } from './EditFlightModal';
import TripActionSheet from './TripActionSheet';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type TripType = 'roundtrip' | 'oneway' | 'multicity';

interface Props {
  trip: Trip;
  theme: Theme;
  isDark?: boolean;
  onOpen?: () => void;
  onDeleteTrip?: () => void;
  onChangePrivacy?: (privacy: 'public' | 'followers' | 'private') => void;
  onAddReturn?: () => void;
  onAddFlight?: () => void;
  onEditFlight?: (flightId: string, updates: FlightEditUpdates) => void;
  onDeleteFlight?: (flightId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────
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
  if (!end) return `${fmtShort(start)} – now`;
  const s = parseDDMMYYYY(start), e = parseDDMMYYYY(end);
  if (!s || !e) return `${fmtShort(start)} – ${fmtShort(end)}`;
  return s.getFullYear() === e.getFullYear()
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

// ── Destination gradient palette ──────────────────────────────────────────
// Maps airport codes / region keywords → [top, bottom] gradient colors
const DEST_GRADIENTS: Record<string, [string, string]> = {
  // Tropical / Pacific
  HNL: ['#0EA5E9', '#0D9488'], // Hawaii – ocean blue to teal
  OGG: ['#06B6D4', '#065F46'], // Maui – aqua to deep jungle
  KOA: ['#F59E0B', '#D97706'], // Kona – sunset amber
  GUM: ['#38BDF8', '#0369A1'], // Guam – bright ocean

  // Asia
  NRT: ['#1E293B', '#BE185D'], // Tokyo – midnight to neon pink
  HND: ['#0F172A', '#7C3AED'], // Haneda – deep blue to violet
  ICN: ['#1E3A5F', '#C084FC'], // Seoul – night sky
  HKG: ['#0F172A', '#F97316'], // Hong Kong – dark to neon orange
  SIN: ['#164E63', '#06B6D4'], // Singapore – tropical modern
  BKK: ['#78350F', '#F59E0B'], // Bangkok – temple gold
  DPS: ['#14532D', '#65A30D'], // Bali – lush green

  // Europe
  CDG: ['#374151', '#6B7280'], // Paris – moody grey
  LHR: ['#1C1917', '#57534E'], // London – fog/stone
  FCO: ['#92400E', '#D97706'], // Rome – warm terracotta
  BCN: ['#1D4ED8', '#F59E0B'], // Barcelona – blue & gold
  AMS: ['#1E3A5F', '#64748B'], // Amsterdam – canal grey-blue
  DUB: ['#14532D', '#4ADE80'], // Dublin – green
  ZRH: ['#E2E8F0', '#94A3B8'], // Zurich – alpine grey/white
  VIE: ['#1E1B4B', '#818CF8'], // Vienna – imperial purple

  // North America
  JFK: ['#0F172A', '#334155'], // NYC – urban night
  LGA: ['#0F172A', '#334155'],
  EWR: ['#0F172A', '#334155'],
  LAX: ['#F97316', '#EC4899'], // LA – sunset
  SFO: ['#0369A1', '#7C3AED'], // SF – bay fog to tech purple
  SEA: ['#164E63', '#475569'], // Seattle – misty water
  PDX: ['#14532D', '#166534'], // Portland – lush forest
  ORD: ['#1E293B', '#475569'], // Chicago – urban steel
  MIA: ['#0891B2', '#F59E0B'], // Miami – teal & gold
  MCO: ['#0EA5E9', '#F97316'], // Orlando – sky & sunshine
  DEN: ['#1E3A5F', '#D1D5DB'], // Denver – mountain blue/snow
  SLC: ['#334155', '#E2E8F0'], // SLC – desert mountain
  PHX: ['#C2410C', '#F59E0B'], // Phoenix – desert fire
  LAS: ['#0F172A', '#F59E0B'], // Vegas – night lights gold
  ATL: ['#1F2937', '#374151'], // Atlanta – city slate
  BOS: ['#1E3A5F', '#93C5FD'], // Boston – harbor blue
  MSP: ['#1E3A5F', '#475569'], // Minneapolis – lake grey
  SAN: ['#0284C7', '#38BDF8'], // San Diego – sunny ocean
  AUS: ['#92400E', '#F97316'], // Austin – earthy warm
  DFW: ['#1C1917', '#78350F'], // Dallas – plains dusk
  IAH: ['#1C1917', '#78350F'],

  // Mexico / Caribbean
  CUN: ['#0891B2', '#10B981'], // Cancun – turquoise
  SJD: ['#F97316', '#DC2626'], // Los Cabos – sunset fire
  PVR: ['#065F46', '#059669'], // Puerto Vallarta – jungle coast
  MBJ: ['#0D9488', '#065F46'], // Montego Bay – Caribbean green

  // Alaska / Canada
  ANC: ['#1E3A5F', '#E2E8F0'], // Anchorage – arctic blue/white
  FAI: ['#1E3A5F', '#A78BFA'], // Fairbanks – aurora
  YVR: ['#164E63', '#4ADE80'], // Vancouver – lush coast
  YYZ: ['#1C1917', '#475569'], // Toronto – urban

  // Middle East / Africa
  DXB: ['#92400E', '#F59E0B'], // Dubai – desert gold
  AUH: ['#78350F', '#FDE68A'], // Abu Dhabi
  JNB: ['#92400E', '#CA8A04'], // Johannesburg – savanna
  NBO: ['#14532D', '#D97706'], // Nairobi – safari

  // Australia / NZ
  SYD: ['#0369A1', '#F97316'], // Sydney – harbour gold
  MEL: ['#1E3A5F', '#475569'], // Melbourne – coffee/grey
  AKL: ['#164E63', '#4ADE80'], // Auckland – green
};

const FALLBACK_GRADIENTS: Array<[string, string]> = [
  ['#0F172A', '#1E3A5F'],
  ['#1C1917', '#44403C'],
  ['#0F172A', '#134E4A'],
  ['#1A1A2E', '#16213E'],
  ['#0F172A', '#292524'],
];

function destGradient(trip: Trip, isDark: boolean): [string, string] {
  // Try primary destination code first
  const primary = trip.primaryDestination?.toUpperCase();
  if (primary && DEST_GRADIENTS[primary]) return DEST_GRADIENTS[primary];

  // Try all arrival airports
  for (const leg of trip.legs) {
    const code = leg.to.code?.toUpperCase();
    if (code && DEST_GRADIENTS[code]) return DEST_GRADIENTS[code];
  }

  // Deterministic fallback based on trip id
  const idx = trip.id
    ? trip.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % FALLBACK_GRADIENTS.length
    : 0;
  return FALLBACK_GRADIENTS[idx];
}

// ── Trip type pill ─────────────────────────────────────────────────────────
function TypePill({ type, theme }: { type: TripType; theme: Theme }) {
  const cfg = {
    roundtrip: { icon: 'repeat-outline' as const,        label: 'Round trip' },
    oneway:    { icon: 'arrow-forward-outline' as const,  label: 'One way' },
    multicity: { icon: 'shuffle-outline' as const,        label: 'Multi-city' },
  }[type];
  return (
    <View style={[tp.wrap, { backgroundColor: theme.accentBg }]}>
      <Ionicons name={cfg.icon} size={10} color={theme.accent} />
      <Text style={[tp.text, { color: theme.accent }]}>{cfg.label}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 10, fontWeight: '700' },
});

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
  return null;
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});

// ── Component ──────────────────────────────────────────────────────────────
export default function TripCard({ trip, theme, isDark = true, onOpen, onDeleteTrip, onChangePrivacy, onAddReturn, onAddFlight, onEditFlight, onDeleteFlight }: Props) {
  const [lightboxUri, setLightboxUri]   = useState<string | null>(null);
  const [name, setName]                 = useState('');
  const [isRenaming, setIsRenaming]     = useState(false);
  const [nameInput, setNameInput]       = useState('');
  const nameRef = useRef<TextInput>(null);
  const [failed, setFailed]             = useState<Set<string>>(new Set());
  const [editing, setEditing]           = useState<Flight | null>(null);
  const [sheetOpen, setSheetOpen]       = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const type         = detectType(trip);
  const fallback     = trip.primaryDestinationCity || trip.primaryDestination || '—';
  const title        = name || fallback;
  const dateRange    = fmtRange(trip.departedAt, trip.returnedAt);
  const hasLive      = trip.legs.some(l => l.status === 'live');
  const allPhotos    = trip.legs.flatMap(l => l.photos ?? []).filter(u => !failed.has(u));
  const firstNote    = trip.legs.find(l => l.note)?.note;

  // Build stops
  const stops = [
    {
      code: trip.legs[0].from.code,
      city: trip.legs[0].from.city ?? '',
      legAfter: trip.legs[0],
      stay: 0,
      isFirst: true,
    },
    ...trip.legs.map((leg, i) => ({
      code: leg.to.code,
      city: leg.to.city ?? '',
      legAfter: trip.legs[i + 1] ?? null,
      stay: i < trip.legs.length - 1 ? stayDays(leg.date, trip.legs[i + 1].date) : 0,
      isFirst: false,
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
        if (v) { setName(v); return; }
        for (const leg of trip.legs) {
          const u = await AsyncStorage.getItem(`trip_name_trip_${leg.id}`);
          if (u) { setName(u); return; }
        }
      } catch {}
    }
    load();
  }, [trip.id]);

  function startRename() {
    setNameInput(name);
    setIsRenaming(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  }
  function commitRename() {
    Keyboard.dismiss();
    const t = nameInput.trim();
    setName(t);
    setIsRenaming(false);
    if (t) AsyncStorage.setItem(`trip_name_${trip.id}`, t).catch(() => {});
    else   AsyncStorage.removeItem(`trip_name_${trip.id}`).catch(() => {});
  }

  const extraPhotos = allPhotos.filter(u => !failed.has(u));


  return (
    <>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.sep }]}>

        <TouchableOpacity activeOpacity={0.97} onPress={onOpen}>

          {/* ── Flat header ── */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              {isRenaming ? (
                <TextInput
                  ref={nameRef}
                  style={[s.nameInput, { color: theme.text }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  onSubmitEditing={commitRename}
                  onBlur={commitRename}
                  placeholder={fallback}
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="done"
                  selectionColor={theme.accent}
                  autoCapitalize="words"
                />
              ) : (
                <Text style={[s.tripTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
              )}
              <View style={s.headerMeta}>
                <Text style={[s.dateRange, { color: theme.textMuted }]}>{dateRange}</Text>
                <TypePill type={type} theme={theme} />
              </View>
            </View>

            <View style={s.headerRight}>
              {isRenaming ? (
                <TouchableOpacity onPress={e => { e.stopPropagation?.(); commitRename(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="checkmark" size={18} color={theme.accent} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={e => { e.stopPropagation?.(); setSheetOpen(true); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Timeline body ── */}
          <View style={s.body}>

            {/* Airport sequence breadcrumb */}
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

            {/* Combined photos from all legs */}
            {extraPhotos.length > 0 && (
              <>
                <View style={[s.divider, { backgroundColor: theme.sep }]} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.photoStrip}
                  contentContainerStyle={s.photoContent}
                  snapToInterval={114}
                  decelerationRate="fast"
                >
                  {extraPhotos.map((uri, pi) => (
                    <TouchableOpacity key={pi} activeOpacity={0.88} onPress={() => setLightboxUri(uri)}>
                      <Image
                        source={{ uri }}
                        style={s.photo}
                        resizeMode="cover"
                        onError={() => setFailed(prev => new Set([...prev, uri]))}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Individual flights */}
            {trip.legs.map((leg, li) => (
              <View key={leg.id}>
                <View style={[s.divider, { backgroundColor: theme.sep }]} />
                <View style={s.legRow}>
                  <View style={s.legRouteWrap}>
                    <Text style={[s.legCode, { color: theme.text }]}>{leg.from.code}</Text>
                    <Ionicons name="arrow-forward" size={12} color={theme.accent} />
                    <Text style={[s.legCode, { color: theme.text }]}>{leg.to.code}</Text>
                  </View>
                  <View style={s.legMeta}>
                    {leg.flightNum ? <Text style={[s.legMetaText, { color: theme.textSub }]}>{leg.flightNum}</Text> : null}
                    {leg.flightNum ? <Text style={[s.legMetaDot, { color: theme.textMuted }]}>·</Text> : null}
                    <Text style={[s.legMetaText, { color: theme.textMuted }]}>{fmtShort(leg.date)}</Text>
                    {leg.duration ? (
                      <>
                        <Text style={[s.legMetaDot, { color: theme.textMuted }]}>·</Text>
                        <Text style={[s.legMetaText, { color: theme.textMuted }]}>{leg.duration}</Text>
                      </>
                    ) : null}
                  </View>
                  <StatusBadge status={leg.status} theme={theme} pulse={pulse} />
                </View>
              </View>
            ))}

            {/* Return suggestion */}
            {trip.legs.length === 1 && onAddReturn ? (
              <TouchableOpacity
                style={[s.returnPill, { borderColor: theme.accent }]}
                onPress={e => { e.stopPropagation?.(); onAddReturn(); }}
                activeOpacity={0.75}
              >
                <Ionicons name="swap-horizontal-outline" size={14} color={theme.accent} />
                <Text style={[s.returnPillText, { color: theme.accent }]}>Add flight</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: 6 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Trip action sheet */}
      <TripActionSheet
        visible={sheetOpen}
        trip={trip}
        theme={theme}
        isDark={isDark}
        onClose={() => setSheetOpen(false)}
        onRename={startRename}
        onAddFlight={onAddFlight}
        onEditLeg={leg => setEditing(leg)}
        onDeleteLeg={leg => onDeleteFlight?.(leg.id)}
        onChangePrivacy={onChangePrivacy}
        onDeleteTrip={onDeleteTrip}
      />

      {/* Edit flight modal */}
      {editing && (
        <EditFlightModal
          flight={editing}
          visible
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={updates => { onEditFlight?.(editing.id, updates); setEditing(null); }}
        />
      )}

      {/* Lightbox */}
      {lightboxUri && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setLightboxUri(null)}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity
            style={s.lightboxBg}
            activeOpacity={1}
            onPress={() => setLightboxUri(null)}
          >
            <Image source={{ uri: lightboxUri }} style={s.lightboxImg} resizeMode="contain" />
            <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUri(null)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 20, marginBottom: 14, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  // ── Flat header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  headerLeft:  { flex: 1, marginRight: 8 },
  headerRight: { alignItems: 'flex-end' },
  tripTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 23 },
  nameInput: { fontSize: 18, fontWeight: '800', paddingVertical: 2, marginBottom: 2 },
  headerMeta:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' },
  dateRange: { fontSize: 12, fontWeight: '600' },

  // ── Body (timeline + below) ──
  body: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  breadcrumbCode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  legCount:       { fontSize: 11, fontWeight: '500' },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginVertical: 2 },

  // Timeline
  timeline: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  stopRow:    { flexDirection: 'row' },
  railCol:    { width: 20, alignItems: 'center' },
  stopDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  railLine:   { width: 2, flex: 1, minHeight: 24, marginTop: 3 },
  stopContent:{ flex: 1, paddingLeft: 10, paddingBottom: 6 },

  cityRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stopCode: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, lineHeight: 21 },
  stopCity: { fontSize: 11, fontWeight: '500', marginTop: 1, lineHeight: 15 },

  stayChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    alignSelf: 'flex-start', marginTop: 5, marginBottom: 2,
  },
  stayText:      { fontSize: 11, fontWeight: '600' },
  connectingText:{ fontSize: 11, fontWeight: '500', marginTop: 3, marginBottom: 2 },

  homePill:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  homePillText:{ fontSize: 10, fontWeight: '700' },

  flightRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  flightMeta:{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  flightNum: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  flightDuration:{ fontSize: 11, fontWeight: '500' },
  flightDate:{ fontSize: 11, fontWeight: '500' },
  dotSep:    { fontSize: 11 },

  // Note
  note: { fontSize: 13, fontWeight: '500', lineHeight: 18, paddingHorizontal: 16, paddingVertical: 10 },

  // Photos
  photoStrip:   { maxHeight: 108 },
  photoContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  photo:        { width: 106, height: 88, borderRadius: 12 },

  // Individual flight rows
  legRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  legRouteWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 90 },
  legCode: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  legMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  legMetaText: { fontSize: 12, fontWeight: '500' },
  legMetaDot: { fontSize: 12 },

  // Return pill
  returnPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10, marginBottom: 8, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
  },
  returnPillText: { fontSize: 13, fontWeight: '600' },

  // Lightbox
  lightboxBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg:   { width: SCREEN_W, height: SCREEN_H * 0.8 },
  lightboxClose: {
    position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
});
