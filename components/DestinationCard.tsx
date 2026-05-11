import React from 'react';
import { View, Text, StyleSheet, Dimensions, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { getAirportInfo } from '../data/airports';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = Math.floor((SCREEN_W - 32 - 16) / 3);

interface Props {
  toCode: string;
  toCity: string;
  primaryFrom: string;
  flights: Flight[];
  theme: Theme;
  onPress?: () => void;
}

export default function DestinationCard({ toCode, toCity, flights, theme, onPress }: Props) {
  const coverPhoto = flights.flatMap(f => f.photos)[0] ?? null;

  const info = getAirportInfo(toCode);
  // US → state abbreviation (CA, NY…), international → country name
  const locationLabel = info?.stateCode ?? info?.countryName ?? toCity;

  if (coverPhoto) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <ImageBackground
          source={{ uri: coverPhoto }}
          style={[styles.card, { width: CARD_W }]}
          imageStyle={styles.cardImage}
          resizeMode="cover"
        >
          <View style={styles.inner}>
            <Text style={styles.city} numberOfLines={1}>{locationLabel}</Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.card, styles.cardNoBg, { backgroundColor: theme.card, width: CARD_W }]}>
        <Text style={[styles.city, { color: theme.text }]} numberOfLines={1}>{locationLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImage: { borderRadius: 14 },
  inner: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 8,
  },
  cardNoBg: {
    justifyContent: 'flex-end',
    padding: 8,
  },
  city: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
