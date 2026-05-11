// Airport time tracking — requires a native build (expo run:ios / eas build).
// All functions are instant no-ops in Expo Go.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../lib/supabase';
import { Flight } from '../data/mockData';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const TASK_NAME = 'flair-airport-tracking';
const RADIUS_KM = 2.5;
const FLIGHTS_KEY = 'airport_tracker_flights';
const USER_KEY = 'airport_tracker_user';

export const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  ATL: { lat: 33.6407, lng: -84.4277 }, LAX: { lat: 33.9425, lng: -118.4081 },
  ORD: { lat: 41.9742, lng: -87.9073 }, DFW: { lat: 32.8998, lng: -97.0403 },
  DEN: { lat: 39.8561, lng: -104.6737 }, JFK: { lat: 40.6413, lng: -73.7781 },
  SFO: { lat: 37.6213, lng: -122.3790 }, SEA: { lat: 47.4502, lng: -122.3088 },
  LAS: { lat: 36.0840, lng: -115.1537 }, MCO: { lat: 28.4312, lng: -81.3081 },
  MIA: { lat: 25.7959, lng: -80.2870 }, CLT: { lat: 35.2140, lng: -80.9431 },
  EWR: { lat: 40.6895, lng: -74.1745 }, PHX: { lat: 33.4373, lng: -112.0078 },
  IAH: { lat: 29.9902, lng: -95.3368 }, BOS: { lat: 42.3656, lng: -71.0096 },
  MSP: { lat: 44.8848, lng: -93.2223 }, LGA: { lat: 40.7769, lng: -73.8740 },
  DTW: { lat: 42.2162, lng: -83.3554 }, PHL: { lat: 39.8729, lng: -75.2437 },
  SLC: { lat: 40.7884, lng: -111.9778 }, DCA: { lat: 38.8512, lng: -77.0402 },
  SAN: { lat: 32.7338, lng: -117.1933 }, BWI: { lat: 39.1754, lng: -76.6684 },
  TPA: { lat: 27.9755, lng: -82.5332 }, AUS: { lat: 30.1975, lng: -97.6664 },
  BNA: { lat: 36.1263, lng: -86.6774 }, HNL: { lat: 21.3245, lng: -157.9251 },
  PDX: { lat: 45.5898, lng: -122.5951 }, IAD: { lat: 38.9531, lng: -77.4565 },
  MSY: { lat: 29.9934, lng: -90.2580 }, RDU: { lat: 35.8776, lng: -78.7875 },
  OAK: { lat: 37.7213, lng: -122.2208 }, SJC: { lat: 37.3626, lng: -121.9290 },
  SMF: { lat: 38.6954, lng: -121.5908 }, CLE: { lat: 41.4117, lng: -81.8498 },
  MCI: { lat: 39.2976, lng: -94.7139 }, OGG: { lat: 20.8986, lng: -156.4305 },
  IND: { lat: 39.7173, lng: -86.2944 }, CMH: { lat: 39.9980, lng: -82.8919 },
  STL: { lat: 38.7487, lng: -90.3700 }, PIT: { lat: 40.4915, lng: -80.2329 },
  YYZ: { lat: 43.6777, lng: -79.6248 }, YVR: { lat: 49.1967, lng: -123.1815 },
  YUL: { lat: 45.4706, lng: -73.7408 }, YYC: { lat: 51.1315, lng: -114.0106 },
  LHR: { lat: 51.4700, lng: -0.4543 }, CDG: { lat: 49.0097, lng: 2.5479 },
  AMS: { lat: 52.3105, lng: 4.7683 }, FRA: { lat: 50.0379, lng: 8.5622 },
  MAD: { lat: 40.4936, lng: -3.5668 }, BCN: { lat: 41.2971, lng: 2.0785 },
  FCO: { lat: 41.8003, lng: 12.2389 }, MUC: { lat: 48.3537, lng: 11.7750 },
  LGW: { lat: 51.1537, lng: -0.1821 }, ZRH: { lat: 47.4647, lng: 8.5492 },
  VIE: { lat: 48.1103, lng: 16.5697 }, CPH: { lat: 55.6180, lng: 12.6508 },
  OSL: { lat: 60.1939, lng: 11.1004 }, ARN: { lat: 59.6519, lng: 17.9186 },
  HEL: { lat: 60.3172, lng: 24.9633 }, LIS: { lat: 38.7813, lng: -9.1359 },
  ATH: { lat: 37.9364, lng: 23.9445 }, IST: { lat: 41.2608, lng: 28.7418 },
  DUB: { lat: 53.4213, lng: -6.2700 }, BRU: { lat: 50.9010, lng: 4.4844 },
  GVA: { lat: 46.2380, lng: 6.1089 }, PRG: { lat: 50.1008, lng: 14.2600 },
  NRT: { lat: 35.7653, lng: 140.3864 }, HND: { lat: 35.5494, lng: 139.7798 },
  ICN: { lat: 37.4602, lng: 126.4407 }, PEK: { lat: 40.0799, lng: 116.6031 },
  PVG: { lat: 31.1434, lng: 121.8052 }, HKG: { lat: 22.3080, lng: 113.9185 },
  SIN: { lat: 1.3644, lng: 103.9915 }, BKK: { lat: 13.6900, lng: 100.7501 },
  KUL: { lat: 2.7456, lng: 101.7099 }, SYD: { lat: -33.9399, lng: 151.1753 },
  MEL: { lat: -37.6690, lng: 144.8410 }, AKL: { lat: -37.0082, lng: 174.7850 },
  DEL: { lat: 28.5665, lng: 77.1031 }, BOM: { lat: 19.0896, lng: 72.8656 },
  DXB: { lat: 25.2532, lng: 55.3657 }, AUH: { lat: 24.4330, lng: 54.6511 },
  DOH: { lat: 25.2731, lng: 51.6080 }, JNB: { lat: -26.1392, lng: 28.2460 },
  GRU: { lat: -23.4356, lng: -46.4731 }, EZE: { lat: -34.8222, lng: -58.5358 },
  MEX: { lat: 19.4363, lng: -99.0721 }, SCL: { lat: -33.3930, lng: -70.7858 },
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// Register background task — only in native builds, never in Expo Go
if (!IS_EXPO_GO) {
  try {
    const TaskManager = require('expo-task-manager');
    TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
      if (error || !data) return;
      const locations = data.locations ?? [];
      if (!locations.length) return;
      const { latitude, longitude } = locations[locations.length - 1].coords;
      try {
        const [flightsJson, userId] = await Promise.all([
          AsyncStorage.getItem(FLIGHTS_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (!flightsJson || !userId) return;
        const flights: Flight[] = JSON.parse(flightsJson);
        const todayFlights = flights.filter(f => f.status === 'upcoming' && f.date === todayStr());
        for (const flight of todayFlights) {
          const airport = AIRPORT_COORDS[flight.from.code];
          if (!airport) continue;
          const dist = haversineKm(latitude, longitude, airport.lat, airport.lng);
          const atAirport = dist <= RADIUS_KM;
          const key = `airport_arrival_${flight.id}`;
          const stored = await AsyncStorage.getItem(key);
          if (atAirport && !stored) {
            await AsyncStorage.setItem(key, String(Date.now()));
          } else if (!atAirport && stored) {
            const minutes = Math.round((Date.now() - parseInt(stored)) / 60_000);
            await AsyncStorage.removeItem(key);
            if (minutes > 0) {
              await supabase.rpc('update_airport_minutes', {
                p_flight_id: flight.id, p_user_id: userId, p_minutes: minutes,
              }).catch(() => {});
            }
          }
        }
      } catch {}
    });
  } catch {}
}

export async function requestLocationPermission(): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  try {
    const Location = require('expo-location');
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    return bg === 'granted';
  } catch { return false; }
}

