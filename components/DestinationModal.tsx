import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { SuggestedDestination, DestinationVisitor, getDestinationVisitors } from '../services/messages';
import ChatModal from './ChatModal';

interface Props {
  destination: SuggestedDestination | null;
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
}

export default function DestinationModal({ destination, visible, theme, isDark, currentUserId, currentUserName, onClose }: Props) {
  const [visitors, setVisitors] = useState<DestinationVisitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatTarget, setChatTarget] = useState<DestinationVisitor | null>(null);

  useEffect(() => {
    if (!visible || !destination) return;
    setLoading(true);
    getDestinationVisitors(destination.code)
      .then(setVisitors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, destination?.code]);

  if (!destination) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>


          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.sep }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerCode, { color: theme.text }]}>{destination.code}</Text>
              <Text style={[styles.headerCity, { color: theme.textMuted }]}>{destination.city}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: theme.accentBg }]}>
            <Ionicons name="location" size={32} color={theme.accent} />
            <Text style={[styles.heroCode, { color: theme.accent }]}>{destination.code}</Text>
            <Text style={[styles.heroCity, { color: theme.text }]}>{destination.city}</Text>
            <Text style={[styles.heroCount, { color: theme.textMuted }]}>
              {destination.visitorCount} traveler{destination.visitorCount !== 1 ? 's' : ''} been here
            </Text>
          </View>

          {/* Travelers list */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>TRAVELERS</Text>

          {loading ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {visitors.filter(v => v.userId !== currentUserId).map(v => (
                <View key={v.userId} style={[styles.personRow, { borderBottomColor: theme.sep }]}>
                  <View style={styles.personLeft}>
                    {v.avatarUrl ? (
                      <Image source={{ uri: v.avatarUrl }} style={styles.personAvatar} />
                    ) : (
                      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{v.initials}</Text>
                      </LinearGradient>
                    )}
                    <View>
                      <Text style={[styles.personName, { color: theme.text }]}>
                        {v.name || v.username || 'Traveler'}
                      </Text>
                      {v.username ? (
                        <Text style={[styles.personHandle, { color: theme.textMuted }]}>@{v.username}</Text>
                      ) : null}
                      {v.flightDate ? (
                        <Text style={[styles.personDate, { color: theme.textMuted }]}>Flew {v.flightDate}</Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.msgBtn, { backgroundColor: theme.accentBg }]}
                    onPress={() => setChatTarget(v)}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={theme.accent} />
                    <Text style={[styles.msgBtnText, { color: theme.accent }]}>Message</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {!loading && visitors.filter(v => v.userId !== currentUserId).length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={40} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No other travelers here yet
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <ChatModal
        visible={!!chatTarget}
        theme={theme}
        isDark={isDark}
        currentUserId={currentUserId}
        participant={chatTarget ? {
          userId: chatTarget.userId,
          name: chatTarget.name,
          username: chatTarget.username,
          initials: chatTarget.initials,
          avatarUrl: chatTarget.avatarUrl,
        } : null}
        onClose={() => setChatTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  closeBtn: { width: 40 },
  headerCenter: { alignItems: 'center' },
  headerCode: { fontSize: 18, fontWeight: '800' },
  headerCity: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  hero: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  heroCode: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  heroCity: { fontSize: 18, fontWeight: '700' },
  heroCount: { fontSize: 13, fontWeight: '500', marginTop: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase',
    paddingHorizontal: 16, marginTop: 16, marginBottom: 4,
  },
  personRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  personLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  personName: { fontSize: 15, fontWeight: '700' },
  personHandle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  personDate: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  msgBtnText: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
