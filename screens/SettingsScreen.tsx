import React, { useState } from 'react';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, TextInput, Image, Alert,
  KeyboardAvoidingView, Platform, Switch, Modal, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Theme } from '../constants/theme';
import { UserProfile } from '../App';
import { Flight } from '../data/mockData';
import { saveProfile } from '../services/db';
import { supabase } from '../lib/supabase';

interface Props {
  theme: Theme;
  isDark: boolean;
  userProfile: UserProfile;
  deletedFlights: Flight[];
  onUpdateProfile: (profile: UserProfile) => void;
  onRestoreFlight: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onClose: () => void;
  onSignOut: () => void;
}

function daysUntilPurge(deletedAt: string): number {
  const deletedMs = new Date(deletedAt).getTime();
  const purgeMs = deletedMs + 14 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeMs - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function SettingsScreen({
  theme, isDark, userProfile, deletedFlights, onUpdateProfile, onRestoreFlight, onPermanentDelete, onClose, onSignOut,
}: Props) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [username, setUsername] = useState(userProfile.username);
  const [bio, setBio] = useState(userProfile.bio);
  const [avatarUri, setAvatarUri] = useState(userProfile.avatarUri);
  const [isPrivate, setIsPrivate] = useState(userProfile.isPrivate ?? false);
  const [dirty, setDirty] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  function mark(setter: (v: any) => void) {
    return (val: any) => { setter(val); setDirty(true); };
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPendingUri(result.assets[0].uri);
  }

  async function takeAvatar() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPendingUri(result.assets[0].uri);
  }

  function confirmPendingAvatar() {
    if (!pendingUri) return;
    setAvatarUri(pendingUri);
    setPendingUri(null);
    setDirty(true);
  }

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }
    try {
      const updated: UserProfile = { ...userProfile, name, username: username.trim(), bio, avatarUri, isPrivate };
      await saveProfile(updated); // uploads avatar + saves to DB
      onUpdateProfile(updated);
      setDirty(false);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile. Try again.');
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        onSignOut();
      }},
    ]);
  }

  const initials = (name || username || '?')[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.sep }]}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: dirty ? theme.accent : theme.surface }]}
        >
          <Text style={[styles.saveBtnText, { color: dirty ? '#fff' : theme.textMuted }]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Profile photo */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PROFILE PHOTO</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.avatarRow}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.avatarActions}>
                <TouchableOpacity
                  style={[styles.avatarBtn, { backgroundColor: theme.accentBg }]}
                  onPress={pickAvatar}
                >
                  <Ionicons name="image-outline" size={16} color={theme.accent} />
                  <Text style={[styles.avatarBtnText, { color: theme.accent }]}>Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.avatarBtn, { backgroundColor: theme.surface }]}
                  onPress={takeAvatar}
                >
                  <Ionicons name="camera-outline" size={16} color={theme.textSub} />
                  <Text style={[styles.avatarBtnText, { color: theme.textSub }]}>Take Photo</Text>
                </TouchableOpacity>
                {avatarUri && (
                  <TouchableOpacity
                    style={[styles.avatarBtn, { backgroundColor: theme.surface }]}
                    onPress={() => { setAvatarUri(null); setDirty(true); }}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.past} />
                    <Text style={[styles.avatarBtnText, { color: theme.past }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Profile info */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PROFILE</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>DISPLAY NAME</Text>
            <TextInput
              style={[styles.field, { backgroundColor: theme.inputBg, color: theme.text }]}
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={mark(setName)}
              autoCapitalize="words"
            />

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>USERNAME</Text>
            <View style={[styles.usernameWrap, { backgroundColor: theme.inputBg }]}>
              <Text style={[styles.atSign, { color: theme.textMuted }]}>@</Text>
              <TextInput
                style={[styles.usernameInput, { color: theme.text }]}
                placeholder="yourhandle"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={mark(setUsername)}
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>BIO</Text>
            <TextInput
              style={[styles.field, styles.bioField, { backgroundColor: theme.inputBg, color: theme.text }]}
              placeholder="Tell travelers about yourself…"
              placeholderTextColor={theme.textMuted}
              value={bio}
              onChangeText={mark(setBio)}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Privacy */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PRIVACY</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>Private Account</Text>
                <Text style={[styles.privacySub, { color: theme.textMuted }]}>
                  {isPrivate
                    ? 'Only approved followers can see your flights'
                    : 'Anyone can follow and see your flights'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={v => { setIsPrivate(v); setDirty(true); }}
                trackColor={{ false: theme.surface, true: theme.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Recently Deleted */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>RECENTLY DELETED</Text>
          <View style={[styles.card, { backgroundColor: theme.card, gap: 0 }]}>
            {deletedFlights.length === 0 ? (
              <Text style={[styles.emptyDeleted, { color: theme.textMuted }]}>No recently deleted flights</Text>
            ) : (
              deletedFlights.map((f, i) => {
                const days = daysUntilPurge((f as any).deletedAt ?? new Date().toISOString());
                return (
                  <View
                    key={f.id}
                    style={[
                      styles.deletedRow,
                      { borderTopColor: theme.sep },
                      i === 0 && { borderTopWidth: 0 },
                    ]}
                  >
                    <View style={styles.deletedInfo}>
                      <Text style={[styles.deletedRoute, { color: theme.text }]}>
                        {f.from.code} → {f.to.code}
                      </Text>
                      <Text style={[styles.deletedMeta, { color: theme.textMuted }]}>
                        {f.flightNum ? `${f.flightNum} · ` : ''}{f.date}
                      </Text>
                      <Text style={[styles.deletedExpiry, { color: '#FF9500' }]}>
                        Deleted in {days} day{days !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.deletedActions}>
                      <TouchableOpacity
                        style={[styles.restoreBtn, { backgroundColor: theme.accentBg }]}
                        onPress={() => onRestoreFlight(f.id)}
                      >
                        <Text style={[styles.restoreBtnText, { color: theme.accent }]}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => Alert.alert(
                          'Delete Permanently',
                          'This flight will be permanently deleted and cannot be recovered.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete Forever', style: 'destructive', onPress: () => onPermanentDelete(f.id) },
                          ]
                        )}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Legal */}
          <TouchableOpacity
            style={[styles.legalBtn, { backgroundColor: theme.card }]}
            onPress={() => setShowPrivacy(true)}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
            <Text style={[styles.legalText, { color: theme.textSub }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.legalBtn, { backgroundColor: theme.card, marginTop: 8 }]}
            onPress={() => Linking.openURL('mailto:support@flairapp.co')}
          >
            <Ionicons name="mail-outline" size={18} color={theme.textMuted} />
            <Text style={[styles.legalText, { color: theme.textSub }]}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: theme.card }]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showPrivacy && (
        <View style={StyleSheet.absoluteFill}>
          <PrivacyPolicyScreen
            theme={theme}
            isDark={isDark}
            onClose={() => setShowPrivacy(false)}
          />
        </View>
      )}

      {/* Circular photo preview */}
      <Modal visible={!!pendingUri} transparent animationType="fade" onRequestClose={() => setPendingUri(null)}>
        <View style={avatarPreview.backdrop}>
          <Text style={avatarPreview.title}>Profile Photo Preview</Text>
          {pendingUri && (
            <Image source={{ uri: pendingUri }} style={avatarPreview.circle} resizeMode="cover" />
          )}
          <Text style={avatarPreview.hint}>This is how your photo will appear</Text>
          <View style={avatarPreview.btnRow}>
            <TouchableOpacity style={avatarPreview.retake} onPress={() => setPendingUri(null)}>
              <Text style={avatarPreview.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={avatarPreview.use} onPress={confirmPendingAvatar}>
              <Text style={avatarPreview.useText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  headerBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 20, gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingHorizontal: 4,
  },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, color: '#fff', fontWeight: '700' },
  avatarActions: { flex: 1, gap: 8 },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  avatarBtnText: { fontSize: 13, fontWeight: '600' },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    textTransform: 'uppercase', marginBottom: 6, marginTop: 8,
  },
  field: { borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '500', marginBottom: 4 },
  bioField: { minHeight: 80, textAlignVertical: 'top' },
  usernameWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 12, marginBottom: 4 },
  atSign: { fontSize: 16, fontWeight: '700' },
  usernameInput: { flex: 1, padding: 12, paddingLeft: 4, fontSize: 15, fontWeight: '500' },
  legalBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, borderRadius: 16, padding: 16, marginTop: 16,
  },
  legalText: { fontSize: 15, fontWeight: '500' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, padding: 16, marginTop: 8,
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#FF3B30' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  privacyInfo: { flex: 1, marginRight: 12 },
  privacyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  privacySub: { fontSize: 13, fontWeight: '500', lineHeight: 20 },
  emptyDeleted: { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 16 },
  deletedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 0.5,
  },
  deletedInfo: { flex: 1, gap: 2 },
  deletedRoute: { fontSize: 15, fontWeight: '700' },
  deletedMeta: { fontSize: 12, fontWeight: '500' },
  deletedExpiry: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  deletedActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restoreBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  restoreBtnText: { fontSize: 13, fontWeight: '700' },
});

const PREVIEW_SIZE = Dimensions.get('window').width * 0.65;
const avatarPreview = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  circle: {
    width: PREVIEW_SIZE, height: PREVIEW_SIZE,
    borderRadius: PREVIEW_SIZE / 2,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retake: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  retakeText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  use: {
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 30,
    backgroundColor: '#fff',
  },
  useText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
