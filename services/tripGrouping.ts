import { Flight } from '../data/mockData';

// ── Trip type ──────────────────────────────────────────────────────────────
export interface Trip {
  id: string;
  name?: string;
  legs: Flight[];
  primaryDestination: string;
  primaryDestinationCity: string;
  departedAt: string;              // DD-MM-YYYY
  returnedAt: string | null;       // DD-MM-YYYY; null = in-progress
  homeAirport: string;
  totalDays: number;
  totalFlights: number;
  inProgress: boolean;
  airportSequence: string[];
  confidence: 'high' | 'medium' | 'low';
}

// ── Metro groups ───────────────────────────────────────────────────────────
// Maps each airport code → canonical metro ID.
const METRO: Record<string, string> = {
  // New York
  JFK: 'NYC', LGA: 'NYC', EWR: 'NYC', HPN: 'NYC', ISP: 'NYC',
  // Los Angeles
  LAX: 'LAX', BUR: 'LAX', SNA: 'LAX', LGB: 'LAX', ONT: 'LAX', VNY: 'LAX',
  // San Francisco / Bay Area
  SFO: 'SFO', OAK: 'SFO', SJC: 'SFO',
  // Chicago
  ORD: 'CHI', MDW: 'CHI',
  // Dallas
  DFW: 'DFW', DAL: 'DFW',
  // Washington DC
  IAD: 'WAS', DCA: 'WAS', BWI: 'WAS',
  // Miami
  MIA: 'MIA', FLL: 'MIA', PBI: 'MIA',
  // Houston
  IAH: 'HOU', HOU: 'HOU',
  // Seattle
  SEA: 'SEA', BFI: 'SEA',
  // Boston
  BOS: 'BOS', PVD: 'BOS', MHT: 'BOS',
  // Phoenix
  PHX: 'PHX', AZA: 'PHX',
  // London
  LHR: 'LON', LGW: 'LON', STN: 'LON', LCY: 'LON', LTN: 'LON',
  // Paris
  CDG: 'PAR', ORY: 'PAR',
  // Amsterdam
  AMS: 'AMS', EIN: 'AMS',
  // Frankfurt
  FRA: 'FRA', HHN: 'FRA',
  // Tokyo
  NRT: 'TYO', HND: 'TYO',
  // Osaka
  KIX: 'OSA', ITM: 'OSA',
  // Sydney
  SYD: 'SYD', BNK: 'SYD',
  // Rome
  FCO: 'ROM', CIA: 'ROM',
  // Milan
  MXP: 'MIL', LIN: 'MIL', BGY: 'MIL',
  // Toronto
  YYZ: 'YTO', YTZ: 'YTO',
};