export async function startAirportTracking(
  flights: Flight[],
  userId: string,
  onUpdate: (flightId: string, minutes: number) => void,
): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    const Location = require('expo-location');
    const today = todayStr();
    const todayFlights = flights.filter(
      f => f.status === 'upcoming' && f.date === today && AIRPORT_COORDS[f.from.code],
    );
    await Promise.all([
      AsyncStorage.setItem(FLIGHTS_KEY, JSON.stringify(todayFlights)),
      AsyncStorage.setItem(USER_KEY, userId),
    ]);
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') return;
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (!isRunning) {
      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 300,
        timeInterval: 60_000,
        showsBackgroundLocationIndicator: true,
        foregroundService: { notificationTitle: 'Flair', notificationBody: 'Tracking your airport time' },
      });
    }
    // Foreground UI update
    const { coords } = await Location.getCurrentPositionAsync({});
    for (const flight of todayFlights) {
      const airport = AIRPORT_COORDS[flight.from.code];
      if (!airport) continue;
      if (haversineKm(coords.latitude, coords.longitude, airport.lat, airport.lng) <= RADIUS_KM) {
        const stored = await AsyncStorage.getItem(`airport_arrival_${flight.id}`);
        if (stored) onUpdate(flight.id, Math.round((Date.now() - parseInt(stored)) / 60_000));
      }
    }
  } catch {}
}

export async function stopAirportTracking(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    const Location = require('expo-location');
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => {});
  } catch {}
}
