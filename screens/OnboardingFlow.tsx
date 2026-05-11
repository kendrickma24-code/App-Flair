import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, Alert, Animated, Easing,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { UserProfile } from '../App';
import { supabase } from '../lib/supabase';
import { saveProfile, loadProfile } from '../services/db';
import LogoMark from '../components/LogoMark';

type Step = 'welcome' | 'signup' | 'signin' | 'forgot' | 'profile' | 'privacy' | 'contacts' | 'allset';

const { width: SW, height: SH } = Dimensions.get('window');

const STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: Math.random() * SW,
  y: Math.random() * SH * 0.75,
  size: Math.random() * 1.8 + 0.6,
  maxOpacity: Math.random() * 0.55 + 0.2,
  duration: Math.random() * 2800 + 1400,
  delay: Math.random() * 4000,
}));

function StarField() {
  const anims = useRef(STARS.map(s => new Animated.Value(0))).current;

  useEffect(() => {
    STARS.forEach((star, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.delay(star.delay),
          Animated.loop(
            Animated.sequence([
              Animated.timing(anims[i], {
                toValue: star.maxOpacity,
                duration: star.duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(anims[i], {
                toValue: 0.04,
                duration: star.duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ])
          ),
        ]).start();
      };
      loop();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={{
            position: 'absolute',
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#fff',
            opacity: anims[i],
            // glow for slightly bigger stars
            ...(star.size > 2 ? {
              shadowColor: '#fff',
              shadowOpacity: 0.9,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 0 },
            } : {}),
          }}
        />
      ))}
    </View>
  );
}

interface Props {
  theme: Theme;
  isDark: boolean;
  initialStep?: Step;
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingFlow({ theme, isDark, initialStep, onComplete }: Props) {
  const [step, setStep] = useState<Step>(initialStep ?? 'signin');

  // Auth
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authUserId, setAuthUserId] = useState('');

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'sent' | 'notfound'>('idle');

  // Profile
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Privacy
  const [isPrivate, setIsPrivate] = useState(false);

  // Contacts
  const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');
  const [contactCount, setContactCount] = useState(0);

  function handleNameChange(val: string) {
    setName(val);
    if (!username) {
      setUsername(val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15));
    }
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to set a profile photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ── Sign Up ──────────────────────────────────────────────────────
  async function handleSignUp() {
    setAuthLoading(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    if (!data.user) { setAuthError('Something went wrong. Try again.'); return; }
    setAuthUserId(data.user.id);
    setStep('profile');
  }

  // ── Sign In ──────────────────────────────────────────────────────
  async function handleSignIn() {
    setAuthLoading(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password: signInPassword,
    });
    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    if (!data.user) { setAuthError('Something went wrong. Try again.'); return; }

    const profile = await loadProfile(data.user.id);
    onComplete(profile ?? { id: data.user.id, name: '', username: '', bio: '', avatarUri: null, isPrivate: false });
  }

