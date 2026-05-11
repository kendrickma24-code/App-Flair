import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';

interface Props {
  from: { code: string; city: string };
  to: { code: string; city: string };
  theme: Theme;
}

export default function RouteDisplay({ from, to, theme }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.end}>
        <Text style={[styles.code, { color: theme.text }]}>{from.code}</Text>
        {from.city ? (
          <Text style={[styles.city, { color: theme.textMuted }]} numberOfLines={1}>{from.city}</Text>
        ) : null}
      </View>

      <View style={styles.connector}>
        <View style={[styles.line, { backgroundColor: theme.sep }]} />
        <View style={[styles.planeWrap, { backgroundColor: theme.accentBg }]}>
          <Ionicons name="airplane" size={13} color={theme.accent} />
        </View>
        <View style={[styles.line, { backgroundColor: theme.sep }]} />
      </View>

      <View style={[styles.end, styles.endRight]}>
        <Text style={[styles.code, { color: theme.text }]}>{to.code}</Text>
        {to.city ? (
          <Text style={[styles.city, { color: theme.textMuted }]} numberOfLines={1}>{to.city}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  end: {
    minWidth: 52,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  code: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 36,
  },
  city: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    maxWidth: 90,
  },
  connector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  line: {
    flex: 1,
    height: 1,
    borderRadius: 1,
  },
  planeWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
