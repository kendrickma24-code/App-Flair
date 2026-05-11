import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback,
  Animated, ScrollView, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Trip } from '../services/tripGrouping';
import { Flight } from '../data/mockData';

type Privacy = 'public' | 'followers' | 'private';

interface Props {
  visible: boolean;
  trip: Trip;
  theme: Theme;
  isDark?: boolean;
  onClose: () => void;
  onRename: () => void;
  onAddFlight?: () => void;
  onEditLeg: (leg: Flight) => void;
  onDeleteLeg: (leg: Flight) => void;
  onChangePrivacy?: (privacy: Privacy) => void;
  onDeleteTrip?: () => void;
}

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: string }[] = [
  { value: 'public',    label: 'Public',     icon: 'globe-outline' },
  { value: 'followers', label: 'Followers',  icon: 'people-outline' },
  { value: 'private',   label: 'Private',    icon: 'lock-closed-outline' },
];

export default function TripActionSheet({
  visible, trip, theme, isDark = true,
  onClose, onRename, onAddFlight,
  onEditLeg, onDeleteLeg, onChangePrivacy, onDeleteTrip,
}: Props) {
  const slideY = useRef(new Animated.Value(600)).current;

  const currentPrivacy: Privacy = (trip.legs[0]?.privacy as Privacy) ?? 'public';

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 12,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 600, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  function close() {
    Animated.timing(slideY, {
      toValue: 600, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  }

  function handleDeleteTrip() {
    close();
    setTimeout(() => {
      Alert.alert('Delete trip', 'This will delete all flights in this trip. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteTrip },
      ]);
    }, 280);
  }

  function handleDeleteLeg(leg: Flight) {
    close();
    setTimeout(() => {
      Alert.alert(
        `Remove ${leg.from.code} → ${leg.to.code}`,
        'Remove this flight from your log?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDeleteLeg(leg) },
        ]
      );
    }, 280);
  }

  function handleEditLeg(leg: Flight) {
    close();
    setTimeout(() => onEditLeg(leg), 280);
  }

  const glassOverlay = isDark ? 'rgba(8,14,28,0.88)' : 'rgba(240,242,250,0.92)';
  const sep = theme.sep;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        <BlurView intensity={isDark ? 70 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay, borderRadius: 24 }]} />

        {/* Handle */}
        <View style={s.handleWrap}>
          <View style={[s.handle, { backgroundColor: theme.textMuted, opacity: 0.4 }]} />
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

          {/* ── Trip context ── */}
          <View style={s.tripContext}>
            <Text style={[s.tripName, { color: theme.text }]} numberOfLines={1}>
              {trip.primaryDestinationCity || trip.primaryDestination || trip.airportSequence.join(' › ')}
            </Text>
            <Text style={[s.tripMeta, { color: theme.textMuted }]}>
              {trip.airportSequence.join(' › ')}
              {'  ·  '}
              {trip.legs.length} {trip.legs.length === 1 ? 'flight' : 'flights'}
            </Text>
          </View>

          <View style={[s.divider, { backgroundColor: sep }]} />

          {/* ── General actions ── */}
          <ActionRow
            icon="pencil-outline"
            label="Rename trip"
            theme={theme}
            onPress={() => { close(); setTimeout(onRename, 280); }}
          />
          {onAddFlight && (
            <ActionRow
              icon="add-circle-outline"
              label="Add flight to trip"
              theme={theme}
              onPress={() => { close(); setTimeout(onAddFlight!, 280); }}
            />
          )}

          {/* ── Flights ── */}
          <View style={[s.divider, { backgroundColor: sep }]} />
          <Text style={[s.sectionLabel, { color: theme.textMuted }]}>
            {trip.legs.length === 1 ? 'FLIGHT' : 'FLIGHTS'}
          </Text>

          {trip.legs.map((leg, i) => (
            <View key={leg.id}>
              {i > 0 && <View style={[s.innerDivider, { backgroundColor: sep }]} />}
              <View style={s.legRow}>
                <View style={s.legInfo}>
                  <View style={s.legRoute}>
                    <Text style={[s.legCode, { color: theme.text }]}>{leg.from.code}</Text>
                    <Ionicons name="arrow-forward" size={12} color={theme.textMuted} />
                    <Text style={[s.legCode, { color: theme.text }]}>{leg.to.code}</Text>
                    {leg.flightNum ? (
                      <Text style={[s.legNum, { color: theme.textMuted }]}>{leg.flightNum}</Text>
                    ) : null}
                  </View>
                  {(leg.from.city || leg.to.city) ? (
                    <Text style={[s.legCities, { color: theme.textMuted }]} numberOfLines={1}>
                      {[leg.from.city, leg.to.city].filter(Boolean).join(' → ')}
                    </Text>
                  ) : null}
                </View>
                <View style={s.legActions}>
                  <TouchableOpacity
                    style={[s.legBtn, { backgroundColor: theme.accentBg }]}
                    onPress={() => handleEditLeg(leg)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  >
                    <Ionicons name="create-outline" size={15} color={theme.accent} />
                    <Text style={[s.legBtnText, { color: theme.accent }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.legBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                    onPress={() => handleDeleteLeg(leg)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {/* ── Privacy ── */}
          {onChangePrivacy && (
            <>
              <View style={[s.divider, { backgroundColor: sep }]} />
              <Text style={[s.sectionLabel, { color: theme.textMuted }]}>WHO CAN SEE THIS</Text>
              <View style={s.privacyRow}>
                {PRIVACY_OPTIONS.map(opt => {
                  const active = currentPrivacy === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        s.privacyBtn,
                        active
                          ? { backgroundColor: theme.accent }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                      ]}
                      onPress={() => { onChangePrivacy(opt.value); close(); }}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={14}
                        color={active ? '#fff' : theme.textMuted}
                      />
                      <Text style={[s.privacyLabel, { color: active ? '#fff' : theme.textMuted }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Delete trip ── */}
          {onDeleteTrip && (
            <>
              <View style={[s.divider, { backgroundColor: sep }]} />
              <TouchableOpacity style={s.deleteRow} onPress={handleDeleteTrip} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={s.deleteLabel}>Delete trip</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function ActionRow({
  icon, label, theme, onPress, destructive,
}: {
  icon: string; label: string; theme: Theme;
  onPress: () => void; destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.actionIcon, { backgroundColor: destructive ? 'rgba(239,68,68,0.12)' : theme.accentBg }]}>
        <Ionicons name={icon as any} size={17} color={destructive ? '#EF4444' : theme.accent} />
      </View>
      <Text style={[s.actionLabel, { color: destructive ? '#EF4444' : theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },

  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle:     { width: 36, height: 4, borderRadius: 2 },

  tripContext: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  tripName:    { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  tripMeta:    { fontSize: 12, fontWeight: '500', marginTop: 3 },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
  },

  // Action rows (Rename, Add flight)
  actionRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, gap: 14 },
  actionIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  // Flight rows
  legRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  legInfo:   { flex: 1 },
  legRoute:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legCode:   { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  legNum:    { fontSize: 12, fontWeight: '500' },
  legCities: { fontSize: 11, fontWeight: '400', marginTop: 2 },
  legActions:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  legBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  legBtnText:{ fontSize: 12, fontWeight: '600' },
  innerDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },

  // Privacy
  privacyRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  privacyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 12,
  },
  privacyLabel: { fontSize: 12, fontWeight: '600' },

  // Delete
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  deleteLabel: { fontSize: 15, fontWeight: '500', color: '#EF4444' },
});