// ── Airport coordinates [lat, lon] ─────────────────────────────────────────
const COORDS: Record<string, [number, number]> = {
  // United States
  JFK: [40.641, -73.778],  LGA: [40.777, -73.873],  EWR: [40.690, -74.174],
  LAX: [33.943, -118.408], BUR: [34.200, -118.359],  SNA: [33.676, -117.868],
  LGB: [33.818, -118.152], ONT: [34.056, -117.601],
  SFO: [37.619, -122.375], OAK: [37.721, -122.221],  SJC: [37.363, -121.929],
  SEA: [47.449, -122.309], BFI: [47.530, -122.302],
  ORD: [41.980, -87.905],  MDW: [41.786, -87.752],
  DFW: [32.897, -97.038],  DAL: [32.847, -96.852],
  IAD: [38.945, -77.456],  DCA: [38.852, -77.038],   BWI: [39.175, -76.669],
  MIA: [25.796, -80.287],  FLL: [26.073, -80.150],   PBI: [26.683, -80.095],
  IAH: [29.985, -95.342],  HOU: [29.645, -95.279],
  BOS: [42.365, -71.010],  PVD: [41.724, -71.428],
  PHX: [33.438, -112.008], AZA: [33.308, -111.655],
  ATL: [33.641, -84.427],  DEN: [39.856, -104.674],
  LAS: [36.080, -115.152], SAN: [32.734, -117.190],
  PDX: [45.589, -122.598], SLC: [40.788, -111.978],
  AUS: [30.198, -97.670],  MSP: [44.882, -93.222],
  DTW: [42.212, -83.353],  PHL: [39.872, -75.241],
  CLT: [35.214, -80.943],  MCO: [28.429, -81.309],
  TPA: [27.976, -82.533],  MSY: [29.993, -90.258],
  BNA: [36.124, -86.678],  STL: [38.748, -90.370],
  MCI: [39.298, -94.714],  OMA: [41.303, -95.894],
  RDU: [35.877, -78.787],  PIT: [40.492, -80.233],
  HNL: [21.318, -157.922], OGG: [20.900, -156.430],
  KOA: [19.739, -156.046], LIH: [21.976, -159.339],
  ANC: [61.174, -149.996],
  // Canada
  YYZ: [43.677, -79.631],  YUL: [45.469, -73.741],
  YVR: [49.195, -123.184], YYC: [51.131, -114.013],
  // Europe
  LHR: [51.477, -0.461],   LGW: [51.148, -0.190],
  STN: [51.885, 0.235],    LCY: [51.505, 0.055],   LTN: [51.874, -0.368],
  CDG: [49.009, 2.548],    ORY: [48.724, 2.380],
  AMS: [52.308, 4.764],    FRA: [50.033, 8.571],
  MUC: [48.354, 11.786],   BER: [52.366, 13.503],
  ZRH: [47.464, 8.549],    VIE: [48.111, 16.570],
  FCO: [41.800, 12.238],   MXP: [45.630, 8.723],
  BCN: [41.297, 2.083],    MAD: [40.472, -3.561],
  LIS: [38.774, -9.134],   CPH: [55.618, 12.656],
  ARN: [59.651, 17.919],   OSL: [60.194, 11.100],
  HEL: [60.317, 24.963],   WAW: [52.166, 20.967],
  PRG: [50.101, 14.260],   BUD: [47.437, 19.256],
  ATH: [37.937, 23.945],   IST: [41.275, 28.752],
  // Middle East
  DXB: [25.253, 55.365],   AUH: [24.433, 54.651],  DOH: [25.273, 51.608],
  // Asia
  NRT: [35.764, 140.386],  HND: [35.554, 139.781],
  KIX: [34.427, 135.244],  ICN: [37.469, 126.451],
  PVG: [31.143, 121.802],  PEK: [40.080, 116.585],
  HKG: [22.309, 113.915],  SIN: [1.364, 103.991],
  BKK: [13.681, 100.747],  KUL: [2.746, 101.710],
  DEL: [28.556, 77.100],   BOM: [19.093, 72.875],
  MNL: [14.509, 121.020],
  // Australia / Pacific
  SYD: [-33.946, 151.177], MEL: [-37.673, 144.843],
  BNE: [-27.384, 153.118], PER: [-31.940, 115.967],
  AKL: [-37.008, 174.792], NAN: [-17.755, 177.443],
  // Latin America
  MEX: [19.436, -99.072],  GDL: [20.522, -103.310],
  CUN: [21.036, -86.877],  GRU: [-23.432, -46.469],
  EZE: [-34.822, -58.536], SCL: [-33.393, -70.786],
  BOG: [4.702, -74.147],   LIM: [-12.022, -77.114],
  PTY: [9.071, -79.383],
};

