import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, Image, Alert, Keyboard,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../constants/theme';
import { Flight, MY_USER } from '../data/mockData';
import { lookupAllFlights, formatFlightTime, FlightInfo } from '../services/flightApi';
import { syncTripsForUser } from '../services/tripGrouping';
import { GOOGLE_CLOUD_VISION_KEY } from '../config';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (flight: Flight, tripName?: string) => void;
  theme: Theme;
  existingFlights?: Flight[];
  returnFor?: Flight; // pre-configure modal as a return for this flight
  skipTripPrompts?: boolean; // skip relationship prompts when adding to an existing trip
  currentUser?: { name: string; handle: string; initials: string; avatarUrl?: string | null };
}


function ddmmyyyyToApiDate(val: string): string {
  const p = val.split('-');
  if (p.length !== 3 || p[2].length !== 4) return val;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function isDatePast(ddmmyyyy: string): boolean {
  const p = ddmmyyyy.split('-');
  if (p.length !== 3 || p[2].length !== 4) return false;
  const flightDate = new Date(`${p[2]}-${p[1]}-${p[0]}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return flightDate < today;
}

function dateToStr(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

function strToDate(s: string): Date {
  const p = s.split('-');
  if (p.length !== 3 || p[2].length !== 4) return new Date();
  const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  return isNaN(d.getTime()) ? new Date() : d;
}

function fmtAlertDate(s: string): string {
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[1]}-${p[0]}-${p[2].slice(-2)}`;
}

const MONTH_MAP: Record<string, string> = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
};

// Known IATA airline codes — used to reliably identify flight numbers in raw OCR text
const AIRLINE_CODES = new Set([
  // US carriers
  'AA','AS','B6','DL','F9','G4','HA','MX','NK','OH','OO','QX','SY','UA','VX','WN','YV','YX','ZW',
  // Major international
  'AC','AF','AI','AV','AY','AZ','BA','BR','CA','CI','CX','CZ','EI','EK','ET','EY',
  'FJ','GA','GF','IB','JL','JQ','KE','KL','LA','LH','LO','LX','MH','MK','MS','MU',
  'NH','NZ','OS','OZ','PK','PR','QF','QR','RJ','SK','SN','SQ','SU','TG','TK','TP',
  'UA','UL','UX','VA','VN','VS','VY','WS','XQ','ZH',
  // Budget / regional
  'FR','U2','VY','W6','HV','PC','TOM','TUI',
]);

function parseFlightText(text: string): { flightNum: string | null; date: string | null } {
  // Normalize OCR artifacts: replace newlines with spaces, collapse whitespace
  const upper = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').toUpperCase();

  // ── Flight number ────────────────────────────────────────────────────────
  let flightNum: string | null = null;

  // Priority 1: explicit label — "FLIGHT", "FLT", "FL#", "FLIGHT NO", "FLIGHT NUMBER"
  const labelMatch = upper.match(
    /(?:FLIGHT\s*(?:NUMBER|NUM|NO)?|FLT|FL)[:\s#.]*([A-Z0-9]{2})\s?(\d{1,4})/
  );
  if (labelMatch) {
    flightNum = `${labelMatch[1]} ${labelMatch[2]}`;
  }

  // Priority 2: known airline code immediately followed by digits (no false positives)
  if (!flightNum) {
    // Match "UA456", "UA 456", "UA-456"
    const re = /\b([A-Z]{1,2}[0-9]?)\s?[-]?(\d{1,4})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(upper)) !== null) {
      const carrier = m[1].replace(/[0-9]/, ''); // strip trailing digit if alphanumeric code like B6
      const code = m[1];
      if (AIRLINE_CODES.has(code) || AIRLINE_CODES.has(carrier)) {
        flightNum = `${code} ${m[2]}`;
        break;
      }
    }
  }

  // Priority 3: fallback — any 2-char uppercase + 1-4 digits that looks isolated
  // (catches less common codes not in the list above)
  if (!flightNum) {
    const SKIP = new Set([
      'TO','AT','IN','OF','OR','BE','BY','DO','GO','IF','IS','IT','ME',
      'MY','NO','ON','SO','UP','US','WE','AN','AM','OK','ID','PM','AM',
    ]);
    const re2 = /\b([A-Z]{2})\s?(\d{1,4})\b/g;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(upper)) !== null) {
      if (!SKIP.has(m2[1])) {
        flightNum = `${m2[1]} ${m2[2]}`;
        break;
      }
    }
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  // Returns DD-MM-YYYY to match the app's existing date format
  let date: string | null = null;

  // "14 JUN 2025" / "14 JUNE 2025"
  const dmy = upper.match(/\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})\b/);
  // "JUN 14, 2025" / "JUNE 14 2025"
  const mdy = upper.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2}),?\s+(\d{4})\b/);
  // "2025-06-14"
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  // "06/14/2025" or "14/06/2025"
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  // "June 14, 2025" / "June 14 2025" (full month name)
  const full = upper.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2}),?\s+(\d{4})\b/);

  const FULL_MONTHS: Record<string, string> = {
    JANUARY:'01',FEBRUARY:'02',MARCH:'03',APRIL:'04',MAY:'05',JUNE:'06',
    JULY:'07',AUGUST:'08',SEPTEMBER:'09',OCTOBER:'10',NOVEMBER:'11',DECEMBER:'12',
  };

  if (dmy) {
    const mo = MONTH_MAP[dmy[2].substring(0, 3)];
    if (mo) date = `${dmy[1].padStart(2,'0')}-${mo}-${dmy[3]}`;
  } else if (mdy) {
    const mo = MONTH_MAP[mdy[1].substring(0, 3)];
    if (mo) date = `${mdy[2].padStart(2,'0')}-${mo}-${mdy[3]}`;
  } else if (full) {
    const mo = FULL_MONTHS[full[1]];
    if (mo) date = `${full[2].padStart(2,'0')}-${mo}-${full[3]}`;
  } else if (iso) {
    date = `${iso[3]}-${iso[2]}-${iso[1]}`;
  } else if (slash) {
    // Assume MM/DD/YYYY (US standard)
    date = `${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}-${slash[3]}`;
  }

  return { flightNum, date };
}

