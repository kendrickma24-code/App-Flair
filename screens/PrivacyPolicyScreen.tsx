import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';

interface Props {
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    title: 'Introduction',
    body: `Flair ("we," "our," or "us") is a social travel app that lets you log flights, share trip memories, and connect with other travelers. This Privacy Policy explains what information we collect, how we use it, and your choices.

By using Flair, you agree to the practices described here. If you do not agree, please do not use the app.`,
  },
  {
    title: 'Information We Collect',
    body: `Account information — When you create an account, we collect your name, username, email address, and optional profile photo.

Flight data — When you log a flight, we store the departure and destination airports, flight number, date, duration, notes, photos you attach, and the privacy setting you choose (Public, Followers, or Private).

Usage data — We collect standard usage analytics such as which features you use and how often, to help us improve the app. This data is aggregated and not tied to your identity.

Device information — We may collect your device type, operating system version, and app version for debugging purposes.`,
  },
  {
    title: 'How We Use Your Information',
    body: `We use your information to:

• Operate and personalize your Flair experience
• Show your flights and profile to other users based on your privacy settings
• Send notifications about followers, likes, and comments
• Improve app features and fix bugs
• Comply with legal obligations

We do not sell your personal information to third parties.`,
  },
  {
    title: 'Privacy Settings',
    body: `Every flight you log has a privacy setting you control:

Public — Visible to anyone using Flair.
Followers — Visible only to users who follow you.
Private — Visible only to you.

Your profile (name, username, bio, and photo) is public by default. You can switch your account to private in Settings, which restricts your posts to approved followers only.`,
  },
  {
    title: 'Photos',
    body: `Photos you upload to Flair are stored securely on our servers. Photos attached to Public or Followers-only flights may be visible to other users according to your privacy setting. We do not use your photos to train AI models or share them with advertising networks.

You can delete a flight and its photos at any time from the app.`,
  },
  {
    title: 'Third-Party Services',
    body: `Flair is built on Supabase, which provides our database and file storage infrastructure. Supabase processes data on our behalf in accordance with their privacy policy and data processing agreements.

We may use third-party analytics tools to understand app usage. These tools receive anonymized, aggregated data only.`,
  },
  {
    title: 'Data Retention',
    body: `We retain your account data for as long as your account is active. If you delete your account, we will delete your personal information, flights, and photos within 30 days, except where retention is required by law.

Deleted flights are moved to a trash bin for 30 days before permanent deletion, giving you a window to restore them.`,
  },
  {
    title: 'Your Rights',
    body: `Depending on where you live, you may have the right to:

• Access the personal data we hold about you
• Correct inaccurate data
• Request deletion of your data
• Export your data in a portable format
• Opt out of certain data processing

To exercise any of these rights, contact us at the email below.`,
  },
  {
    title: 'Children',
    body: `Flair is not directed to children under 13. We do not knowingly collect personal information from anyone under 13. If you believe a child has provided us information, please contact us and we will delete it promptly.`,
  },
  {
    title: 'Changes to This Policy',
    body: `We may update this policy from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, notify you via the app or email.`,
  },
  {
    title: 'Contact Us',
    body: `If you have questions or concerns about this Privacy Policy, please reach out:\n\nEmail: privacy@flair.app`,
  },
];

export default function PrivacyPolicyScreen({ theme, isDark, onClose }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.sep }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy Policy</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: theme.textMuted }]}>Last updated: April 2026</Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{s.title}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSub }]}>{s.body}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  lastUpdated: { fontSize: 12, marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, letterSpacing: -0.3 },
  sectionBody: { fontSize: 15, lineHeight: 24 },
});