// ── Geographic helpers ─────────────────────────────────────────────────────
function haversineKm(a: string, b: string): number {
  const ca = COORDS[a];
  const cb = COORDS[b];
  if (!ca || !cb) return Infinity;
  const R = 6371;
  const dLat = (cb[0] - ca[0]) * Math.PI / 180;
  const dLon = (cb[1] - ca[1]) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const x = sinLat * sinLat +
    Math.cos(ca[0] * Math.PI / 180) * Math.cos(cb[0] * Math.PI / 180) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** True if two airports serve the same metro area (within ~80 km or same metro group). */
function isSameMetro(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ma = METRO[a], mb = METRO[b];
  if (ma && mb && ma === mb) return true;
  return haversineKm(a, b) <= 80;
}

// ── Date helpers ───────────────────────────────────────────────────────────
function parseDDMMYYYY(d: string): number {
  const p = d.split('-');
  if (p.length !== 3) return 0;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(parseDDMMYYYY(b) - parseDDMMYYYY(a)) / 86_400_000;
}

// ── Trip building helpers ──────────────────────────────────────────────────
function buildAirportSequence(legs: Flight[]): string[] {
  const seq: string[] = [];
  for (const leg of legs) {
    if (seq.length === 0 || seq[seq.length - 1] !== leg.from.code) seq.push(leg.from.code);
    if (seq[seq.length - 1] !== leg.to.code) seq.push(leg.to.code);
  }
  return seq;
}

function inferPrimaryDestination(legs: Flight[], home: string): { code: string; city: string } {
  if (legs.length === 1) return legs[0].to;
  const stays = new Map<string, { city: string; ms: number }>();
  for (let i = 0; i < legs.length - 1; i++) {
    const airport = legs[i].to.code;
    if (isSameMetro(airport, home)) continue;
    const city = legs[i].to.city;
    const stay = parseDDMMYYYY(legs[i + 1].date) - parseDDMMYYYY(legs[i].date);
    if (stay >= 0) {
      const prev = stays.get(airport) ?? { city, ms: 0 };
      stays.set(airport, { city, ms: prev.ms + stay });
    }
  }
  if (stays.size === 0) return legs[legs.length - 1].to;
  let bestCode = '', bestCity = '', bestMs = -1;
  for (const [code, { city, ms }] of stays) {
    if (ms > bestMs) { bestMs = ms; bestCode = code; bestCity = city; }
  }
  return { code: bestCode, city: bestCity };
}

function buildTrip(
  legs: Flight[],
  home: string,
  returnedAt: string | null,
  confidence: Trip['confidence'],
): Trip {
  const primary = inferPrimaryDestination(legs, home);
  const firstMs = parseDDMMYYYY(legs[0].date);
  const lastMs  = parseDDMMYYYY(legs[legs.length - 1].date);
  const totalDays = Math.max(1, Math.round((lastMs - firstMs) / 86_400_000) + 1);
  return {
    id: `trip_${legs[0].id}`,
    legs,
    primaryDestination: primary.code,
    primaryDestinationCity: primary.city,
    departedAt: legs[0].date,
    returnedAt,
    homeAirport: home,
    totalDays,
    totalFlights: legs.length,
    inProgress: returnedAt === null,
    airportSequence: buildAirportSequence(legs),
    confidence,
  };
}

// ── Merge decision ─────────────────────────────────────────────────────────
/**
 * Decide whether `nextFlight` continues the current trip or starts a new one.
 *
 * Returns: 'merge' | 'split', plus the confidence level to assign to the
 * current trip if a split occurs.
 */
function mergeDecision(
  currentLegs: Flight[],
  nextFlight: Flight,
  remainingFlights: Flight[], // flights AFTER nextFlight, already sorted
  home: string,
): { action: 'merge' | 'split'; closedConfidence: Trip['confidence'] } {
  const last          = currentLegs[currentLegs.length - 1];
  const lastArrival   = last.to.code;
  const nextDeparture = nextFlight.from.code;
  const nextDest      = nextFlight.to.code;
  const tripOrigin    = currentLegs[0].from.code;
  const gap           = daysBetween(last.date, nextFlight.date);

  // ── Rule 1: next flight departs from home metro → always close & start fresh
  if (isSameMetro(nextDeparture, home)) {
    return { action: 'split', closedConfidence: 'high' };
  }

  // ── Rule 2: geographic discontinuity ("teleport") → split
  // The traveler arrived at lastArrival but is somehow departing from a
  // completely different place. This signals missing legs or a new trip.
  if (!isSameMetro(lastArrival, nextDeparture)) {
    return { action: 'split', closedConfidence: 'low' };
  }

  // ── Rule 3: short gap (layover / same-day connection) → always merge
  if (gap <= 1) {
    return { action: 'merge', closedConfidence: 'high' };
  }

  // ── Rule 4: lookahead — does any future flight (within 90 days) return
  //    to the trip origin or home metro? If yes, this is a multi-city trip.
  const tripOriginMs = parseDDMMYYYY(nextFlight.date);
  const returnsHome  = remainingFlights.some(f => {
    if (parseDDMMYYYY(f.date) - tripOriginMs > 90 * 86_400_000) return false;
    return isSameMetro(f.to.code, home) || isSameMetro(f.to.code, tripOrigin);
  });
  if (returnsHome) {
    return { action: 'merge', closedConfidence: 'medium' };
  }

  // ── Rule 5: direction check — is nextDest moving farther from the trip
  //    origin than the current location? If so, this looks like a new trip.
  const distCurrent = haversineKm(tripOrigin, lastArrival);
  const distNext    = haversineKm(tripOrigin, nextDest);

  // Only apply when we have real coordinates for both points
  if (distCurrent !== Infinity && distNext !== Infinity) {
    if (distNext > distCurrent * 1.25 && gap > 3) {
      // Moving meaningfully farther from origin — likely a new trip
      return { action: 'split', closedConfidence: 'medium' };
    }
  }

  // ── Default: large gap but no strong signal → merge (user can rename/split manually)
  return { action: 'merge', closedConfidence: 'medium' };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Infer the user's home airport as the airport that most frequently appears
 * as both a departure AND arrival point (round-trip frequency).
 */
export function inferHomeAirport(flights: Flight[]): string {
  if (flights.length === 0) return '';
  const fromFreq = new Map<string, number>();
  const toFreq   = new Map<string, number>();
  for (const f of flights) {
    fromFreq.set(f.from.code, (fromFreq.get(f.from.code) ?? 0) + 1);
    toFreq.set(f.to.code, (toFreq.get(f.to.code) ?? 0) + 1);
  }
  // Score = frequency as departure + frequency as arrival; home airports appear in both roles
  const all = new Set([...fromFreq.keys(), ...toFreq.keys()]);
  let best = '', bestScore = 0;
  for (const code of all) {
    const score = (fromFreq.get(code) ?? 0) + (toFreq.get(code) ?? 0);
    if (score > bestScore) { bestScore = score; best = code; }
  }
  return best;
}

/**
 * Group a user's flights into trips using geo-aware continuity rules:
 *
 * - Flights connect if the next departure is in the same metro as the last arrival.
 * - Short gaps (≤1 day) are always treated as layovers.
 * - Lookahead determines whether a multi-day connection is part of a multi-city trip.
 * - Direction analysis catches "drifting away from home" patterns.
 *
 * Returns trips sorted newest-first.
 */
export function syncTripsForUser(flights: Flight[], homeAirport: string): Trip[] {
  if (!homeAirport || flights.length === 0) return [];

  const sorted = [...flights].sort((a, b) => parseDDMMYYYY(a.date) - parseDDMMYYYY(b.date));

  const trips: Trip[] = [];
  let currentLegs: Flight[] = [];
  let pendingConfidence: Trip['confidence'] = 'high';

  for (let i = 0; i < sorted.length; i++) {
    const flight = sorted[i];

    if (currentLegs.length === 0) {
      currentLegs.push(flight);
    } else {
      const remaining = sorted.slice(i + 1);
      const { action, closedConfidence } = mergeDecision(
        currentLegs, flight, remaining, homeAirport,
      );

      if (action === 'split') {
        trips.push(buildTrip(currentLegs, homeAirport, null, closedConfidence));
        currentLegs = [flight];
        pendingConfidence = 'high';
      } else {
        currentLegs.push(flight);
      }
    }

    // Close the current trip when this leg arrives at the home metro
    if (isSameMetro(flight.to.code, homeAirport)) {
      trips.push(buildTrip(currentLegs, homeAirport, flight.date, 'high'));
      currentLegs = [];
      pendingConfidence = 'high';
    }
  }

  // Remaining legs = open/in-progress trip
  if (currentLegs.length > 0) {
    trips.push(buildTrip(currentLegs, homeAirport, null, pendingConfidence));
  }

  return trips.sort((a, b) => parseDDMMYYYY(b.departedAt) - parseDDMMYYYY(a.departedAt));
}