// ── Flight lookup error card ──────────────────────────────────────────────
function FlightLookupError({ code, num, theme }: { code: string; num: string; theme: Theme }) {
  // Detect if the number might have zero/O confusion in the airline prefix
  const prefix = num.replace(/\s/g, '').toUpperCase().slice(0, 2);
  const hasZeroOConfusion = /[0O]/.test(prefix);
  const altNum = num.replace(/\s/g, '').toUpperCase()
    .replace(/^(.{0,2})/, (m: string) => m.split('').map((c: string) => c === '0' ? 'O' : c === 'O' ? '0' : c).join(''));
  const showAltSuggestion = hasZeroOConfusion && altNum !== num.replace(/\s/g, '').toUpperCase();

  const { title, body } = (() => {
    switch (code) {
      case 'NOT_FOUND':
        return {
          title: "Flight not found",
          body: "Our flight database doesn't have this flight. This usually means the airline isn't covered, or the number is slightly off.",
        };
      case 'INVALID':
        return {
          title: "Invalid flight number",
          body: "Flight numbers are usually a 2-letter airline code followed by digits — like AA123 or DL456.",
        };
      case 'DATE_TOO_OLD':
        return {
          title: "Date out of range",
          body: "The flight database only covers flights from the past 12 months. For older flights, enter the details manually below.",
        };
      case 'NO_KEY':
        return {
          title: "API key not configured",
          body: "Add your RapidAPI key to config.ts to enable flight lookup.",
        };
      default:
        return {
          title: "Connection error",
          body: "Couldn't reach the flight database. Check your internet connection and try again.",
        };
    }
  })();

  return (
    <View style={[errStyles.wrap, { backgroundColor: theme.liveBg, borderColor: theme.live }]}>
      <View style={errStyles.header}>
        <Ionicons name="search-outline" size={15} color={theme.live} />
        <Text style={[errStyles.title, { color: theme.live }]}>{title}</Text>
      </View>
      <Text style={[errStyles.body, { color: theme.textSub }]}>{body}</Text>

      {showAltSuggestion && (
        <View style={[errStyles.hint, { borderTopColor: theme.sep }]}>
          <Ionicons name="bulb-outline" size={13} color={theme.warning} />
          <Text style={[errStyles.hintText, { color: theme.textMuted }]}>
            Try <Text style={{ fontWeight: '700', color: theme.warning }}>{altNum}</Text> — the digit 0 and letter O are easy to mix up in flight numbers.
          </Text>
        </View>
      )}

      {code === 'NOT_FOUND' && (
        <View style={errStyles.hint}>
          <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.45)" />
          <Text style={errStyles.hintText}>
            Regional, charter, and some low-cost carriers aren't always in the database. Enter your route manually below.
          </Text>
        </View>
      )}
    </View>
  );
}