  // ── Save profile after setup ─────────────────────────────────────
  async function handleSaveProfile() {
    if (!username.trim()) { Alert.alert('Username required'); return; }
    setProfileLoading(true);
    try {
      const profile: UserProfile = { id: authUserId, name, username: username.trim(), bio, avatarUri, isPrivate };
      await saveProfile(profile);
      setStep('privacy');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  // ── Connect contacts ─────────────────────────────────────────────
  async function handleConnectContacts() {
    setContactStatus('loading');
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') { setContactStatus('denied'); return; }
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name] });
    setContactCount(data.length);
    setContactStatus('done');
    setTimeout(() => setStep('allset'), 700);
  }

  function finish() {
    onComplete({ id: authUserId, name, username, bio, avatarUri, isPrivate });
  }

  function ProgressDots({ current, total }: { current: number; total: number }) {
    return (
      <View style={styles.progressRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.progressDot, { backgroundColor: i < current ? theme.accent : theme.sep }]} />
        ))}
      </View>
    );
  }

  // ── Sign Up ──────────────────────────────────────────────────────
  if (step === 'signup') return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
      <StarField />
      <SafeAreaView edges={["top","bottom"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.back} onPress={() => setStep('signin')}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.authBrand}>
              <LogoMark size={38} variant="white" />
            </View>
            <Text style={styles.authTitle}>Create account</Text>
            <Text style={styles.authSub}>Join the Flair community</Text>

            <View style={styles.authFields}>
              <TextInput style={styles.authField} placeholder="Full name" placeholderTextColor="rgba(255,255,255,0.35)" value={name} onChangeText={handleNameChange} autoCapitalize="words" />
              <View style={styles.authFieldDivider} />
              <TextInput style={styles.authField} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.authFieldDivider} />
              <TextInput style={styles.authField} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.35)" value={password} onChangeText={setPassword} secureTextEntry />
            </View>

            {authError && <Text style={styles.authError}>{authError}</Text>}

            <TouchableOpacity
              style={[styles.authBtn, (!name || !email || password.length < 6 || authLoading) && { opacity: 0.45 }]}
              disabled={!name || !email || password.length < 6 || authLoading}
              onPress={handleSignUp}
            >
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>Continue</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setAuthError(null); setStep('signin'); }}>
              <Text style={styles.authSwitch}>
                Already have an account?{'  '}
                <Text style={styles.authSwitchAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );

  // ── Sign In ──────────────────────────────────────────────────────
  if (step === 'signin') return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
      <StarField />
      <SafeAreaView edges={["top","bottom"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.authBrand}>
              <LogoMark size={38} variant="white" />
            </View>
            <Text style={styles.authTitle}>Welcome back</Text>
            <Text style={styles.authSub}>Sign in to your account</Text>

            <View style={styles.authFields}>
              <TextInput style={styles.authField} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.35)" value={signInEmail} onChangeText={setSignInEmail} keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.authFieldDivider} />
              <TextInput style={styles.authField} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.35)" value={signInPassword} onChangeText={setSignInPassword} secureTextEntry />
            </View>

            <TouchableOpacity style={styles.forgotRow} onPress={() => {
              setResetEmail(signInEmail.trim());
              setResetStatus('idle');
              setStep('forgot');
            }}>
              <Text style={styles.authForgot}>Forgot password?</Text>
            </TouchableOpacity>

            {authError && <Text style={styles.authError}>{authError}</Text>}

            <TouchableOpacity
              style={[styles.authBtn, (!signInEmail || !signInPassword || authLoading) && { opacity: 0.45 }]}
              disabled={!signInEmail || !signInPassword || authLoading}
              onPress={handleSignIn}
            >
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setAuthError(null); setStep('signup'); }}>
              <Text style={styles.authSwitch}>
                Don't have an account?{'  '}
                <Text style={styles.authSwitchAccent}>Create one</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );

  // ── Forgot Password ──────────────────────────────────────────────
  if (step === 'forgot') {
    async function handleReset() {
      const email = resetEmail.trim();
      if (!email) return;
      setResetStatus('loading');
      const { data } = await supabase.rpc('check_email_exists', { p_email: email });
      if (!data) {
        setResetStatus('notfound');
        return;
      }
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'flare://reset-password',
      });
      setResetStatus('sent');
    }

    return (
      <SafeAreaView edges={["top","bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.back} onPress={() => setStep('signin')}>
            <Ionicons name="arrow-back" size={22} color={theme.accent} />
            <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: theme.text }]}>Reset password</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              Enter the email address linked to your account and we'll send you a reset link.
            </Text>

            <Text style={[styles.label, { color: theme.textMuted }]}>EMAIL</Text>
            <TextInput
              style={[styles.field, { backgroundColor: theme.inputBg, color: theme.text }]}
              placeholder="you@email.com"
              placeholderTextColor={theme.textMuted}
              value={resetEmail}
              onChangeText={v => { setResetEmail(v); setResetStatus('idle'); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />

            {resetStatus === 'sent' && (
              <View style={[styles.statusBanner, { backgroundColor: theme.upcomingBg }]}>
                <Ionicons name="checkmark-circle" size={18} color={theme.upcoming} />
                <Text style={[styles.statusBannerText, { color: theme.upcoming }]}>
                  Reset link sent to {resetEmail}. Check your inbox and spam folder.
                </Text>
              </View>
            )}

            {resetStatus === 'notfound' && (
              <View style={[styles.statusBanner, { backgroundColor: theme.pastBg }]}>
                <Ionicons name="alert-circle" size={18} color={theme.past} />
                <Text style={[styles.statusBannerText, { color: theme.past }]}>
                  No account found for that email address.
                </Text>
              </View>
            )}

            {resetStatus !== 'sent' && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }, (!resetEmail.trim() || resetStatus === 'loading') && { opacity: 0.45 }]}
                disabled={!resetEmail.trim() || resetStatus === 'loading'}
                onPress={handleReset}
              >
                {resetStatus === 'loading'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                }
              </TouchableOpacity>
            )}

            {resetStatus === 'sent' && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: theme.sep }]}
                onPress={() => setStep('signin')}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Back to Sign In</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Profile Setup ────────────────────────────────────────────────
  if (step === 'profile') return (
    <SafeAreaView edges={["top","bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.back} />
        <ProgressDots current={1} total={3} />
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Set up your profile</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>This is how other travelers will find you</Text>

          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{name ? name[0].toUpperCase() : '?'}</Text>
                </LinearGradient>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.tapLabel, { color: theme.textMuted }]}>Tap to add a photo</Text>
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>USERNAME</Text>
          <View style={[styles.usernameWrap, { backgroundColor: theme.inputBg }]}>
            <Text style={[styles.atSign, { color: theme.textMuted }]}>@</Text>
            <TextInput style={[styles.usernameInput, { color: theme.text }]} placeholder="yourhandle" placeholderTextColor={theme.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>BIO <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</Text></Text>
          <TextInput style={[styles.field, styles.bioField, { backgroundColor: theme.inputBg, color: theme.text }]} placeholder="Frequent flyer · chasing new routes" placeholderTextColor={theme.textMuted} value={bio} onChangeText={setBio} multiline numberOfLines={2} />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent }, (!username || profileLoading) && { opacity: 0.45 }]}
            disabled={!username || profileLoading}
            onPress={handleSaveProfile}
          >
            {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Continue</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ── Privacy ──────────────────────────────────────────────────────
  if (step === 'privacy') {
    async function handlePrivacySave() {
      try {
        const profile: UserProfile = { id: authUserId, name, username: username.trim(), bio, avatarUri, isPrivate };
        await saveProfile(profile);
      } catch {}
      setStep('contacts');
    }

    return (
      <SafeAreaView edges={["top","bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.back} />
        <ProgressDots current={2} total={3} />
        <View style={styles.centered}>
          <View style={[styles.bigIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name={isPrivate ? 'lock-closed-outline' : 'globe-outline'} size={44} color={theme.accent} />
          </View>
          <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Who can see your flights?</Text>
          <Text style={[styles.sub, { color: theme.textMuted, textAlign: 'center' }]}>
            You can change this anytime in settings.
          </Text>

          <TouchableOpacity
            style={[styles.privacyOption, { borderColor: !isPrivate ? theme.accent : theme.sep, backgroundColor: !isPrivate ? theme.accentBg : theme.surface }]}
            onPress={() => setIsPrivate(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="globe-outline" size={22} color={!isPrivate ? theme.accent : theme.textSub} />
            <View style={styles.privacyOptionText}>
              <Text style={[styles.privacyOptionTitle, { color: !isPrivate ? theme.accent : theme.text }]}>Public</Text>
              <Text style={[styles.privacyOptionSub, { color: theme.textMuted }]}>Anyone can follow and see your flights</Text>
            </View>
            {!isPrivate && <Ionicons name="checkmark-circle" size={22} color={theme.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.privacyOption, { borderColor: isPrivate ? theme.accent : theme.sep, backgroundColor: isPrivate ? theme.accentBg : theme.surface }]}
            onPress={() => setIsPrivate(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed-outline" size={22} color={isPrivate ? theme.accent : theme.textSub} />
            <View style={styles.privacyOptionText}>
              <Text style={[styles.privacyOptionTitle, { color: isPrivate ? theme.accent : theme.text }]}>Private</Text>
              <Text style={[styles.privacyOptionSub, { color: theme.textMuted }]}>You approve each follower request</Text>
            </View>
            {isPrivate && <Ionicons name="checkmark-circle" size={22} color={theme.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent, width: '100%', marginTop: 8 }]}
            onPress={handlePrivacySave}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Contacts ─────────────────────────────────────────────────────
  if (step === 'contacts') return (
    <SafeAreaView edges={["top","bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.back} />
      <ProgressDots current={3} total={3} />
      <View style={styles.centered}>
        <View style={[styles.bigIconWrap, { backgroundColor: theme.surface }]}>
          <Ionicons name="people-outline" size={48} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Find friends who fly</Text>
        <Text style={[styles.sub, { color: theme.textMuted, textAlign: 'center' }]}>
          Connect your contacts to find people you know when they join Flare.
        </Text>

        {contactStatus === 'done' && (
          <View style={[styles.statusBadge, { backgroundColor: theme.upcomingBg }]}>
            <Ionicons name="checkmark-circle" size={16} color={theme.upcoming} />
            <Text style={[styles.statusText, { color: theme.upcoming }]}>{contactCount} contacts synced · 0 on Flare yet</Text>
          </View>
        )}
        {contactStatus === 'denied' && (
          <View style={[styles.statusBadge, { backgroundColor: theme.pastBg }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.past} />
            <Text style={[styles.statusText, { color: theme.past }]}>Access denied — enable in iOS Settings</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: contactStatus === 'done' ? theme.upcomingBg : theme.accent, width: '100%' }]}
          onPress={contactStatus === 'done' ? () => setStep('allset') : handleConnectContacts}
          disabled={contactStatus === 'loading'}
        >
          {contactStatus === 'loading'
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.primaryBtnText, contactStatus === 'done' && { color: theme.upcoming }]}>
                {contactStatus === 'done' ? '✓ Contacts Connected' : 'Connect Contacts'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.sep, width: '100%' }]} onPress={() => setStep('allset')}>
          <Text style={[styles.secondaryBtnText, { color: theme.textSub }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ── All Set ──────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={["top","bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.centered}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.allSetCircle}>
          <Ionicons name="airplane" size={44} color="#fff" />
        </LinearGradient>
        <Text style={[styles.allSetTitle, { color: theme.text }]}>You're all set!</Text>
        <Text style={[styles.sub, { color: theme.textMuted, textAlign: 'center' }]}>
          Welcome to Flare{username ? `, @${username}` : ''}. Start logging your flights and connecting with travelers on your routes.
        </Text>
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          {username ? (
            <View style={styles.summaryRow}>
              <Ionicons name="person-outline" size={15} color={theme.textSub} />
              <Text style={[styles.summaryText, { color: theme.textSub }]}>@{username}</Text>
            </View>
          ) : null}
          {contactStatus === 'done' && (
            <View style={styles.summaryRow}>
              <Ionicons name="people-outline" size={15} color={theme.textSub} />
              <Text style={[styles.summaryText, { color: theme.textSub }]}>{contactCount} contacts synced</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, width: '100%' }]} onPress={finish}>
          <Text style={styles.primaryBtnText}>Start Exploring</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  wordmark: { fontSize: 36, fontWeight: '500', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 23, fontWeight: '400' },

  welcomeSheet: { paddingHorizontal: 28, paddingBottom: 32, gap: 12 },
  welcomePrimary: {
    backgroundColor: '#4D9FFF',
    borderRadius: 16, paddingVertical: 17,
    alignItems: 'center',
  },
  welcomePrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  welcomeSecondary: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  welcomeSecondaryText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' },
  welcomeLegal: { fontSize: 11, textAlign: 'center', color: 'rgba(255,255,255,0.25)', lineHeight: 16, marginTop: 4 },

  primaryBtn: { borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1.5, marginBottom: 4 },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  legal: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600' },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  progressDot: { width: 28, height: 4, borderRadius: 2 },
  formContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 28 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 7 },
  field: { borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '500', marginBottom: 18 },
  bioField: { minHeight: 72, textAlignVertical: 'top' },
  usernameWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingLeft: 14, marginBottom: 18 },
  atSign: { fontSize: 17, fontWeight: '700' },
  usernameInput: { flex: 1, padding: 14, paddingLeft: 4, fontSize: 15, fontWeight: '500' },
  forgotText: { fontSize: 14, fontWeight: '600' },

  // ── Modern auth screens ──────────────────────────────────────────
  authContent: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 48 },
  authBrand: { alignItems: 'center', marginBottom: 36, marginTop: 12 },
  authTitle: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.8, marginBottom: 8 },
  authSub: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 36 },
  authFields: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  authField: {
    paddingHorizontal: 18,
    paddingVertical: 17,
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
  },
  authFieldDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 18 },
  authBtn: {
    backgroundColor: '#4D9FFF',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  authSwitch: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  authSwitchAccent: { color: '#fff', fontWeight: '600' },
  authError: { color: '#FF6B6B', fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 12 },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: 4 },
  authForgot: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 14, marginBottom: 16 },
  statusBannerText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  switchLink: { fontSize: 14, textAlign: 'center', marginTop: 18 },
  errorText: { color: '#FF3B30', fontSize: 13, fontWeight: '500', marginBottom: 14, textAlign: 'center' },
  avatarRow: { alignItems: 'center', marginBottom: 28, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 34, color: '#fff', fontWeight: '700' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tapLabel: { fontSize: 13, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  privacyOption: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 16, width: '100%' },
  privacyOptionText: { flex: 1 },
  privacyOptionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  privacyOptionSub: { fontSize: 13, lineHeight: 18 },
  bigIconWrap: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, width: '100%' },
  statusText: { fontSize: 13, fontWeight: '600', flex: 1 },
  allSetCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  allSetTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  summaryCard: { width: '100%', borderRadius: 16, padding: 16, gap: 10, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 14, fontWeight: '500' },
});
