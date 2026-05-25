import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import { Theme } from '../constants/theme';
import { SearchUser, searchUsers, findContactsOnFlare, sendFollowRequest, unfollowUser } from '../services/db';
import UserProfileModal from './UserProfileModal';

interface Props {
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  onClose: () => void;
  onUserPress?: (user: SearchUser) => void;
}

const AVATAR_COLORS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
];

function avatarColor(id: string): [string, string] {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function SearchModal({ visible, theme, isDark, currentUserId, onClose, onUserPress }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followStates, setFollowStates] = useState<Record<string, SearchUser['followStatus']>>({});
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [contactMatches, setContactMatches] = useState<SearchUser[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load contact matches once when modal opens
  useEffect(() => {
    if (!visible || contactsLoaded) return;
    (async () => {
      try {
        const { status } = await Contacts.getPermissionsAsync();
        if (status !== 'granted') return;
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails] });
        const emails: string[] = [];
        data.forEach(c => {
          (c.emails ?? []).forEach(e => { if (e.email) emails.push(e.email.toLowerCase()); });
        });
        const matches = await findContactsOnFlare(emails, currentUserId);
        setContactMatches(matches);
        setContactsLoaded(true);
      } catch {}
    })();
  }, [visible]);

  function handleClose() {
    setQuery('');
    setResults([]);
    setSearched(false);
    setFollowStates({});
    setSelectedUser(null);
    onClose();
  }

  function getContactFollowStatus(user: SearchUser): SearchUser['followStatus'] {
    return followStates[user.id] ?? user.followStatus;
  }

  function handleUserPress(user: SearchUser) {
    const merged = { ...user, followStatus: followStates[user.id] ?? user.followStatus };
    if (onUserPress) {
      onClose();
      onUserPress(merged);
    } else {
      setSelectedUser(merged);
    }
  }

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const found = await searchUsers(q, currentUserId);
      setResults(found);
      setSearched(true);
    } catch {}
    setLoading(false);
  }, [currentUserId]);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  }

  function getFollowStatus(user: SearchUser): SearchUser['followStatus'] {
    return followStates[user.id] ?? user.followStatus;
  }

  async function handleFollowPress(user: SearchUser) {
    const status = getFollowStatus(user);
    if (status === 'accepted' || status === 'pending') {
      // Unfollow / cancel request
      setFollowStates(prev => ({ ...prev, [user.id]: 'none' }));
      try { await unfollowUser(currentUserId, user.id); } catch {
        setFollowStates(prev => ({ ...prev, [user.id]: status }));
      }
    } else {
      // Follow or request
      const optimistic = user.isPrivate ? 'pending' : 'accepted';
      setFollowStates(prev => ({ ...prev, [user.id]: optimistic }));
      try {
        const result = await sendFollowRequest(currentUserId, user.id);
        setFollowStates(prev => ({ ...prev, [user.id]: result as SearchUser['followStatus'] }));
      } catch {
        setFollowStates(prev => ({ ...prev, [user.id]: 'none' }));
      }
    }
  }

  function FollowButton({ user }: { user: SearchUser }) {
    const status = getFollowStatus(user);
    if (status === 'accepted') {
      return (
        <TouchableOpacity
          style={[styles.followBtn, { borderColor: theme.sep, borderWidth: 1.5 }]}
          onPress={() => handleFollowPress(user)}
        >
          <Text style={[styles.followBtnText, { color: theme.textSub }]}>Following</Text>
        </TouchableOpacity>
      );
    }
    if (status === 'pending') {
      return (
        <TouchableOpacity
          style={[styles.followBtn, { backgroundColor: theme.surface }]}
          onPress={() => handleFollowPress(user)}
        >
          <Text style={[styles.followBtnText, { color: theme.textSub }]}>Requested</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: theme.accent }]}
        onPress={() => handleFollowPress(user)}
      >
        <Text style={[styles.followBtnText, { color: '#fff' }]}>
          {user.isPrivate ? 'Request' : 'Follow'}
        </Text>
      </TouchableOpacity>
    );
  }

  function UserRow({ user }: { user: SearchUser }) {
    const initials = (user.fullName || user.username || '?')[0]?.toUpperCase() ?? '?';
    const colors = avatarColor(user.id);
    return (
      <TouchableOpacity
        style={[styles.userRow, { borderBottomColor: theme.sep }]}
        onPress={() => handleUserPress(user)}
        activeOpacity={0.7}
      >
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={colors} style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {user.fullName || user.username}
            </Text>
            {user.isPrivate && (
              <Ionicons name="lock-closed" size={11} color={theme.textMuted} style={{ marginLeft: 4, marginTop: 2 }} />
            )}
          </View>
          <Text style={[styles.userHandle, { color: theme.textMuted }]}>@{user.username}</Text>
        </View>
        <FollowButton user={user} />
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>


        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <View style={[styles.searchWrap, { backgroundColor: theme.inputBg }]}>
            <Ionicons name="search-outline" size={16} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search users..."
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: theme.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 60 }} />
        ) : searched && results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="person-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No users found</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              Try a different name or username
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={u => u.id}
            renderItem={({ item }) => <UserRow user={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              results.length > 0 ? (
                <Text style={[styles.resultCount, { color: theme.textMuted }]}>
                  {results.length} {results.length === 1 ? 'user' : 'users'} found
                </Text>
              ) : null
            }
          />
        )}

        {!searched && !loading && (
          contactMatches.length > 0 ? (
            <FlatList
              data={contactMatches}
              keyExtractor={u => u.id}
              renderItem={({ item }) => <UserRow user={item} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={[styles.resultCount, { color: theme.textMuted }]}>
                  People you know on Flair
                </Text>
              }
            />
          ) : (
            <View style={styles.hint}>
              <Ionicons name="people-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.hintText, { color: theme.textMuted }]}>
                Search by name or username
              </Text>
            </View>
          )
        )}
      </SafeAreaView>

      <UserProfileModal
        user={selectedUser}
        visible={!!selectedUser}
        theme={theme}
        isDark={isDark}
        currentUserId={currentUserId}
        onClose={() => {
          // Sync any follow state changes back to the search list
          if (selectedUser) {
            setResults(prev => prev.map(u =>
              u.id === selectedUser.id
                ? { ...u, followStatus: followStates[u.id] ?? u.followStatus }
                : u
            ));
          }
          setSelectedUser(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },
  cancelBtn: { paddingVertical: 6, paddingLeft: 2 },
  cancelText: { fontSize: 15, fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  resultCount: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    textTransform: 'uppercase', paddingVertical: 12,
  },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 15, fontWeight: '700' },
  userHandle: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  followBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  followBtnText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  hint: { alignItems: 'center', paddingTop: 80, gap: 12 },
  hintText: { fontSize: 15, fontWeight: '500' },
});