const errStyles = StyleSheet.create({
  wrap:  { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 16, gap: 8 },
  header:{ flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 14, fontWeight: '700' },
  body:  { fontSize: 13, fontWeight: '400', lineHeight: 19 },
  hint:  { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  hintText: { flex: 1, fontSize: 12, fontWeight: '400', lineHeight: 17 },
});

export default function AddFlightModal({ visible, onClose, onAdd, theme, existingFlights = [], returnFor, skipTripPrompts = false, currentUser }: Props) {
  const resolvedUser = currentUser
    ? { name: currentUser.name, handle: currentUser.handle, avatarColors: ['#667eea', '#764ba2'] as [string, string], initials: currentUser.initials, avatarUrl: currentUser.avatarUrl ?? null }
    : MY_USER;

  const [step, setStep] = useState<'entry' | 'details'>('entry');
  const [scanLoading, setScanLoading] = useState(false);

  // Flight lookup
  const [lookupNum, setLookupNum] = useState('');
  const [lookupDate, setLookupDate] = useState(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [flightResult, setFlightResult] = useState<FlightInfo | null>(null);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [flightOptions, setFlightOptions] = useState<FlightInfo[] | null>(null); // multiple results picker

  // Post privacy
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');

  // Flight type
  const [flightType, setFlightType] = useState<'upcoming' | 'past'>('upcoming');

  // Manual entry
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');

  // Trip name
  const [tripName, setTripName] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Existing trips for "add to trip" picker
  type TripOption = { id: string; name: string; route: string; currentLocation: string };
  const [tripOptions, setTripOptions] = useState<TripOption[]>([]);

  useEffect(() => {
    if (!visible || (existingFlights?.length ?? 0) === 0) { setTripOptions([]); return; }
    const inferredHome = existingFlights?.[0]?.from?.code ?? '';
    const trips = syncTripsForUser(existingFlights ?? [], inferredHome);
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    // Filter to open trips only
    const openTrips = trips.filter(t => {
      if (t.legs.length === 0) return false;

      // Closed = complete round trip (last arrival === first departure)
      const origin   = t.legs[0].from.code.toUpperCase();
      const lastDest = t.legs[t.legs.length - 1].to.code.toUpperCase();
      if (t.legs.length >= 2 && origin === lastDest) return false;

      // Hide stale trips: no upcoming/live legs, and all past legs are >90 days old
      const hasRecentOrFuture = t.legs.some(leg => {
        if (leg.status === 'upcoming' || leg.status === 'live') return true;
        const parts = leg.date.split('-');
        if (parts.length !== 3) return false;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return (Date.now() - d.getTime()) < NINETY_DAYS;
      });
      return hasRecentOrFuture;
    });

    Promise.all(
      openTrips.map(async t => {
        // Try all possible keys: trip-level key first, then each leg as fallback
        let name = '';
        try {
          name = (await AsyncStorage.getItem(`trip_name_${t.id}`)) ?? '';
          if (!name) {
            for (const leg of t.legs) {
              const n = await AsyncStorage.getItem(`trip_name_trip_${leg.id}`);
              if (n) { name = n; break; }
            }
          }
        } catch {}
        const route = t.airportSequence.join(' › ') || t.primaryDestinationCity || t.primaryDestination || '';
        const currentLocation = t.legs[t.legs.length - 1].to.city || t.legs[t.legs.length - 1].to.code;
        return { id: t.id, name, route, currentLocation };
      })
    ).then(opts => setTripOptions(opts.filter(o => o.name || o.route)));
  }, [visible, existingFlights]);

  // Note + photos
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Date pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lookupDateObj, setLookupDateObj] = useState(new Date());
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
  const [returnDateObj, setReturnDateObj] = useState(new Date());

  // Return flight
  const [addReturn, setAddReturn] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnFlightNum, setReturnFlightNum] = useState('');
  const [returnFlightResult, setReturnFlightResult] = useState<FlightInfo | null>(null);
  const [returnFlightError, setReturnFlightError] = useState<string | null>(null);
  const [returnFlightOptions, setReturnFlightOptions] = useState<FlightInfo[] | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const returnPromptShown = React.useRef(false);

  // Set when user confirms this flight is related to an existing one (return or outbound)
  const [relatedFlight, setRelatedFlight] = useState<Flight | null>(null);

  // Pre-configure the modal when opened as a return for a specific flight
  React.useEffect(() => {
    if (!returnFor || !visible) return;
    setRelatedFlight(returnFor);
    returnPromptShown.current = true;
    if (returnFor.note) setNote(returnFor.note);
    // Pre-fill reversed route in manual fields as fallback
    setFromCode(returnFor.to.code);
    setToCode(returnFor.from.code);
  }, [returnFor, visible]);

  function findOutboundMatch(departureCode: string, destinationCode: string): Flight | null {
    if (!departureCode || !destinationCode) return null;
    const from = departureCode.toUpperCase();
    const to = destinationCode.toUpperCase();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return existingFlights.find(f => {
      // Current flight departs from where outbound arrived
      if (f.to.code.toUpperCase() !== from) return false;
      // Current flight goes back to where outbound departed (true round trip)
      if (f.from.code.toUpperCase() !== to) return false;
      const parts = f.date.split('-'); // DD-MM-YYYY
      if (parts.length !== 3 || parts[2].length !== 4) return false;
      const flightDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      return flightDate >= thirtyDaysAgo;
    }) ?? null;
  }

  function hasExistingReturnLogged(departureCode: string, destinationCode: string): boolean {
    const from = departureCode.toUpperCase();
    const to = destinationCode.toUpperCase();
    return existingFlights.some(f =>
      f.from.code.toUpperCase() === from && f.to.code.toUpperCase() === to,
    );
  }

  // Finds a previously logged return flight that matches the inverse of the current flight
  // e.g. new flight A→B, find existing B→A
  function findPriorReturn(departureCode: string, destinationCode: string): Flight | null {
    if (!departureCode || !destinationCode) return null;
    const from = departureCode.toUpperCase();
    const to = destinationCode.toUpperCase();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return existingFlights.find(f => {
      if (f.from.code.toUpperCase() !== to) return false;
      if (f.to.code.toUpperCase() !== from) return false;
      const parts = f.date.split('-');
      if (parts.length !== 3 || parts[2].length !== 4) return false;
      const flightDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      return flightDate >= thirtyDaysAgo;
    }) ?? null;
  }

  // Finds an existing flight that arrives at the same destination as the new flight
  // but from a different origin — signals a possible "earlier departure leg" scenario
  function findSameDestinationConflict(newFrom: string, newTo: string): Flight | null {
    const from = newFrom.toUpperCase();
    const to = newTo.toUpperCase();
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // If any existing flight arrives AT the new departure airport, this new flight
    // is a continuation leg of a multi-city trip — not a conflict.
    const isConnectingLeg = existingFlights.some(f => f.to.code.toUpperCase() === from);
    if (isConnectingLeg) return null;

    return existingFlights.find(f => {
      if (f.to.code.toUpperCase() !== to) return false;    // must share destination
      if (f.from.code.toUpperCase() === from) return false; // same route — no conflict
      // Exclude exact round-trip geometry (handled by Cases 1 & 2)
      if (f.from.code.toUpperCase() === to && f.to.code.toUpperCase() === from) return false;
      const parts = f.date.split('-');
      if (parts.length !== 3 || parts[2].length !== 4) return false;
      const flightDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      return flightDate >= ninetyDaysAgo;
    }) ?? null;
  }

  function promptFlightRelationship(departureCode: string, destinationCode: string) {
    if (returnPromptShown.current) return;
    if (skipTripPrompts) return;
    if (!departureCode || !destinationCode) return;

    // Case 1: possible round-trip — determine direction based on date
    if (!hasExistingReturnLogged(departureCode, destinationCode)) {
      const roundTripMatch = findOutboundMatch(departureCode, destinationCode);
      if (roundTripMatch) {
        returnPromptShown.current = true;
        const existingDate = strToDate(roundTripMatch.date);
        const newDate = strToDate(lookupDate);
        const newIsEarlier = newDate.getTime() < existingDate.getTime();

        if (newIsEarlier) {
          // New flight is chronologically first — existing may actually be the return
          Alert.alert(
            'Departing Flight?',
            `Your ${roundTripMatch.from.code} → ${roundTripMatch.to.code} on ${fmtAlertDate(roundTripMatch.date)} may actually be the return leg.\n\nIs this (${departureCode} → ${destinationCode}) the true departure?`,
            [
              { text: 'Go Back', style: 'cancel' },
              {
                text: "Yes, it's the departure",
                onPress: () => {
                  setRelatedFlight(roundTripMatch);
                  if (roundTripMatch.note) setNote(roundTripMatch.note);
                },
              },
            ],
          );
        } else {
          // New flight is later — it's the return leg
          Alert.alert(
            'Return Trip?',
            `This looks like the return leg of your ${roundTripMatch.from.code} → ${roundTripMatch.to.code} flight on ${fmtAlertDate(roundTripMatch.date)}.\n\nLog it as the return?`,
            [
              { text: 'Go Back', style: 'cancel' },
              {
                text: "Yes, it's the return",
                onPress: () => {
                  setRelatedFlight(roundTripMatch);
                  if (roundTripMatch.note) setNote(roundTripMatch.note);
                },
              },
            ],
          );
        }
        return;
      }
    }

    // Case 2: a return for this route already exists — ask if this is the outbound
    const priorReturn = findPriorReturn(departureCode, destinationCode);
    if (priorReturn) {
      returnPromptShown.current = true;
      Alert.alert(
        'Departure Flight?',
        `You already have a ${priorReturn.from.code} → ${priorReturn.to.code} flight logged on ${fmtAlertDate(priorReturn.date)}. Is this the outbound flight for that trip?`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: "Yes, it's the outbound",
            onPress: () => {
              setRelatedFlight(priorReturn);
              if (priorReturn.note) setNote(priorReturn.note);
            },
          },
        ],
      );
      return;
    }

    // Case 3: new flight shares a destination with an existing flight from a different origin
    // e.g. adding LAX→HNL when SEA→HNL already exists — ask before merging
    const sameDestFlight = findSameDestinationConflict(departureCode, destinationCode);
    if (sameDestFlight) {
      returnPromptShown.current = true;
      Alert.alert(
        'Different Starting Point',
        `You have a ${sameDestFlight.from.code} → ${sameDestFlight.to.code} on ${fmtAlertDate(sameDestFlight.date)}. Is this a separate trip, or an earlier departure leg of the same trip?`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Earlier departure leg',
            onPress: () => {
              setRelatedFlight(sameDestFlight);
              if (sameDestFlight.note) setNote(sameDestFlight.note);
            },
          },
        ],
      );
    }
  }

  function applyFlightInfo(info: FlightInfo) {
    setFlightResult(info);
    setFlightOptions(null);
    setFlightType(isDatePast(lookupDate) ? 'past' : 'upcoming');
    promptFlightRelationship(info.departure.iata, info.arrival.iata);
    setStep('details');
  }

  async function doLookup() {
    const num = lookupNum.trim();
    if (!num) return;
    setIsLoading(true);
    setFlightResult(null);
    setFlightError(null);
    setFlightOptions(null);
    try {
      const results = await lookupAllFlights(num, ddmmyyyyToApiDate(lookupDate));
      if (results.length === 1) {
        applyFlightInfo(results[0]);
      } else {
        setFlightOptions(results);
        setFlightType(isDatePast(lookupDate) ? 'past' : 'upcoming');
      }
    } catch (e: any) {
      if (e.message === 'NO_KEY') {
        setFlightError('NO_KEY');
      } else if (e.message === 'NOT_FOUND') {
        setFlightError('NOT_FOUND');
      } else if (e.message === 'DATE_TOO_OLD') {
        setFlightError('DATE_TOO_OLD');
      } else if (e.message?.startsWith('API_ERROR_4')) {
        setFlightError('INVALID');
      } else {
        setFlightError('NETWORK');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function scanImage() {
    try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to scan your boarding pass.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: false,
      quality: 0.9,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    if (!GOOGLE_CLOUD_VISION_KEY) {
      Alert.alert('API key required', 'Add your Google Cloud Vision API key to config.ts to enable photo scanning.');
      return;
    }

    setScanLoading(true);
    try {
      const resp = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: result.assets[0].base64 },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            }],
          }),
        },
      );

      const json = await resp.json();
      const rawText: string = json.responses?.[0]?.textAnnotations?.[0]?.description ?? '';

      if (!rawText) {
        Alert.alert('Nothing found', 'Could not read any text from this image. Try a clearer photo.');
        return;
      }

      const extracted = parseFlightText(rawText);

      if (extracted.flightNum) setLookupNum(extracted.flightNum);
      if (extracted.date) {
        setLookupDate(extracted.date);
        setLookupDateObj(strToDate(extracted.date));
        setFlightType(isDatePast(extracted.date) ? 'past' : 'upcoming');
      }

      if (!extracted.flightNum) {
        Alert.alert('Nothing found', 'Could not find a flight number in this image. Try a clearer screenshot of your boarding pass or confirmation email.');
        return;
      }

      // Auto-lookup the extracted flight number
      setScanLoading(true);
      try {
        const dateStr = extracted.date ?? lookupDate;
        const results = await lookupAllFlights(extracted.flightNum, ddmmyyyyToApiDate(dateStr));
        setFlightType(isDatePast(dateStr) ? 'past' : 'upcoming');
        if (results.length === 1) {
          setFlightResult(results[0]);
          setFlightOptions(null);
          setStep('details');
        } else {
          setFlightOptions(results);
          // Stay on entry step — picker will render below
        }
      } catch {
        // Lookup failed — leave user on entry screen with field pre-filled
        Alert.alert('Flight number found', `Found ${extracted.flightNum}${extracted.date ? ` on ${extracted.date}` : ''}.\n\nCouldn't look it up automatically — tap "Look Up Flight" to try again.`);
      }
    } catch {
      Alert.alert('Scan failed', 'Could not analyze the image. Check your connection and try again.');
    } finally {
      setScanLoading(false);
    }
    } catch (e: any) {
      setScanLoading(false);
      Alert.alert('Scan error', e?.message || String(e));
    }
  }

  async function pickPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add trip photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  }

  function reset() {
    const today = new Date();
    setStep('entry');
    setLookupNum('');
    setLookupDate(dateToStr(today));
    setLookupDateObj(today);
    setShowDatePicker(false);
    setFlightType('upcoming');
    setFlightResult(null); setFlightError(null); setFlightOptions(null);
    setFromCode(''); setToCode('');
    setTripName('');
    setNote(''); setPhotos([]);
    setPrivacy('public');
    setAddReturn(false); setReturnDate(''); setReturnFlightNum('');
    setReturnFlightResult(null); setReturnFlightError(null); setReturnFlightOptions(null);
    setReturnDateObj(today); setShowReturnDatePicker(false);
    returnPromptShown.current = false;
    setRelatedFlight(null);
  }

  // Derived: outbound route codes
  const outFrom = flightResult?.departure.iata || fromCode.trim().toUpperCase();
  const outTo   = flightResult?.arrival.iata   || toCode.trim().toUpperCase();

  async function doReturnLookup() {
    const num = returnFlightNum.trim();
    if (!num || !returnDate) return;
    setReturnLoading(true);
    setReturnFlightResult(null);
    setReturnFlightError(null);
    setReturnFlightOptions(null);
    try {
      const results = await lookupAllFlights(num, ddmmyyyyToApiDate(returnDate));
      if (results.length === 1) {
        setReturnFlightResult(results[0]);
      } else {
        setReturnFlightOptions(results);
      }
    } catch (e: any) {
      setReturnFlightError('Flight not found — return leg will use the reversed route.');
    } finally {
      setReturnLoading(false);
    }
  }

  function handlePost() {
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    let newFlight: Flight;

    if (flightResult) {
      newFlight = {
        id,
        userId: '',
        user: resolvedUser,
        from: { code: flightResult.departure.iata, city: flightResult.departure.airport },
        to: { code: flightResult.arrival.iata, city: flightResult.arrival.airport },
        flightNum: flightResult.flightNumber,
        date: lookupDate,
        duration: flightResult.duration ?? '',
        status: flightType,
        note: note || undefined,
        photos,
        privacy,
        likes: 0, comments: 0, liked: false, timeAgo: 'just now',
      };
    } else if (lookupNum) {
      if (!fromCode.trim() || !toCode.trim()) {
        Alert.alert('Route required', 'Please enter the departure and arrival airport codes.');
        return;
      }
      newFlight = {
        id,
        userId: '',
        user: resolvedUser,
        from: { code: fromCode.trim().toUpperCase(), city: '' },
        to: { code: toCode.trim().toUpperCase(), city: '' },
        flightNum: lookupNum,
        date: lookupDate,
        duration: '',
        status: flightType,
        note: note || undefined,
        photos,
        privacy,
        likes: 0, comments: 0, liked: false, timeAgo: 'just now',
      };
    } else {
      Alert.alert('Enter a flight number', 'Please enter or scan a flight number before posting.');
      return;
    }

    onAdd(newFlight, tripName.trim() || undefined);

    // Return flight
    if (addReturn && returnDate) {
      const returnFrom = returnFlightResult?.departure.iata || outTo;
      const returnToCode2 = returnFlightResult?.arrival.iata || outFrom;
      if (returnFrom && returnToCode2) {
        const returnFlight: Flight = {
          id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          }),
          userId: '',
          user: resolvedUser,
          from: { code: returnFrom, city: returnFlightResult?.departure.airport ?? '' },
          to:   { code: returnToCode2, city: returnFlightResult?.arrival.airport ?? '' },
          flightNum: returnFlightResult?.flightNumber || returnFlightNum || '',
          date: returnDate,
          duration: returnFlightResult?.duration ?? '',
          status: isDatePast(returnDate) ? 'past' : 'upcoming',
          note: undefined,
          photos: [],
          likes: 0, comments: 0, liked: false, timeAgo: 'just now',
        };
        onAdd(returnFlight);
      }
    }

    reset();
    onClose();
  }

  const s = theme;

  const fromCode2 = flightResult?.departure.iata || fromCode.trim().toUpperCase();
  const toCode2   = flightResult?.arrival.iata   || toCode.trim().toUpperCase();
  const hasRoute  = !!(fromCode2 && toCode2);

