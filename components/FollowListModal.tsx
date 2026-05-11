import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { SearchUser, getFollowers, getFollowing } from '../services/db';
import UserProfileModal from './UserProfileModal';

interface Props {
  visible: boolean;
  type: 'followers' | 'following';
  userId: string;
  currentUserId: string;
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
}

const AVATAR_COLORS: [string, string][] = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
];
function avatarColor(id: string): [string, string] {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function FollowListModal({ visible, type, userId, currentUserId, theme, isDark, onClose }: Props) {
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);

  useEffect(() => {
    if (visible) { setQuery(''); load(); }
    else { setUsers([]); setSelectedUser(null); }
  }, [visible, type, userId]);

  async function load() {
    setLoading(true);
    try {
      const data = type === 'followers'
        ? await getFollowers(userId, currentUserId)
        : await getFollowing(userId, currentUserId);
      setUsers(data);
    } catch {}
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q)
    );
  }, [users, query]);

  function UserRow({ user }: { user: SearchUser }) {
    const initials = (user.fullName || user.username || '?')[0]?.toUpperCase() ?? '?';
    const colors = avatarColor(user.id);
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.sep }]}
        onPress={() => setSelectedUser(user)}
        activeOpacity={0.7}
      >
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={colors} style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>
              @{user.username}
            </Text>
            {user.isPrivate && (
              <Ionicons name="lock-closed" size={11} color={theme.textMuted} style={{ marginLeft: 4, marginTop: 1 }} />
            )}
          </View>
          {user.fullName ? (
            <Text style={[styles.fullName, { color: theme.textMuted }]} numberOfLines={1}>{user.fullName}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>


        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {type === 'followers' ? 'Followers' : 'Following'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: theme.inputBg }]}>
            <Ionicons name="search-outline" size={15} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search..."
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={15} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={u => u.id}
            renderItem={({ item }) => <UserRow user={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={44} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  {query.trim()
                    ? 'No results'
                    : type === 'followers'
                      ? 'No followers yet'
                      : 'Not following anyone yet'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <UserProfileModal
        user={selectedUser}
        visible={!!selectedUser}
        theme={theme}
        isDark={isDark}
        currentUserId={currentUserId}
        onClose={() => setSelectedUser(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  closeBtn: { width: 36, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },

  list: { paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 15, fontWeight: '700' },
  fullName: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 64, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
