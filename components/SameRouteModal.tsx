import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal,
  ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { getSameRouteUsers, RouteUser } from '../services/db';

const AVATAR_COLORS: [string, string][] = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
];
function avatarColor(id: string): [string, string] {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

interface Props {
  visible: boolean;
  flight: Flight;
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserInitials: string;
  onClose: () => void;
}

export default function SameRouteModal({ visible, flight, theme, currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<RouteUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setUsers([]);
    setLoading(true);
    getSameRouteUsers(flight.from.code, flight.to.code, currentUserId)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, flight.from.code, flight.to.code]);

  const upcoming = users.filter(u => u.status === 'upcoming' || u.status === 'live');
  const past = users.filter(u => u.status === 'past');

  function renderUser(u: RouteUser) {
    const colors = avatarColor(u.userId);
    return (
      <View key={u.userId} style={[styles.userRow, { borderBottomColor: theme.sep }]}>
        {u.avatarUrl ? (
          <Image source={{ uri: u.avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={colors} style={styles.avatar}>
            <Text style={styles.avatarText}>{u.initials}</Text>
          </LinearGradient>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>{u.name || `@${u.username}`}</Text>
          <Text style={[styles.userSub, { color: theme.textMuted }]}>
            @{u.username} · {u.flightDate}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.surface }]} onPress={onClose}>
            <Ionicons name="close" size={16} color={theme.textSub} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerRoute, { color: theme.text }]}>
              {flight.from.code}
              <Text style={{ color: theme.accent }}> → </Text>
              {flight.to.code}
            </Text>
            {(flight.from.city || flight.to.city) && (
              <Text style={[styles.headerCities, { color: theme.textMuted }]}>
                {[flight.from.city, flight.to.city].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />
          ) : users.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="airplane-outline" size={44} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No one else on this route yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                You might be the first to log {flight.from.code} → {flight.to.code}
              </Text>
            </View>
          ) : (
            <>
              {upcoming.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FLYING SOON</Text>
                  {upcoming.map(renderUser)}
                </View>
              )}
              {past.length > 0 && (
                <View style={[styles.section, upcoming.length > 0 && { marginTop: 24 }]}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FLEW BEFORE</Text>
                  {past.map(renderUser)}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5,
  },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerRoute: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerCities: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  section: {},
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700' },
  userSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
