import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, ScrollView,
  TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight, FlightStatus } from '../data/mockData';
import FlightCard from '../components/FlightCard';
import SearchModal from '../components/SearchModal';
import LogoMark from '../components/LogoMark';

type Filter = 'all' | FlightStatus;

interface Props {
  theme: Theme;
  isDark: boolean;
  flights: Flight[];
  currentUserId: string;
  currentUserName: string;
  currentUserInitials: string;
  currentUserAvatarUri?: string | null;
  onEditFlight: (id: string, updates: import('../components/EditFlightModal').FlightEditUpdates) => void;
  onDeleteFlight: (id: string) => void;
  onRefresh: () => Promise<void>;
}

export default function FeedScreen({ theme, isDark, flights, currentUserId, currentUserName, currentUserInitials, currentUserAvatarUri, onEditFlight, onDeleteFlight, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live' },
    { key: 'past', label: 'Past' },
  ];

  async function handleRefresh() {
    setRefreshing(true);
    try { await onRefresh(); } catch {}
    setRefreshing(false);
  }

  // Build sections
  const sections = (() => {
    if (filter !== 'all') {
      const items = flights.filter(f => f.status === filter);
      return [{ title: '', data: items }];
    }
    const active = flights.filter(f => f.status !== 'past');
    const past = flights.filter(f => f.status === 'past');
    const result = [];
    if (active.length > 0) result.push({ title: '', data: active });
    if (past.length > 0) result.push({ title: 'Past Flights', data: past });
    if (active.length === 0 && past.length === 0) result.push({ title: '', data: [] });
    return result;
  })();

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <View style={styles.wordmarkRow}>
          <LogoMark size={28} variant="white" color={theme.text} />
          <Text style={[styles.wordmark, { color: theme.text }]}>
            Flair
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.surface }]} onPress={() => setShowSearch(true)}>
            <Ionicons name="search-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
        >
          {chips.map(item => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, { backgroundColor: active ? theme.accentBg : theme.surface }]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.chipText, { color: active ? theme.accent : theme.textSub }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={f => f.id}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
        renderItem={({ item }) => (
          <FlightCard
            flight={item}
            theme={theme}
            isDark={isDark}
            isOwn={item.userId === currentUserId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserInitials={currentUserInitials}
            currentUserAvatarUri={currentUserAvatarUri}
            onDelete={() => onDeleteFlight(item.id)}
            onEdit={updates => onEditFlight(item.id, updates)}
          />
        )}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.title}</Text>
              <View style={[styles.sectionLine, { backgroundColor: theme.sep }]} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="airplane-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {filter === 'all'
                ? 'No flights yet — tap + to log your first'
                : `No ${filter} flights`}
            </Text>
          </View>
        }
      />

      <SearchModal
        visible={showSearch}
        theme={theme}
        isDark={isDark}
        currentUserId={currentUserId}
        onClose={() => setShowSearch(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontSize: 26, fontWeight: '900', letterSpacing: -1.2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
  },
  chipRow: { height: 48 },
  chipList: { paddingHorizontal: 16, gap: 7, alignItems: 'center', flexDirection: 'row', flex: 1 },
  chip: { paddingHorizontal: 17, paddingVertical: 8, borderRadius: 22 },
  chipText: { fontSize: 13, fontWeight: '600', lineHeight: 16, includeFontPadding: false, letterSpacing: 0.1 },
  feedContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 120 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', paddingTop: 80, gap: 14, paddingHorizontal: 48 },
  emptyText: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 23 },
});
