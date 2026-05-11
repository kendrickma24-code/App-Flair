import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { lookupAllFlights, FlightInfo } from '../services/flightApi';

export type FlightEditUpdates = {
  note: string;
  photos: string[];
  status: 'upcoming' | 'past';
  journal: string;
  journalPrivate: boolean;
  privacy?: 'public' | 'followers' | 'private';
  fromCode?: string;
  fromCity?: string;
  toCode?: string;
  toCity?: string;
  flightNum?: string;
  date?: string;
  duration?: string;
};

const PRIVACY_OPTIONS: { key: 'public' | 'followers' | 'private'; label: string; icon: string }[] = [
  { key: 'public',    label: 'Public',    icon: 'earth-outline' },
  { key: 'followers', label: 'Followers', icon: 'people-outline' },
  { key: 'private',   label: 'Private',   icon: 'lock-closed-outline' },
];

interface Props {
  flight: Flight | null;
  visible: boolean;
  theme: Theme;
  onClose: () => void;
  onSave: (updates: FlightEditUpdates) => void;
}

export default function EditFlightModal({ flight, visible, theme, onClose, onSave }: Props) {
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming');
  const [journal, setJournal] = useState('');
  const [flightNum, setFlightNum] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [lookupLoading, setLookupLoading] = useState(false);

  // Route state — only changed via lookup, not editable directly
  const [fromCode, setFromCode] = useState('');
  const [fromCity, setFromCity] = useState('');
  const [toCode, setToCode] = useState('');
  const [toCity, setToCity] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (!flight) return;
    setNote(flight.note ?? '');
    setPhotos(flight.photos);
    setStatus(flight.status === 'live' ? 'upcoming' : (flight.status as 'upcoming' | 'past'));
    setJournal(flight.journal ?? '');
    setFlightNum(flight.flightNum ?? '');
    setPrivacy(flight.privacy ?? 'public');
    setFromCode(flight.from.code);
    setFromCity(flight.from.city ?? '');
    setToCode(flight.to.code);
    setToCity(flight.to.city ?? '');
    setDuration(flight.duration ?? '');
    setDate(flight.date ?? '');
  }, [flight?.id, visible]);

  function ddmmyyyyToApiDate(val: string): string {
    const p = val.split('-');
    if (p.length !== 3 || p[2].length !== 4) return val;
    return `${p[2]}-${p[1]}-${p[0]}`;
  }

  function applyFlightInfo(info: FlightInfo) {
    if (info.departure.iata) setFromCode(info.departure.iata);
    if (info.departure.airport) setFromCity(info.departure.airport);
    if (info.arrival.iata) setToCode(info.arrival.iata);
    if (info.arrival.airport) setToCity(info.arrival.airport);
    if (info.duration) setDuration(info.duration);
    if (info.flightNumber) setFlightNum(info.flightNumber);
  }

  async function handleLookup() {
    const num = flightNum.trim();
    const apiDate = ddmmyyyyToApiDate(date.trim());
    if (!num || !apiDate) {
      Alert.alert('Enter a flight number first', 'The flight number is used to look up the route.');
      return;
    }
    setLookupLoading(true);
    try {
      const results = await lookupAllFlights(num, apiDate);
      if (results.length === 1) {
        applyFlightInfo(results[0]);
      } else if (results.length > 1) {
        Alert.alert(
          'Multiple flights found',
          'Which flight were you on?',
          [
            ...results.map(r => ({
              text: `${r.departure.iata} → ${r.arrival.iata}${r.departure.scheduledTime ? '  ' + r.departure.scheduledTime.slice(11, 16) : ''}`,
              onPress: () => applyFlightInfo(r),
            })),
            { text: 'Cancel', style: 'cancel' as const },
          ],
        );
      }
    } catch {
      Alert.alert('Not found', 'Could not find that flight. Check the flight number and try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function pickPhotos() {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add trip photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  }

  const s = theme;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: s.card }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.handle, { backgroundColor: s.sep }]} />
        <View style={styles.header}>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: s.surface }]} onPress={onClose}>
            <Ionicons name="close" size={16} color={s.textSub} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: s.text }]}>Edit Flight</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: s.accent }]}
            onPress={() => onSave({
              note, photos, status, journal,
              journalPrivate: flight?.journalPrivate ?? true,
              privacy,
              fromCode: fromCode || undefined,
              fromCity: fromCity || undefined,
              toCode: toCode || undefined,
              toCity: toCity || undefined,
              flightNum: flightNum || undefined,
              date: date || undefined,
              duration: duration || undefined,
            })}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Route — read-only display, updated via lookup */}
          <View style={[styles.routePreview, { backgroundColor: s.surface }]}>
            <Text style={[styles.routeCode, { color: s.text }]}>{fromCode || '—'}</Text>
            <Ionicons name="arrow-forward" size={14} color={s.accent} />
            <Text style={[styles.routeCode, { color: s.text }]}>{toCode || '—'}</Text>
            {date ? <Text style={[styles.routeMeta, { color: s.textMuted }]}>· {date}</Text> : null}
            {duration ? <Text style={[styles.routeMeta, { color: s.textMuted }]}>· {duration}</Text> : null}
          </View>

          {/* Flight number */}
          <Text style={[styles.label, { color: s.textMuted }]}>FLIGHT NUMBER</Text>
          <TextInput
            style={[styles.input, styles.flightNumInput, { backgroundColor: s.inputBg, color: s.text }]}
            value={flightNum}
            onChangeText={setFlightNum}
            placeholder="e.g. UA 100"
            placeholderTextColor={s.textMuted}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={handleLookup}
          />

          {/* Look up button */}
          <TouchableOpacity
            style={[styles.lookupBtn, { backgroundColor: s.surface }]}
            onPress={handleLookup}
            disabled={lookupLoading}
          >
            {lookupLoading
              ? <ActivityIndicator size="small" color={s.accent} />
              : <Ionicons name="search-outline" size={15} color={s.accent} />}
            <Text style={[styles.lookupBtnText, { color: s.accent }]}>
              {lookupLoading ? 'Looking up…' : 'Look up flight'}
            </Text>
          </TouchableOpacity>

          {/* Status toggle */}
          <Text style={[styles.label, { color: s.textMuted }]}>STATUS</Text>
          <View style={[styles.typeToggle, { backgroundColor: s.inputBg }]}>
            <TouchableOpacity
              style={[styles.typeBtn, status === 'upcoming' && { backgroundColor: s.accent }]}
              onPress={() => setStatus('upcoming')}
            >
              <Text style={[styles.typeBtnText, { color: status === 'upcoming' ? '#fff' : s.textSub }]}>Upcoming</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, status === 'past' && { backgroundColor: s.accent }]}
              onPress={() => setStatus('past')}
            >
              <Text style={[styles.typeBtnText, { color: status === 'past' ? '#fff' : s.textSub }]}>Past</Text>
            </TouchableOpacity>
          </View>

          {/* Note */}
          <Text style={[styles.label, { color: s.textMuted }]}>NOTE</Text>
          <TextInput
            style={[styles.input, styles.noteInput, { backgroundColor: s.inputBg, color: s.text }]}
            placeholder="What's the trip about?"
            placeholderTextColor={s.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />

          {/* Journal */}
          <Text style={[styles.label, { color: s.textMuted }]}>JOURNAL</Text>
          <TextInput
            style={[styles.input, styles.journalInput, { backgroundColor: s.inputBg, color: s.text }]}
            placeholder="Write about this trip…"
            placeholderTextColor={s.textMuted}
            value={journal}
            onChangeText={setJournal}
            multiline
            numberOfLines={5}
          />

          {/* Who can see this */}
          <Text style={[styles.label, { color: s.textMuted }]}>WHO CAN SEE THIS</Text>
          <View style={[styles.privacyRow, { backgroundColor: s.inputBg }]}>
            {PRIVACY_OPTIONS.map(opt => {
              const active = privacy === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.privacyBtn, active && { backgroundColor: s.accent }]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <Ionicons name={opt.icon as any} size={15} color={active ? '#fff' : s.textSub} />
                  <Text style={[styles.privacyBtnLabel, { color: active ? '#fff' : s.textSub }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Photos */}
          <Text style={[styles.label, { color: s.textMuted }]}>TRIP PHOTOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            <TouchableOpacity
              style={[styles.addPhotoBtn, { borderColor: s.sep, backgroundColor: s.surface }]}
              onPress={pickPhotos}
            >
              <Ionicons name="camera-outline" size={24} color={s.textMuted} />
              <Text style={[styles.addPhotoLabel, { color: s.textMuted }]}>Add</Text>
            </TouchableOpacity>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close" size={10} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
  },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 8 },

  routePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 14, marginBottom: 20,
  },
  routeCode: { fontSize: 18, fontWeight: '800' },
  routeMeta: { fontSize: 13, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '500', marginBottom: 14 },
  flightNumInput: { fontSize: 22, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  journalInput: { minHeight: 120, textAlignVertical: 'top', marginBottom: 20 },

  lookupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 20, justifyContent: 'center',
  },
  lookupBtnText: { fontSize: 14, fontWeight: '600' },

  typeToggle: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 20, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '700' },

  privacyRow: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 20, gap: 4 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  privacyBtnLabel: { fontSize: 13, fontWeight: '700' },

  photoStrip: { marginTop: 4, marginBottom: 8 },
  addPhotoBtn: {
    width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4, marginRight: 8,
  },
  addPhotoLabel: { fontSize: 10, fontWeight: '600' },
  photoItem: { width: 72, height: 72, marginRight: 8, position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 14 },
  removePhoto: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
});