const PRIVACY_OPTIONS: { key: 'public' | 'followers' | 'private'; label: string; icon: string }[] = [
    { key: 'public',    label: 'Public',    icon: 'earth-outline' },
    { key: 'followers', label: 'Followers', icon: 'people-outline' },
    { key: 'private',   label: 'Private',   icon: 'lock-closed-outline' },
  ];

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { reset(); onClose(); }}
        onDismiss={reset}
      >
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: s.card }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.handle, { backgroundColor: s.sep }]} />

          {/* ── Header ── */}
          <View style={styles.sheetHeader}>
            {step === 'details' ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('entry')}>
                <Ionicons name="chevron-back" size={20} color={s.accent} />
                <Text style={[styles.backBtnText, { color: s.accent }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text style={[styles.sheetTitle, { color: s.text }]}>
              {step === 'entry' ? 'Log a Flight' : 'Post Details'}
            </Text>
            <View style={[styles.backBtn, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: s.surface }]} onPress={() => { reset(); onClose(); }}>
                <Ionicons name="close" size={16} color={s.textSub} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Return-for banner */}
            {returnFor && (
              <View style={[styles.returnForBanner, { backgroundColor: s.accentBg }]}>
                <Ionicons name="swap-horizontal-outline" size={15} color={s.accent} />
                <Text style={[styles.returnForText, { color: s.accent }]}>
                  Return for {returnFor.from.code} → {returnFor.to.code} · {returnFor.date}
                </Text>
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 1 — Entry
            ════════════════════════════════════════ */}
            {step === 'entry' && (
              <>
                {/* Screenshot option */}
                <TouchableOpacity
                  style={[styles.methodCard, { backgroundColor: s.surface }]}
                  onPress={scanImage}
                  disabled={scanLoading}
                  activeOpacity={0.75}
                >
                  <View style={[styles.methodIcon, { backgroundColor: s.accentBg }]}>
                    {scanLoading
                      ? <ActivityIndicator size="small" color={s.accent} />
                      : <Ionicons name="image-outline" size={26} color={s.accent} />}
                  </View>
                  <View style={styles.methodText}>
                    <Text style={[styles.methodTitle, { color: s.text }]}>
                      {scanLoading ? 'Scanning…' : 'Add a Screenshot'}
                    </Text>
                    <Text style={[styles.methodSub, { color: s.textMuted }]}>Boarding pass, confirmation email, or app screenshot</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={s.textMuted} />
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: s.sep }]} />
                  <Text style={[styles.orText, { color: s.textMuted }]}>or</Text>
                  <View style={[styles.orLine, { backgroundColor: s.sep }]} />
                </View>

                {/* Manual entry */}
                <Text style={[styles.label, { color: s.textMuted }]}>FLIGHT NUMBER</Text>
                <TextInput
                  style={[styles.input, styles.flightNumInput, { backgroundColor: s.inputBg, color: s.text }]}
                  placeholder="e.g. UA 456"
                  placeholderTextColor={s.textMuted}
                  value={lookupNum}
                  onChangeText={t => { setLookupNum(t.toUpperCase()); setFlightResult(null); setFlightError(null); }}
                  autoCapitalize="characters"
                />

                <View style={styles.dateLabelRow}>
                  <Text style={[styles.label, { color: s.textMuted, marginBottom: 0 }]}>DATE</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const today = new Date();
                      setLookupDateObj(today);
                      const str = dateToStr(today);
                      setLookupDate(str);
                      setFlightResult(null);
                      setFlightError(null);
                      setFlightType(isDatePast(str) ? 'past' : 'upcoming');
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.todayBtn, { color: s.accent }]}>Today</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.input, styles.dateBtn, { backgroundColor: s.inputBg }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowDatePicker(v => !v);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={18} color={s.accent} />
                  <Text style={[styles.dateBtnText, { color: s.text }]}>{(() => { const p = lookupDate.split('-'); return p.length === 3 ? `${p[1]}-${p[0]}-${p[2].slice(-2)}` : lookupDate; })()}</Text>
                  <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={15} color={s.textMuted} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={lookupDateObj}
                    mode="date"
                    display="inline"
                    accentColor={s.accent}
                    onChange={(_, date) => {
                      if (date) {
                        const navigatedMonth = date.getMonth() !== lookupDateObj.getMonth()
                          || date.getFullYear() !== lookupDateObj.getFullYear();
                        setLookupDateObj(date);
                        const str = dateToStr(date);
                        setLookupDate(str);
                        setFlightResult(null);
                        setFlightError(null);
                        setFlightType(isDatePast(str) ? 'past' : 'upcoming');
                        // Only dismiss when the user picks a specific day,
                        // not when they navigate to a different month/year.
                        if (!navigatedMonth) {
                          setShowDatePicker(false);
                        }
                      }
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[styles.lookupBtn, { backgroundColor: s.accent }, (isLoading || lookupNum.trim().length < 3) && { opacity: 0.45 }]}
                  onPress={doLookup}
                  disabled={isLoading || lookupNum.trim().length < 3}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.lookupBtnText}>{flightOptions ? 'Search Again' : 'Look Up Flight'}</Text>}
                </TouchableOpacity>

                {/* Multiple flights picker */}
                {flightOptions && flightOptions.length > 1 && (
                  <>
                    <Text style={[styles.label, { color: s.textMuted }]}>CHOOSE YOUR FLIGHT</Text>
                    {flightOptions.map((opt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.flightOptionRow, { backgroundColor: s.surface }]}
                        onPress={() => applyFlightInfo(opt)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.flightOptionRoute}>
                          <Text style={[styles.flightOptionCode, { color: s.text }]}>{opt.departure.iata}</Text>
                          <Ionicons name="arrow-forward" size={13} color={s.accent} style={{ marginHorizontal: 6 }} />
                          <Text style={[styles.flightOptionCode, { color: s.text }]}>{opt.arrival.iata}</Text>
                        </View>
                        <View style={styles.flightOptionMeta}>
                          {opt.departure.airport ? (
                            <Text style={[styles.flightOptionCity, { color: s.textMuted }]} numberOfLines={1}>
                              {opt.departure.airport} → {opt.arrival.airport}
                            </Text>
                          ) : null}
                          <View style={styles.flightOptionTimes}>
                            {opt.departure.scheduledTime ? (
                              <Text style={[styles.flightOptionTime, { color: s.textSub }]}>
                                {formatFlightTime(opt.departure.scheduledTime)}
                              </Text>
                            ) : null}
                            {opt.departure.scheduledTime && opt.arrival.scheduledTime ? (
                              <Text style={[styles.flightOptionTimeSep, { color: s.textMuted }]}>→</Text>
                            ) : null}
                            {opt.arrival.scheduledTime ? (
                              <Text style={[styles.flightOptionTime, { color: s.textSub }]}>
                                {formatFlightTime(opt.arrival.scheduledTime)}
                              </Text>
                            ) : null}
                            {opt.duration ? (
                              <Text style={[styles.flightOptionDuration, { color: s.textMuted }]}>· {opt.duration}</Text>
                            ) : null}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={s.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Error + manual route fallback */}
                {flightError !== null && (
                  <>
                    <FlightLookupError code={flightError} num={lookupNum.trim()} theme={theme} />
                    <Text style={[styles.label, { color: s.textMuted }]}>ENTER ROUTE MANUALLY</Text>
                    <View style={styles.routeRow}>
                      <TextInput
                        style={[styles.input, styles.airportInput, { backgroundColor: s.inputBg, color: s.text }]}
                        placeholder="From"
                        placeholderTextColor={s.textMuted}
                        value={fromCode}
                        onChangeText={v => { setFromCode(v); if (v.length === 3 && toCode.length >= 3) promptFlightRelationship(v, toCode); }}
                        autoCapitalize="characters"
                        maxLength={3}
                      />
                      <Ionicons name="arrow-forward" size={18} color={s.textMuted} style={{ marginTop: 12 }} />
                      <TextInput
                        style={[styles.input, styles.airportInput, { backgroundColor: s.inputBg, color: s.text }]}
                        placeholder="To"
                        placeholderTextColor={s.textMuted}
                        value={toCode}
                        onChangeText={v => { setToCode(v); if (v.length === 3 && fromCode.length >= 3) promptFlightRelationship(fromCode, v); }}
                        autoCapitalize="characters"
                        maxLength={3}
                      />
                    </View>
                    {hasRoute && (
                      <TouchableOpacity
                        style={[styles.lookupBtn, { backgroundColor: s.accent }]}
                        onPress={() => setStep('details')}
                      >
                        <Text style={styles.lookupBtnText}>Continue</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            )}

            {/* ════════════════════════════════════════
                STEP 2 — Post details
            ════════════════════════════════════════ */}
            {step === 'details' && (
              <>
                {/* Flight card preview */}
                <View style={[styles.flightPreview, { backgroundColor: s.surface }]}>
                  <View style={styles.previewRoute}>
                    <Text style={[styles.previewCode, { color: s.text }]}>{fromCode2 || '---'}</Text>
                    <View style={styles.previewArrowRow}>
                      <View style={[styles.previewLine, { backgroundColor: s.sep }]} />
                      <Ionicons name="airplane" size={16} color={s.accent} />
                      <View style={[styles.previewLine, { backgroundColor: s.sep }]} />
                    </View>
                    <Text style={[styles.previewCode, { color: s.text }]}>{toCode2 || '---'}</Text>
                  </View>
                  <View style={styles.previewMeta}>
                    <Text style={[styles.previewNum, { color: s.textSub }]}>{lookupNum || flightResult?.flightNumber || ''}</Text>
                    <Text style={[styles.previewDot, { color: s.textMuted }]}>·</Text>
                    <Text style={[styles.previewDate, { color: s.textSub }]}>{lookupDate}</Text>
                    {flightResult?.duration ? (
                      <>
                        <Text style={[styles.previewDot, { color: s.textMuted }]}>·</Text>
                        <Text style={[styles.previewDate, { color: s.textSub }]}>{flightResult.duration}</Text>
                      </>
                    ) : null}
                  </View>
                  {flightResult?.airline ? (
                    <Text style={[styles.previewAirline, { color: s.textMuted }]}>{flightResult.airline}</Text>
                  ) : null}
                </View>

                {/* Trip name — hidden when adding a return flight or a confirmed related flight */}
                {!addReturn && !relatedFlight && (
                  <>
                    <Text style={[styles.label, { color: s.textMuted }]}>TRIP NAME</Text>
                    <TextInput
                      style={[styles.input, styles.tripNameInput, { backgroundColor: s.inputBg, color: s.text }]}
                      placeholder="e.g. Tokyo trip, Summer Europe"
                      placeholderTextColor={s.textMuted}
                      value={tripName}
                      onChangeText={v => { setTripName(v); setSelectedTripId(null); }}
                      returnKeyType="done"
                      autoCapitalize="words"
                    />

                    {/* Add to existing trip */}
                    {tripOptions.length > 0 && (
                      <View style={styles.tripPickerWrap}>
                        <Text style={[styles.tripPickerLabel, { color: s.textMuted }]}>Add to existing trip</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.tripPickerScroll}
                        >
                          {tripOptions.map(opt => {
                            const active = selectedTripId === opt.id;
                            return (
                              <TouchableOpacity
                                key={opt.id}
                                style={[
                                  styles.tripChip,
                                  active
                                    ? { backgroundColor: s.accent }
                                    : { backgroundColor: s.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: s.sep },
                                ]}
                                onPress={() => {
                                  if (active) {
                                    setSelectedTripId(null);
                                    setTripName('');
                                  } else {
                                    setSelectedTripId(opt.id);
                                    setTripName(opt.name || opt.route);
                                  }
                                }}
                                activeOpacity={0.75}
                              >
                                <Ionicons
                                  name={active ? 'checkmark-circle' : 'add-circle-outline'}
                                  size={13}
                                  color={active ? '#fff' : s.textMuted}
                                />
                                <View style={{ flexShrink: 1 }}>
                                  <Text style={[styles.tripChipText, { color: active ? '#fff' : s.text }]} numberOfLines={1}>
                                    {opt.name || opt.route}
                                  </Text>
                                  {opt.name ? (
                                    <Text style={[styles.tripChipSub, { color: active ? 'rgba(255,255,255,0.6)' : s.textMuted }]} numberOfLines={1}>
                                      {opt.route}{opt.currentLocation ? ` · ${opt.currentLocation}` : ''}
                                    </Text>
                                  ) : opt.currentLocation ? (
                                    <Text style={[styles.tripChipSub, { color: active ? 'rgba(255,255,255,0.6)' : s.textMuted }]} numberOfLines={1}>
                                      in {opt.currentLocation}
                                    </Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}

                {/* Note */}
                <Text style={[styles.label, { color: s.textMuted }]}>NOTE</Text>
                <TextInput
                  style={[styles.input, styles.noteInput, { backgroundColor: s.inputBg, color: s.text }]}
                  placeholder="What's the trip about?"
                  placeholderTextColor={s.textMuted}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                />

                {/* Trip photos */}
                <Text style={[styles.label, { color: s.textMuted }]}>TRIP PHOTOS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                  <TouchableOpacity
                    style={[styles.addPhotoBtn, { borderColor: s.sep, backgroundColor: s.surface }]}
                    onPress={pickPhotos}
                  >
                    <Ionicons name="camera-outline" size={24} color={s.textMuted} />
                    <Text style={[styles.addPhotoLabel, { color: s.textMuted }]}>Add</Text>
                  </TouchableOpacity>
                  {photos.map(uri => (
                    <View key={uri} style={styles.photoItem}>
                      <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removePhoto}
                        onPress={() => setPhotos(prev => prev.filter(p => p !== uri))}
                      >
                        <Ionicons name="close" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                {/* Privacy */}
                <Text style={[styles.label, { color: s.textMuted }]}>WHO CAN SEE THIS</Text>
                <View style={[styles.privacyRow, { backgroundColor: s.inputBg }]}>
                  {PRIVACY_OPTIONS.map(opt => {
                    const active = privacy === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.privacyBtn, active && { backgroundColor: s.accent }]}
                        onPress={() => setPrivacy(opt.key)}
                      >
                        <Ionicons name={opt.icon as any} size={15} color={active ? '#fff' : s.textSub} />
                        <Text style={[styles.privacyLabel, { color: active ? '#fff' : s.textSub }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {step === 'details' && (
            <TouchableOpacity style={[styles.postBtn, { backgroundColor: s.accent }]} onPress={handlePost}>
              <Ionicons name="airplane" size={18} color="#fff" />
              <Text style={styles.postBtnText}>Post Flight</Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 60 },
  backBtnText: { fontSize: 15, fontWeight: '600' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 16 },
  returnForBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  returnForText: { fontSize: 13, fontWeight: '600', flex: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20, marginBottom: 7 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '500', marginBottom: 14 },
  flightNumInput: { fontSize: 22, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  tripNameInput: {},

  tripPickerWrap:   { marginTop: -6, marginBottom: 14 },
  tripPickerLabel:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 8 },
  tripPickerScroll: { gap: 7, paddingRight: 4 },
  tripChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    maxWidth: 180,
  },
  tripChipText: { fontSize: 13, fontWeight: '600' },
  tripChipSub:  { fontSize: 11, fontWeight: '400', marginTop: 1 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },

  // Method cards (step 1)
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  methodIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodText: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '700' },
  methodSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontWeight: '600' },

  lookupBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  lookupBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  airportInput: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', letterSpacing: 1 },

  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // Flight preview card (step 2)
  flightPreview: { borderRadius: 18, padding: 20 },
  previewRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCode: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  previewArrowRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6 },
  previewLine: { flex: 1, height: 1 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  previewNum: { fontSize: 13, fontWeight: '600' },
  previewDot: { fontSize: 13 },
  previewDate: { fontSize: 13, fontWeight: '500' },
  previewAirline: { fontSize: 12, marginTop: 4 },

  // Photos
  photoStrip: { marginTop: 4, marginBottom: 8 },
  addPhotoBtn: {
    width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4, marginRight: 8,
  },
  addPhotoLabel: { fontSize: 10, fontWeight: '600' },
  photoItem: { width: 72, height: 72, marginRight: 8, position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 14 },
  removePhoto: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },

  // Privacy
  privacyRow: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  privacyLabel: { fontSize: 13, fontWeight: '700' },

  // Date picker
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '600' },
  dateLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  todayBtn: { fontSize: 13, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1,
  },
  timeChipText: { fontSize: 13, fontWeight: '700' },

  // Multiple-flight picker
  flightOptionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
  },
  flightOptionRoute: { flexDirection: 'row', alignItems: 'center', minWidth: 90 },
  flightOptionCode: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  flightOptionMeta: { flex: 1 },
  flightOptionCity: { fontSize: 12, fontWeight: '500', marginBottom: 3 },
  flightOptionTimes: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flightOptionTime: { fontSize: 13, fontWeight: '700' },
  flightOptionTimeSep: { fontSize: 12 },
  flightOptionDuration: { fontSize: 12, fontWeight: '500' },

  postBtn: {
    margin: 20, marginTop: 8, padding: 15, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  postBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

});
