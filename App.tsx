import React, { useState, useEffect } from 'react';
import { useColorScheme, View, Text, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './constants/theme';
import FeedScreen from './screens/FeedScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import ProfileNavigator from './screens/ProfileNavigator';
import OnboardingFlow from './screens/OnboardingFlow';
import SetPasswordModal from './components/SetPasswordModal';
import NotificationsScreen from './screens/NotificationsScreen';
import { Flight } from './data/mockData';
import { supabase } from './lib/supabase';
import AddFlightModal from './components/AddFlightModal';
import LogoMark from './components/LogoMark';
import { loadProfile, loadFlights, loadFeedFlights, saveFlight, updateFlight, updateFlightPrivacy, softDeleteFlight, restoreFlight, deleteFlight, loadDeletedFlights, loadNotifications, loadFollowRequests } from './services/db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startAirportTracking, stopAirportTracking, requestLocationPermission } from './services/airportTracker';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatarUri: string | null;
  isPrivate: boolean;
}

const Tab = createBottomTabNavigator();

const EMPTY_PROFILE: UserProfile = { id: '', name: '', username: '', bio: '', avatarUri: null, isPrivate: false };

export default function App() {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [feedFlights, setFeedFlights] = useState<Flight[]>([]);
  const [deletedFlights, setDeletedFlights] = useState<Flight[]>([]);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [postResetReturn, setPostResetReturn] = useState(false);
  const [showAddFlight, setShowAddFlight] = useState(false);
  const [returnForFlight, setReturnForFlight] = useState<Flight | null>(null);
  const [addFlightFromTrip, setAddFlightFromTrip] = useState(false);
  const [notifBadge, setNotifBadge] = useState(false);

  // ── Restore session on launch ──────────────────────────────────────
  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION once on startup with the
    // persisted session (or null). This is more reliable than getSession()
    // because it uses the same internal event loop as token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          await restoreUserData(session.user.id);
        }
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Session was silently refreshed — ensure profile is loaded
        setOnboarded(prev => {
          if (!prev) restoreUserData(session.user!.id);
          return prev;
        });
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(EMPTY_PROFILE);
        setFlights([]);
        setOnboarded(false);
      } else if (event === 'PASSWORD_RECOVERY') {
        setShowSetPassword(true);
      }
    });

    // Handle deep links (password reset)
    async function processUrl(url: string | null) {
      if (!url || !url.includes('reset-password')) return;

      // PKCE flow: ?code=...
      const queryString = url.split('?')[1]?.split('#')[0];
      const queryParams = new URLSearchParams(queryString ?? '');
      const code = queryParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          Alert.alert('Reset link expired', 'This password reset link has already been used or expired. Please request a new one.');
          return;
        }
        setShowSetPassword(true);
        return;
      }

      // Implicit flow: #access_token=...
      const fragment = url.split('#')[1];
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            Alert.alert('Reset link expired', 'This password reset link has already been used or expired. Please request a new one.');
            return;
          }
          setShowSetPassword(true);
          return;
        }
      }

      // URL matched but no tokens found
      Alert.alert('Invalid link', 'Could not extract session from the reset link. Please try requesting a new one.');
    }
    function handleUrl({ url }: { url: string | null }) { processUrl(url); }
    const linkSub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(processUrl);

    return () => { subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  // Airport time tracking — starts when user has upcoming flights today
  useEffect(() => {
    if (!onboarded || !userProfile.id) return;

    const PREF_KEY = `location_pref_${userProfile.id}`;

    AsyncStorage.getItem(PREF_KEY).then(pref => {
      if (pref === 'denied') return;

      const begin = () => {
        requestLocationPermission().then(granted => {
          if (!granted) return;
          startAirportTracking(flights, userProfile.id, (flightId, minutes) => {
            setFlights(prev => prev.map(f => f.id === flightId ? { ...f, airportMinutes: minutes } : f));
          });
        });
      };

      if (pref === 'granted') {
        begin();
      } else {
        Alert.alert(
          'Know your airport time',
          'Flair can automatically track how long you spend at the airport — no logging needed. You can always change this in Settings → Flair.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => AsyncStorage.setItem(PREF_KEY, 'denied').catch(() => {}),
            },
            {
              text: 'Turn On',
              onPress: () => {
                AsyncStorage.setItem(PREF_KEY, 'granted').catch(() => {});
                begin();
              },
            },
          ],
        );
      }
    }).catch(() => {});

    return () => { stopAirportTracking(); };
  }, [onboarded, userProfile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep AsyncStorage in sync when flights change so background task has latest data
  useEffect(() => {
    if (!onboarded || !userProfile.id) return;
    AsyncStorage.setItem('airport_tracker_flights', JSON.stringify(flights)).catch(() => {});
  }, [flights]);

  // Check for unread notifications + pending follow requests
  useEffect(() => {
    if (!onboarded || !userProfile.id) return;
    (async () => {
      try {
        const [lastSeen, notifs, requests] = await Promise.all([
          AsyncStorage.getItem(`notif_seen_${userProfile.id}`),
          loadNotifications(userProfile.id),
          userProfile.isPrivate ? loadFollowRequests(userProfile.id) : Promise.resolve([]),
        ]);
        const hasNewNotifs = notifs.length > 0 && (!lastSeen || notifs[0].createdAt > lastSeen);
        const hasPendingRequests = requests.length > 0;
        setNotifBadge(hasNewNotifs || hasPendingRequests);
      } catch {}
    })();
  }, [onboarded, userProfile.id, userProfile.isPrivate]);

  async function restoreUserData(userId: string) {
    let profile = await loadProfile(userId);
    // Retry once on failure (e.g. cold-start network delay)
    if (!profile) {
      await new Promise(r => setTimeout(r, 1000));
      profile = await loadProfile(userId);
    }
    if (!profile) return; // No profile in DB — user needs to complete onboarding
    setUserProfile(profile);
    const [userFlights, userDeletedFlights, feed] = await Promise.all([
      loadFlights(userId, profile).catch(() => [] as Flight[]),
      loadDeletedFlights(userId, profile).catch(() => [] as Flight[]),
      loadFeedFlights(userId).catch(() => [] as Flight[]),
    ]);
    setFlights(userFlights);
    setDeletedFlights(userDeletedFlights);
    setFeedFlights(feed);
    setOnboarded(true);
  }

  // ── Refresh feed ──────────────────────────────────────────────────
  async function handleRefreshFeed() {
    if (!userProfile.id) return;
    const feed = await loadFeedFlights(userProfile.id);
    setFeedFlights(feed);
  }

  // ── Called after onboarding completes ─────────────────────────────
  async function handleOnboardingComplete(profile: UserProfile) {
    setUserProfile(profile);
    try {
      const [userFlights, feed] = await Promise.all([
        loadFlights(profile.id, profile),
        loadFeedFlights(profile.id),
      ]);
      setFlights(userFlights);
      setFeedFlights(feed);
    } catch {}
    setOnboarded(true);
  }

  // ── Add flight — saves to Supabase then updates local state ────────
  async function handleAddFlight(flight: Flight, tripName?: string) {
    try {
      const saved = await saveFlight(flight, userProfile.id);
      setFlights(prev => [saved, ...prev]);
      setFeedFlights(prev => [saved, ...prev.filter(f => f.id !== saved.id)]);
      // Persist trip name keyed by this flight's ID so TripCard can find it
      if (tripName) {
        AsyncStorage.setItem(`trip_name_trip_${saved.id}`, tripName).catch(() => {});
      }
    } catch (e: any) {
      console.error('[handleAddFlight]', e);
      const isPhotoError = flight.photos.length > 0;
      Alert.alert(
        isPhotoError ? 'Photo upload failed' : 'Could not save flight',
        (e?.message || String(e)) + '\n\nIf this is a storage error, make sure the trip-photos bucket exists in Supabase and has an upload policy for authenticated users.',
      );
    }
  }

  // ── Edit flight ────────────────────────────────────────────────────
  async function handleEditFlight(flightId: string, updates: import('./components/EditFlightModal').FlightEditUpdates) {
    const applyUpdate = (f: Flight) => f.id === flightId
      ? {
          ...f,
          note: updates.note || undefined,
          photos: updates.photos,
          status: updates.status,
          journal: updates.journal || undefined,
          journalPrivate: updates.journalPrivate,
          ...(updates.fromCode ? { from: { code: updates.fromCode, city: updates.fromCity ?? f.from.city } } : {}),
          ...(updates.toCode   ? { to:   { code: updates.toCode,   city: updates.toCity   ?? f.to.city   } } : {}),
          ...(updates.flightNum !== undefined ? { flightNum: updates.flightNum } : {}),
          ...(updates.date      !== undefined ? { date: updates.date }           : {}),
          ...(updates.duration  !== undefined ? { duration: updates.duration }   : {}),
        }
      : f;
    // Optimistic update in both lists
    setFlights(prev => prev.map(applyUpdate));
    setFeedFlights(prev => prev.map(applyUpdate));
    // Privacy change — apply immediately via its own handler
    if (updates.privacy) handleChangeFlightPrivacy(flightId, updates.privacy);

    try {
      const savedPhotos = await updateFlight(flightId, userProfile.id, updates);
      // Sync remote photo URLs back to both lists
      setFlights(prev => prev.map(f => f.id === flightId ? { ...f, photos: savedPhotos } : f));
      setFeedFlights(prev => prev.map(f => f.id === flightId ? { ...f, photos: savedPhotos } : f));
    } catch (e: any) {
      console.error('[handleEditFlight] error:', JSON.stringify(e?.message ?? e));
    }
  }

  // ── Delete flight (soft) ───────────────────────────────────────────
  async function handleDeleteFlight(flightId: string) {
    const flight = flights.find(f => f.id === flightId);
    setFlights(prev => prev.filter(f => f.id !== flightId));
    setFeedFlights(prev => prev.filter(f => f.id !== flightId));
    if (flight) {
      const deleted = { ...flight, deletedAt: new Date().toISOString() };
      setDeletedFlights(prev => [deleted, ...prev]);
    }
    try { await softDeleteFlight(flightId, userProfile.id); } catch {}
  }

  // ── Change flight privacy ──────────────────────────────────────────
  function handleChangeFlightPrivacy(flightId: string, privacy: 'public' | 'followers' | 'private') {
    setFlights(prev => prev.map(f => f.id === flightId ? { ...f, privacy } : f));
    setFeedFlights(prev => prev.map(f => f.id === flightId ? { ...f, privacy } : f));
    updateFlightPrivacy(flightId, userProfile.id, privacy).catch(() => {});
  }

  // ── Restore flight ─────────────────────────────────────────────────
  async function handleRestoreFlight(flightId: string) {
    const flight = deletedFlights.find(f => f.id === flightId);
    setDeletedFlights(prev => prev.filter(f => f.id !== flightId));
    if (flight) setFlights(prev => [flight, ...prev]);
    try { await restoreFlight(flightId, userProfile.id); } catch {}
  }

  // ── Permanently delete flight ──────────────────────────────────────
  async function handlePermanentDelete(flightId: string) {
    setDeletedFlights(prev => prev.filter(f => f.id !== flightId));
    try { await deleteFlight(flightId, userProfile.id); } catch {}
  }


  // ── Sign out ───────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut();
    // onAuthStateChange will reset state
  }

  // ── Loading splash ─────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (showSetPassword) {
    return (
      <SafeAreaProvider>
        <SetPasswordModal
          visible
          theme={theme}
          isDark={isDark}
          onDone={() => { setShowSetPassword(false); setPostResetReturn(true); setOnboarded(false); }}
        />
      </SafeAreaProvider>
    );
  }

  if (!onboarded) {
    return (
      <SafeAreaProvider>
        <OnboardingFlow
          theme={theme}
          isDark={isDark}
          initialStep={postResetReturn ? 'signin' : undefined}
          onComplete={(profile) => { setPostResetReturn(false); handleOnboardingComplete(profile); }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              borderTopWidth: 0.5,
              position: 'absolute',
              paddingTop: 4,
            },
            tabBarBackground: () => (
              <BlurView
                intensity={85}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ),
            tabBarActiveTintColor: theme.accent,
            tabBarInactiveTintColor: theme.textMuted,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          }}
        >
          <Tab.Screen
            name="Feed"
            options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} /> }}
          >
            {({ navigation }) => (
              <FeedScreen
                theme={theme}
                isDark={isDark}
                flights={feedFlights}
                currentUserId={userProfile.id}
                currentUserName={userProfile.name || userProfile.username || 'You'}
                currentUserInitials={(userProfile.name || userProfile.username || '?')[0]?.toUpperCase() ?? '?'}
                currentUserAvatarUri={userProfile.avatarUri}
                onEditFlight={handleEditFlight}
                onDeleteFlight={handleDeleteFlight}
                onRefresh={handleRefreshFeed}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Discover"
            options={{ tabBarLabel: 'Insights', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={24} color={color} /> }}
          >
            {() => (
              <DiscoverScreen
                theme={theme}
                isDark={isDark}
                flights={flights}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Add"
            options={{
              tabBarLabel: 'Add',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? 'airplane' : 'airplane-outline'} size={24} color={color} />
              ),
            }}
            listeners={{
              tabPress: e => {
                e.preventDefault();
                setShowAddFlight(true);
              },
            }}
          >
            {() => null}
          </Tab.Screen>

          <Tab.Screen
            name="Activity"
            options={{
              tabBarLabel: 'Activity',
              tabBarIcon: ({ color, focused }) => (
                <View>
                  <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={24} color={color} />
                  {notifBadge && <View style={tabStyles.badge} />}
                </View>
              ),
            }}
          >
            {() => (
              <NotificationsScreen
                theme={theme}
                isDark={isDark}
                currentUserId={userProfile.id}
                isPrivate={userProfile.isPrivate}
                onClearBadge={() => setNotifBadge(false)}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} /> }}
          >
            {() => (
              <ProfileNavigator
                theme={theme}
                isDark={isDark}
                userProfile={userProfile}
                flights={flights}
                deletedFlights={deletedFlights}
                onUpdateProfile={async (profile) => { setUserProfile(profile); }}
                onDeleteFlight={handleDeleteFlight}
                onChangeFlightPrivacy={handleChangeFlightPrivacy}
                onEditFlight={handleEditFlight}
                onRestoreFlight={handleRestoreFlight}
                onPermanentDelete={handlePermanentDelete}
                onSignOut={handleSignOut}
                onAddReturnFlight={flight => {
                  setReturnForFlight(flight);
                  setShowAddFlight(true);
                }}
                onAddFlight={() => { setAddFlightFromTrip(true); setShowAddFlight(true); }}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      <AddFlightModal
        visible={showAddFlight}
        onClose={() => { setShowAddFlight(false); setReturnForFlight(null); setAddFlightFromTrip(false); }}
        onAdd={async (flight, tripName) => { setShowAddFlight(false); setReturnForFlight(null); setAddFlightFromTrip(false); await handleAddFlight(flight, tripName); }}
        theme={theme}
        existingFlights={flights}
        returnFor={returnForFlight ?? undefined}
        skipTripPrompts={addFlightFromTrip}
        currentUser={{
          name: userProfile.name || userProfile.username || 'You',
          handle: `@${userProfile.username}`,
          initials: (userProfile.name || userProfile.username || '?')[0]?.toUpperCase() ?? '?',
          avatarUrl: userProfile.avatarUri ?? null,
        }}
      />

    </>
    </SafeAreaProvider>
  );
}

const tabStyles = StyleSheet.create({
  badge: {
    position: 'absolute', top: 4, right: '25%',
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },
});
