import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface Props {
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  onDone: () => void;
}

export default function SetPasswordModal({ visible, theme, isDark, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (password.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setDone(true);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {done ? (
            <View style={styles.successWrap}>
              <View style={[styles.successIcon, { backgroundColor: theme.upcomingBg }]}>
                <Ionicons name="checkmark-circle" size={48} color={theme.upcoming} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Password updated!</Text>
              <Text style={[styles.sub, { color: theme.textMuted }]}>You can now sign in with your new password.</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={onDone}>
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Set new password</Text>
              <Text style={[styles.sub, { color: theme.textMuted }]}>Choose a new password for your account.</Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>NEW PASSWORD</Text>
              <TextInput
                style={[styles.field, { backgroundColor: theme.inputBg, color: theme.text }]}
                placeholder="At least 8 characters"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>CONFIRM PASSWORD</Text>
              <TextInput
                style={[styles.field, { backgroundColor: theme.inputBg, color: theme.text }]}
                placeholder="Repeat your password"
                placeholderTextColor={theme.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }, (password.length < 8 || loading) && { opacity: 0.45 }]}
                disabled={password.length < 8 || loading}
                onPress={handleSave}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  successWrap: { alignItems: 'center', gap: 14 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 28 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7 },
  field: { borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '500', marginBottom: 18 },
  primaryBtn: { borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
