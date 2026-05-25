import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing, Image,
  Dimensions, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import RouteDisplay from './RouteDisplay';
import FlightDetailModal from './FlightDetailModal';
import EditFlightModal from './EditFlightModal';
import SameRouteModal from './SameRouteModal';
import UserProfileModal from './UserProfileModal';
import { addFlightCompanion, removeFlightCompanion, getFlightCompanions, FlightCompanion, getSameRouteUsers, RouteUser, reportContent, SearchUser } from '../services/db';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  flight: Flight;
  theme: Theme;
  isDark?: boolean;
  isOwn?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserInitials?: string;
  currentUserAvatarUri?: string | null;
  onDelete?: () => void;
  onEdit?: (updates: import('./EditFlightModal').FlightEditUpdates) => void;
  onUserPress?: (user: SearchUser) => void;
}

export default function FlightCard({ flight, theme, isDark = false, isOwn, currentUserId = '', currentUserName = '', currentUserInitials = '?', currentUserAvatarUri, onDelete, onEdit, onUserPress }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSameRoute, setShowSameRoute] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [showUserProfile, setShowUserProfile] = useState(false);

  // Companion state — "I'm on this flight" (non-own upcoming/live only)
  const showCompanionFeature = !isOwn && (flight.status === 'upcoming' || flight.status === 'live');
  const [isOnFlight, setIsOnFlight] = useState(false);
  const [companions, setCompanions] = useState<FlightCompanion[]>([]);
  const [loadingCompanion, setLoadingCompanion] = useState(false);

  // Same route — non-own past flights only
  const showSameRouteBtn = !isOwn && flight.status === 'past';
  const [routeUsers, setRouteUsers] = useState<RouteUser[]>([]);

  useEffect(() => {
    if (!showCompanionFeature || !currentUserId) return;
    getFlightCompanions(flight.id, currentUserId).then(list => {
      setIsOnFlight(list.some(c => c.userId === currentUserId));
      setCompanions(list.filter(c => c.userId !== currentUserId));
    }).catch(() => {});
  }, [flight.id]);

  useEffect(() => {
    if (!showSameRouteBtn || !currentUserId) return;
    getSameRouteUsers(flight.from.code, flight.to.code, currentUserId)
      .then(users => setRouteUsers(users.filter(u => u.userId !== flight.userId)))
      .catch(() => {});
  }, [flight.id, showSameRouteBtn]);

  async function handleToggleFlight() {
    if (!currentUserId || loadingCompanion) return;
    setLoadingCompanion(true);
    try {
      if (isOnFlight) {
        setIsOnFlight(false);
        setCompanions(prev => prev.filter(c => c.userId !== currentUserId));
        await removeFlightCompanion(flight.id, currentUserId);
      } else {
        setIsOnFlight(true);
        await addFlightCompanion(flight.id, currentUserId, currentUserName, currentUserInitials);
      }
    } catch {
      setIsOnFlight(prev => !prev);
    } finally {
      setLoadingCompanion(false);
    }
  }

  useEffect(() => {
    if (flight.status !== 'live') return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  function openPhoto(index: number) {
    setPhotoIndex(index);
    setShowDetail(true);
  }

  function renderBadge() {
    if (flight.status === 'live') {
      return (
        <View style={[styles.badge, { backgroundColor: theme.liveBg }]}>
          <Animated.View style={[styles.pulseDot, { backgroundColor: theme.live, opacity: pulseAnim }]} />
          <Text style={[styles.badgeText, { color: theme.live }]}>LIVE</Text>
        </View>
      );
    }
    if (flight.status === 'upcoming') {
      return (
        <View style={[styles.badge, { backgroundColor: theme.upcomingBg }]}>
          <Text style={[styles.badgeText, { color: theme.upcoming }]}>UPCOMING</Text>
        </View>
      );
    }
    return null;
  }

  const glassOverlay = isDark ? 'rgba(10,18,35,0.58)' : 'rgba(255,255,255,0.68)';
  const glassBorder  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.95)';
  const glassInner   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.50)';

  return (
    <>
      <View style={styles.card}>
        <BlurView
          intensity={isDark ? 60 : 75}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: glassBorder }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 24, borderWidth: 1, borderTopColor: glassInner, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent' }]} />

        <TouchableOpacity activeOpacity={0.97} onPress={() => setShowDetail(true)}>
          <View style={styles.cardTop}>
            <TouchableOpacity
              style={styles.userRow}
              activeOpacity={0.75}
              onPress={() => {
                if (isOwn) return;
                const user: SearchUser = {
                  id: flight.userId,
                  username: flight.user.handle.replace('@', ''),
                  fullName: flight.user.name,
                  avatarUrl: flight.user.avatarUrl ?? null,
                  isPrivate: false,
                  followStatus: 'none',
                };
                if (onUserPress) { onUserPress(user); } else { setShowUserProfile(true); }
              }}
            >
              {flight.user.avatarUrl ? (
                <Image source={{ uri: flight.user.avatarUrl }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={flight.user.avatarColors} style={styles.avatar}>
                  <Text style={styles.avatarText}>{flight.user.initials}</Text>
                </LinearGradient>
              )}
              <View>
                <Text style={[styles.userName, { color: theme.text }]}>{flight.user.name}</Text>
                <Text style={[styles.timeAgo, { color: theme.textMuted }]}>{flight.user.handle} · {flight.timeAgo}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (isOwn) {
                Alert.alert(flight.flightNum || 'Flight', undefined, [
                  { text: 'Edit', onPress: () => setShowEdit(true) },
                  { text: 'Delete', style: 'destructive', onPress: () => {
                    Alert.alert('Delete Flight', 'Are you sure you want to delete this flight? It will be moved to Recently Deleted.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: onDelete },
                    ]);
                  }},
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                Alert.alert('Report Flight', 'Is this content inappropriate or spam?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Report', style: 'destructive', onPress: async () => {
                    try {
                      await reportContent('flight', flight.id);
                      Alert.alert('Reported', 'Thanks for letting us know. We\'ll review this content.');
                    } catch { Alert.alert('Error', 'Could not submit report. Please try again.'); }
                  }},
                ]);
              }
            }}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <RouteDisplay from={flight.from} to={flight.to} theme={theme} />

          <View style={styles.metaRow}>
            {flight.flightNum ? <Text style={[styles.metaText, { color: theme.textSub }]}>{flight.flightNum}</Text> : null}
            {flight.flightNum ? <View style={[styles.dot, { backgroundColor: theme.textMuted }]} /> : null}
            <Text style={[styles.metaText, { color: theme.textMuted }]}>{(() => { const p = flight.date.split('-'); return p.length === 3 ? `${p[1]}-${p[0]}-${p[2].slice(-2)}` : flight.date; })()}</Text>
            {flight.duration ? <><View style={[styles.dot, { backgroundColor: theme.textMuted }]} /><Text style={[styles.metaText, { color: theme.textMuted }]}>{flight.duration}</Text></> : null}
            {renderBadge()}
          </View>

          {flight.note ? <Text style={[styles.note, { color: theme.textSub }]}>{flight.note}</Text> : null}

          {/* Companion strip */}
          {showCompanionFeature && (companions.length > 0 || isOnFlight) && (
            <View style={styles.companionStrip}>
              <Ionicons name="people-outline" size={12} color={theme.textMuted} />
              <Text style={[styles.companionStripText, { color: theme.textSub }]} numberOfLines={1}>
                {[
                  ...(isOnFlight ? ['You'] : []),
                  ...companions.slice(0, 2).map(c => c.name.split(' ')[0]),
                  ...(companions.length > 2 ? [`+${companions.length - 2} more`] : []),
                ].join(', ')}
                {' are on this flight'}
              </Text>
            </View>
          )}

          {flight.photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              decelerationRate="fast"
              snapToInterval={214}
            >
              {flight.photos.map((uri, i) => (
                <TouchableOpacity key={uri} onPress={() => openPhoto(i)} activeOpacity={0.9}>
                  <View style={[styles.stripPhotoWrap, { backgroundColor: theme.surface }]}>
                    {failedPhotos.has(uri) ? (
                      <View style={[styles.stripPhoto, styles.stripPhotoFallback, { backgroundColor: theme.surface2 }]}>
                        <Ionicons name="image-outline" size={28} color={theme.textMuted} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri }}
                        style={styles.stripPhoto}
                        resizeMode="cover"
                        onError={() => setFailedPhotos(prev => new Set([...prev, uri]))}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>

        {(showCompanionFeature || showSameRouteBtn) && (
        <View style={[styles.actions, { borderTopColor: theme.sep }]}>
          {showCompanionFeature ? (
            <TouchableOpacity
              style={[styles.routeMatchBtn, isOnFlight
                ? { backgroundColor: theme.accentBg }
                : { backgroundColor: theme.surface }
              ]}
              onPress={handleToggleFlight}
              disabled={loadingCompanion}
            >
              <Ionicons
                name={isOnFlight ? 'checkmark-circle' : 'airplane-outline'}
                size={13}
                color={isOnFlight ? theme.accent : theme.textMuted}
              />
              <Text style={[styles.routeMatchText, { color: isOnFlight ? theme.accent : theme.textMuted }]}>
                {isOnFlight ? 'On this flight' : "I'm on this"}
              </Text>
            </TouchableOpacity>
          ) : showSameRouteBtn ? (
            <TouchableOpacity
              style={[
                styles.routeMatchBtn,
                routeUsers.length > 0
                  ? { backgroundColor: theme.accentBg }
                  : { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.sep },
              ]}
              onPress={() => setShowSameRoute(true)}
              activeOpacity={0.75}
            >
              {routeUsers.length > 0 ? (
                <View style={styles.routeAvatarStack}>
                  {routeUsers.slice(0, 3).map((u, i) => (
                    <View
                      key={u.userId}
                      style={[
                        styles.routeAvatar,
                        { marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i },
                        { backgroundColor: theme.accentBg, borderColor: theme.surface },
                      ]}
                    >
                      {u.avatarUrl ? (
                        <Image source={{ uri: u.avatarUrl }} style={styles.routeAvatarImg} />
                      ) : (
                        <Text style={[styles.routeAvatarText, { color: theme.accent }]}>{u.initials}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Ionicons name="airplane-outline" size={13} color={theme.textMuted} />
              )}
              <Text style={[
                styles.routeMatchText,
                { color: routeUsers.length > 0 ? theme.accent : theme.textMuted },
              ]}>
                {routeUsers.length > 0
                  ? `${routeUsers.length} flew this`
                  : 'Same route?'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        )}
      </View>

      <EditFlightModal
        flight={flight}
        visible={showEdit}
        theme={theme}
        onClose={() => setShowEdit(false)}
        onSave={updates => { setShowEdit(false); onEdit?.(updates); }}
      />

      <SameRouteModal
        visible={showSameRoute}
        flight={flight}
        theme={theme}
        isDark={isDark}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserInitials={currentUserInitials}
        onClose={() => setShowSameRoute(false)}
      />

      <FlightDetailModal
        flight={flight}
        visible={showDetail}
        theme={theme}
        isDark={isDark}
        isOwn={isOwn}
        initialPhotoIndex={photoIndex}
        onClose={() => setShowDetail(false)}
        onEditPress={() => { setShowDetail(false); setShowEdit(true); }}
        onDeletePress={() => { setShowDetail(false); onDelete?.(); }}
      />

      {!isOwn && (
        <UserProfileModal
          user={showUserProfile ? {
            id: flight.userId,
            username: flight.user.handle.replace('@', ''),
            fullName: flight.user.name,
            avatarUrl: flight.user.avatarUrl ?? null,
            isPrivate: false,
            followStatus: 'none',
          } as SearchUser : null}
          visible={showUserProfile}
          theme={theme}
          isDark={isDark}
          currentUserId={currentUserId}
          onClose={() => setShowUserProfile(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24, padding: 18, marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#001233',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '700', lineHeight: 19, letterSpacing: -0.1 },
  timeAgo: { fontSize: 12, fontWeight: '500', lineHeight: 16, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '500', letterSpacing: 0.1 },
  dot: { width: 2.5, height: 2.5, borderRadius: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pulseDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, lineHeight: 13, includeFontPadding: false },
  note: { fontSize: 14, fontWeight: '400', lineHeight: 21, marginTop: 6, marginBottom: 2 },
  companionStrip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  companionStripText: { fontSize: 12, fontWeight: '500', flex: 1 },
  photoStrip: { marginTop: 14, height: 140 },
  stripPhotoWrap: { width: 210, height: 140, borderRadius: 16, marginHorizontal: 4, overflow: 'hidden' },
  stripPhoto: { width: 210, height: 140 },
  stripPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14,
  },
  routeMatchBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 5, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 20,
  },
  routeMatchText: { fontSize: 12, fontWeight: '700' },
  routeAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  routeAvatar: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, overflow: 'hidden',
  },
  routeAvatarImg:  { width: 18, height: 18 },
  routeAvatarText: { fontSize: 8, fontWeight: '800' },
});
