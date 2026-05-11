import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { getVisitedCountryIds } from '../data/airports';

const { width: W } = Dimensions.get('window');

interface Props {
  theme: Theme;
  isDark: boolean;
  flights: Flight[];
}

type Period = '1M' | '6M' | '1Y' | 'All';

// ── Helpers ────────────────────────────────────────────────────────────────
function parseDDMMYYYY(d: string): Date | null {
  const p = d.split('-');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

function durationToMiles(duration: string): number {
  const h = duration.match(/(\d+)h/);
  const m = duration.match(/(\d+)m/);
  const mins = (h ? parseInt(h[1]) : 0) * 60 + (m ? parseInt(m[1]) : 0);
  return Math.round((mins / 60) * 550);
}

function formatMiles(n: number): string {
  if (n === 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatHours(mins: number): string {
  if (mins === 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === '1M') return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  if (period === '6M') return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  if (period === '1Y') return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return new Date(0);
}

function prevPeriodRange(period: Period): [Date, Date] {
  const end = periodStart(period);
  const start = new Date(end);
  if (period === '1M') start.setMonth(start.getMonth() - 1);
  else if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '1Y') start.setFullYear(start.getFullYear() - 1);
  else return [new Date(0), new Date(0)];
  return [start, end];
}

function filterFlights(flights: Flight[], from: Date, to: Date = new Date()): Flight[] {
  return flights.filter(f => {
    if (f.status !== 'past') return false;
    const d = parseDDMMYYYY(f.date);
    return d && d >= from && d <= to;
  });
}

function getMonthBuckets(flights: Flight[], period: Period): { label: string; count: number }[] {
  const buckets: { label: string; count: number }[] = [];
  const now = new Date();
  const months = period === '1M' ? 4 : period === '6M' ? 6 : period === '1Y' ? 12 : 12;

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const count = flights.filter(f => {
      const fd = parseDDMMYYYY(f.date);
      return fd && fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear();
    }).length;
    buckets.push({ label, count });
  }
  return buckets;
}

function getTopRoutes(flights: Flight[], n = 5): { from: string; to: string; fromCity: string; toCity: string; count: number }[] {
  const map: Record<string, { from: string; to: string; fromCity: string; toCity: string; count: number }> = {};
  for (const f of flights) {
    const key = `${f.from.code}-${f.to.code}`;
    if (!map[key]) map[key] = { from: f.from.code, to: f.to.code, fromCity: f.from.city, toCity: f.to.city, count: 0 };
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, n);
}

const AIRLINE_NAMES: Record<string, string> = {
  AA: 'American Airlines', UA: 'United Airlines', DL: 'Delta Air Lines', WN: 'Southwest Airlines', B6: 'JetBlue Airways',
  AS: 'Alaska Airlines', NK: 'Spirit Airlines', F9: 'Frontier Airlines', G4: 'Allegiant Air', SY: 'Sun Country Airlines',
  BA: 'British Airways', LH: 'Lufthansa', AF: 'Air France', KL: 'KLM Royal Dutch', EK: 'Emirates',
  QR: 'Qatar Airways', EY: 'Etihad Airways', SQ: 'Singapore Airlines', CX: 'Cathay Pacific', QF: 'Qantas Airways',
  AC: 'Air Canada', VS: 'Virgin Atlantic', IB: 'Iberia', AZ: 'ITA Airways',
  TK: 'Turkish Airlines', LX: 'Swiss International', OS: 'Austrian Airlines', SK: 'Scandinavian Airlines', AY: 'Finnair',
  NH: 'All Nippon Airways', JL: 'Japan Airlines', KE: 'Korean Air', OZ: 'Asiana Airlines',
  CA: 'Air China', MU: 'China Eastern Airlines', CZ: 'China Southern Airlines',
  TG: 'Thai Airways', MH: 'Malaysia Airlines', GA: 'Garuda Indonesia', SV: 'Saudia',
  AM: 'Aeroméxico', LA: 'LATAM Airlines', G3: 'Gol Linhas Aéreas', AD: 'Azul Brazilian Airlines',
  FR: 'Ryanair', U2: 'easyJet', VY: 'Vueling', W6: 'Wizz Air', PC: 'Pegasus Airlines',
  MS: 'EgyptAir', AT: 'Royal Air Maroc', ET: 'Ethiopian Airlines', KQ: 'Kenya Airways',
  AI: 'Air India', UK: 'Vistara', '6E': 'IndiGo', SG: 'SpiceJet',
};

function airlineCode(flightNum: string): string {
  const match = flightNum.trim().match(/^([A-Z0-9]{2})/i);
  return match ? match[1].toUpperCase() : '';
}

function getTopAirlines(flights: Flight[], sortBy: 'count' | 'miles', n = 5): { code: string; name: string; count: number; miles: number }[] {
  const map: Record<string, { code: string; name: string; count: number; miles: number }> = {};
  for (const f of flights) {
    if (!f.flightNum) continue;
    const code = airlineCode(f.flightNum);
    if (!code) continue;
    const name = AIRLINE_NAMES[code] ?? code;
    if (!map[code]) map[code] = { code, name, count: 0, miles: 0 };
    map[code].count++;
    if (f.duration) map[code].miles += durationToMiles(f.duration);
  }
  return Object.values(map).sort((a, b) => b[sortBy] - a[sortBy]).slice(0, n);
}

function durationToMins(duration: string): number {
  const h = duration.match(/(\d+)h/); const m = duration.match(/(\d+)m/);
  return (h ? parseInt(h[1]) : 0) * 60 + (m ? parseInt(m[1]) : 0);
}

function getFlightRecords(flights: Flight[]): {
  longest: Flight | null; shortest: Flight | null;
} {
  const withDuration = flights.filter(f => f.duration && durationToMins(f.duration) > 0);
  if (!withDuration.length) return { longest: null, shortest: null };
  const sorted = [...withDuration].sort((a, b) => durationToMins(b.duration) - durationToMins(a.duration));
  return { longest: sorted[0], shortest: sorted[sorted.length - 1] };
}

function getTopAirports(flights: Flight[], n = 5): { code: string; city: string; count: number }[] {
  const map: Record<string, { code: string; city: string; count: number }> = {};
  for (const f of flights) {
    for (const ap of [{ code: f.from.code, city: f.from.city }, { code: f.to.code, city: f.to.city }]) {
      if (!map[ap.code]) map[ap.code] = { code: ap.code, city: ap.city, count: 0 };
      map[ap.code].count++;
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, n);
}

// ── Bar chart ──────────────────────────────────────────────────────────────
function BarChart({ buckets, accent }: { buckets: { label: string; count: number }[]; accent: string }) {
  const max = Math.max(...buckets.map(b => b.count), 1);
  const BAR_H = 100;

  return (
    <View style={chart.wrap}>
      {/* Bars */}
      <View style={chart.barsRow}>
        {buckets.map((b, i) => (
          <View key={i} style={chart.barCol}>
            <Text style={chart.countLabel}>{b.count > 0 ? b.count : ''}</Text>
            <View style={[chart.barBg, { height: BAR_H }]}>
              <View
                style={[
                  chart.barFill,
                  {
                    height: (b.count / max) * BAR_H,
                    backgroundColor: accent,
                    opacity: b.count === 0 ? 0 : 0.85 + (b.count / max) * 0.15,
                  },
                ]}
              />
            </View>
            <Text style={chart.barLabel}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Trend badge ────────────────────────────────────────────────────────────
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <Text style={[badge.text, { color: up ? '#34d399' : '#f87171' }]}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </Text>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function DiscoverScreen({ theme, isDark, flights }: Props) {
  const [period, setPeriod] = useState<Period>('1Y');
  const periods: Period[] = ['1M', '6M', '1Y', 'All'];
  const [airlineMetric, setAirlineMetric] = useState<'count' | 'miles'>('count');

  const glassCard = {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  };

  const pastFlights = useMemo(() => flights.filter(f => f.status === 'past'), [flights]);

  const start = useMemo(() => periodStart(period), [period]);
  const current = useMemo(() => filterFlights(flights, start), [flights, start]);
  const [prevStart, prevEnd] = useMemo(() => prevPeriodRange(period), [period]);
  const previous = useMemo(() => filterFlights(flights, prevStart, prevEnd), [flights, prevStart, prevEnd]);

  const currentMiles = useMemo(() => current.reduce((s, f) => s + (f.duration ? durationToMiles(f.duration) : 0), 0), [current]);
  const previousMiles = useMemo(() => previous.reduce((s, f) => s + (f.duration ? durationToMiles(f.duration) : 0), 0), [previous]);

  const allCodes = useMemo(() => pastFlights.flatMap(f => [f.from.code, f.to.code]), [pastFlights]);
  const currentCodes = useMemo(() => current.flatMap(f => [f.from.code, f.to.code]), [current]);
  const previousCodes = useMemo(() => previous.flatMap(f => [f.from.code, f.to.code]), [previous]);

  const currentCountries = useMemo(() => new Set(getVisitedCountryIds(currentCodes)).size, [currentCodes]);
  const previousCountries = useMemo(() => new Set(getVisitedCountryIds(previousCodes)).size, [previousCodes]);

  const currentAirports = useMemo(() => new Set(currentCodes).size, [currentCodes]);
  const previousAirports = useMemo(() => new Set(previousCodes).size, [previousCodes]);

  const currentAirportMins = useMemo(() => current.reduce((s, f) => s + (f.airportMinutes ?? 0), 0), [current]);
  const previousAirportMins = useMemo(() => previous.reduce((s, f) => s + (f.airportMinutes ?? 0), 0), [previous]);

  const periodFlights = period === 'All' ? pastFlights : current;

  const totalAirportMins = useMemo(() =>
    periodFlights.reduce((s, f) => s + (f.airportMinutes ?? 0), 0),
    [periodFlights]
  );
  const buckets = useMemo(() => getMonthBuckets(periodFlights, period), [periodFlights, period]);
  const topRoutes = useMemo(() => getTopRoutes(periodFlights), [periodFlights]);
  const topAirports = useMemo(() => getTopAirports(periodFlights), [periodFlights]);
  const topAirlines = useMemo(() => getTopAirlines(periodFlights, airlineMetric), [periodFlights, airlineMetric]);
  const { longest, shortest } = useMemo(() => getFlightRecords(periodFlights), [periodFlights]);
  const maxAirportCount = topAirports[0]?.count ?? 1;
  const maxAirlineVal = airlineMetric === 'count' ? (topAirlines[0]?.count ?? 1) : (topAirlines[0]?.miles ?? 1);

  const totalFlights = periodFlights.length;
  const totalMilesVal = periodFlights.reduce((s, f) => s + (f.duration ? durationToMiles(f.duration) : 0), 0);

  const currentFlightMins = useMemo(() => current.reduce((s, f) => s + (f.duration ? durationToMins(f.duration) : 0), 0), [current]);
  const previousFlightMins = useMemo(() => previous.reduce((s, f) => s + (f.duration ? durationToMins(f.duration) : 0), 0), [previous]);
  const totalFlightMins = useMemo(() => periodFlights.reduce((s, f) => s + (f.duration ? durationToMins(f.duration) : 0), 0), [periodFlights]);

  return (
    <SafeAreaView edges={['top']} style={[s.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: theme.text }]}>Insights</Text>
        </View>

        {/* Period filter */}
        <View style={s.periodRow}>
          {periods.map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodChip, glassCard, period === p && { backgroundColor: theme.accent, borderColor: theme.accent }]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.75}
            >
              <Text style={[s.periodText, { color: period === p ? '#fff' : theme.textMuted }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary — single card */}
        <View style={[sc.card, glassCard]}>

          {/* PRIMARY — Flights */}
          <View style={sc.primaryRow}>
            <Text style={[sc.primaryLabel, { color: theme.textMuted }]}>FLIGHTS</Text>
            <View style={sc.primaryValueRow}>
              <Text style={[sc.primaryValue, { color: theme.text }]}>{totalFlights}</Text>
              {period !== 'All' && <TrendBadge current={current.length} previous={previous.length} />}
            </View>
          </View>

          <View style={[sc.dividerH, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

          {/* SECONDARY — Miles + Countries */}
          <View style={sc.row}>
            <StatCell size="tertiary" label="Miles" value={formatMiles(totalMilesVal)} theme={theme} current={period === 'All' ? -1 : currentMiles} previous={previousMiles} />
            <View style={[sc.dividerV, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <StatCell size="tertiary" label="Countries" value={String(period === 'All' ? new Set(getVisitedCountryIds(allCodes)).size : currentCountries)} theme={theme} current={period === 'All' ? -1 : currentCountries} previous={previousCountries} />
          </View>

          <View style={[sc.dividerH, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

          {/* TERTIARY — Airports, Flight time, Airport time */}
          <View style={sc.row}>
            <StatCell size="tertiary" label="Airports" value={String(period === 'All' ? new Set(allCodes).size : currentAirports)} theme={theme} current={period === 'All' ? -1 : currentAirports} previous={previousAirports} />
            <View style={[sc.dividerV, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <StatCell size="tertiary" label="Flight time" value={totalFlightMins > 0 ? formatHours(totalFlightMins) : 'No data'} theme={theme} current={period === 'All' ? -1 : currentFlightMins} previous={previousFlightMins} />
            <View style={[sc.dividerV, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <StatCell size="tertiary" label="Airport time" value={totalAirportMins > 0 ? formatHours(totalAirportMins) : 'No data'} theme={theme} current={period === 'All' ? -1 : currentAirportMins} previous={previousAirportMins} />
          </View>

        </View>

        {/* Flights over time */}
        <View style={[s.section, glassCard]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Flights over time</Text>
            <Text style={[s.sectionSub, { color: theme.textMuted }]}>by month</Text>
          </View>
          {totalFlights === 0 ? (
            <Text style={[s.empty, { color: theme.textMuted }]}>No flights logged yet</Text>
          ) : (
            <BarChart buckets={buckets} accent={theme.accent} />
          )}
        </View>

        {/* Top routes */}
        {topRoutes.length > 0 && (
          <View style={[s.section, glassCard]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Top routes</Text>
            </View>
            {topRoutes.map((r, i) => (
              <View key={i} style={[s.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[s.listRank, { color: theme.textMuted }]}>{i + 1}</Text>
                <View style={s.listMain}>
                  <Text style={[s.routeCode, { color: theme.text }]}>
                    {r.from} <Text style={{ color: theme.accent }}>›</Text> {r.to}
                  </Text>
                  <Text style={[s.listSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {r.fromCity} → {r.toCity}
                  </Text>
                </View>
                <Text style={[s.listCount, { color: theme.textSub }]}>
                  {r.count}×
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Top airports */}
        {topAirports.length > 0 && (
          <View style={[s.section, glassCard]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Most visited airports</Text>
            </View>
            {topAirports.map((ap, i) => (
              <View key={i} style={[s.airportRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                <View style={s.airportLeft}>
                  <Text style={[s.airportCode, { color: theme.text }]}>{ap.code}</Text>
                  <Text style={[s.listSub, { color: theme.textMuted }]}>{ap.city}</Text>
                </View>
                <View style={s.barWrap}>
                  <View style={[s.airportBar, { backgroundColor: theme.accent, width: `${Math.round((ap.count / maxAirportCount) * 100)}%`, opacity: 0.75 + (ap.count / maxAirportCount) * 0.25 }]} />
                </View>
                <Text style={[s.listCount, { color: theme.textSub }]}>{ap.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top airlines */}
        {topAirlines.length > 0 && (
          <View style={[s.section, glassCard]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Top airlines</Text>
              <View style={al.toggle}>
                {(['count', 'miles'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[al.toggleBtn, airlineMetric === m && { backgroundColor: theme.accent }]}
                    onPress={() => setAirlineMetric(m)}
                    activeOpacity={0.75}
                  >
                    <Text style={[al.toggleText, { color: airlineMetric === m ? '#fff' : theme.textMuted }]}>
                      {m === 'count' ? 'Flights' : 'Miles'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {topAirlines.map((airline, i) => {
              const val = airlineMetric === 'count' ? airline.count : airline.miles;
              const pct = Math.round((val / maxAirlineVal) * 100);
              const displayVal = airlineMetric === 'count' ? `${airline.count}×` : formatMiles(airline.miles);
              return (
                <View key={airline.code} style={[s.airportRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                  <View style={al.nameCol}>
                    <Text style={[al.airlineName, { color: theme.text }]} numberOfLines={1}>{airline.name}</Text>
                  </View>
                  <View style={s.barWrap}>
                    <View style={[s.airportBar, { backgroundColor: theme.accent, width: `${pct}%`, opacity: 0.75 + (pct / 100) * 0.25 }]} />
                  </View>
                  <Text style={[s.listCount, { color: theme.textSub }]}>{displayVal}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Flight records */}
        {(longest || shortest) && (
          <View style={[s.section, glassCard]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Flight records</Text>
            </View>
            {longest && (
              <RecordRow
                label="Longest flight"
                flight={longest}
                theme={theme}
                icon="trending-up-outline"
                accent={theme.accent}
                sep={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                first
              />
            )}
            {shortest && shortest.id !== longest?.id && (
              <RecordRow
                label="Shortest flight"
                flight={shortest}
                theme={theme}
                icon="trending-down-outline"
                accent={theme.textMuted}
                sep={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                first={false}
              />
            )}
          </View>
        )}

        {flights.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="bar-chart-outline" size={52} color={theme.textMuted} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>No data yet</Text>
            <Text style={[s.emptySub, { color: theme.textMuted }]}>Log your first flight to see insights</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Record row ─────────────────────────────────────────────────────────────
function RecordRow({ label, flight, theme, icon, accent, sep, first }: {
  label: string; flight: Flight; theme: Theme;
  icon: string; accent: string; sep: string; first: boolean;
}) {
  return (
    <View style={[rr.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sep }]}>
      <View style={[rr.iconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon as any} size={16} color={accent} />
      </View>
      <View style={rr.info}>
        <Text style={[rr.label, { color: theme.textMuted }]}>{label.toUpperCase()}</Text>
        <Text style={[rr.route, { color: theme.text }]}>
          {flight.from.code} <Text style={{ color: accent }}>›</Text> {flight.to.code}
        </Text>
        {flight.from.city || flight.to.city ? (
          <Text style={[rr.cities, { color: theme.textMuted }]} numberOfLines={1}>
            {flight.from.city} → {flight.to.city}
          </Text>
        ) : null}
      </View>
      <Text style={[rr.duration, { color: theme.text }]}>{flight.duration}</Text>
    </View>
  );
}

const al = StyleSheet.create({
  toggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', gap: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  toggleText: { fontSize: 11, fontWeight: '700' },
  nameCol: { flex: 1, marginRight: 10 },
  airlineName: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
});

const rr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 3 },
  route: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  cities: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  duration: { fontSize: 15, fontWeight: '700' },
});

// ── Stat cell (inside unified card) ───────────────────────────────────────
function StatCell({ label, value, theme, current, previous, size }: {
  label: string; value: string;
  theme: Theme; current: number; previous: number;
  size: 'secondary' | 'tertiary';
}) {
  const valueStyle = size === 'secondary' ? sc.secondaryValue : sc.tertiaryValue;
  const labelStyle = size === 'secondary' ? sc.secondaryLabel : sc.tertiaryLabel;
  return (
    <View style={sc.cell}>
      <Text style={[labelStyle, { color: theme.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[valueStyle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {current >= 0 && <TrendBadge current={current} previous={previous} />}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  header: { paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  periodRow: {
    flexDirection: 'row', gap: 8, marginVertical: 16,
  },
  periodChip: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
  },
  periodText: { fontSize: 13, fontWeight: '700' },

  section: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, fontWeight: '500' },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
  },
  listRank: { fontSize: 13, fontWeight: '700', width: 18, textAlign: 'center' },
  listMain: { flex: 1 },
  routeCode: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  listSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  listCount: { fontSize: 14, fontWeight: '700' },

  airportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
  },
  airportLeft: { width: 80 },
  airportCode: { fontSize: 15, fontWeight: '800' },
  barWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  airportBar: { height: 6, borderRadius: 3 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

const sc = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', marginBottom: 14 },

  // Primary
  primaryRow: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  primaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  primaryValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  primaryValue: { fontSize: 56, fontWeight: '900', letterSpacing: -2.5, lineHeight: 60 },

  // Secondary (now same size as tertiary per user request)
  row: { flexDirection: 'row' },
  cell: { flex: 1, paddingVertical: 18, paddingHorizontal: 18 },
  secondaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
  secondaryValue: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },

  // Tertiary
  tertiaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  tertiaryValue: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },

  dividerV: { width: StyleSheet.hairlineWidth },
  dividerH: { height: StyleSheet.hairlineWidth },
});

const badge = StyleSheet.create({
  text: { fontSize: 12, fontWeight: '700' },
});

const chart = StyleSheet.create({
  wrap: { paddingTop: 4 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  countLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(128,128,128,0.7)', minHeight: 12 },
  barBg: { width: '100%', justifyContent: 'flex-end', backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 4 },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(128,128,128,0.7)' },
});
