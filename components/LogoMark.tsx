import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  size?: number;
  /** 'icon'     = gradient rounded-rect bg + white star (full app icon look)
   *  'gradient' = gradient star, transparent bg
   *  'white'    = solid white star, transparent bg */
  variant?: 'icon' | 'gradient' | 'white';
}

// Pre-generated PNGs for crisp rendering at each size
const WHITE_MARK = {
  56:  require('../assets/mark-white-56.png'),
  80:  require('../assets/mark-white-80.png'),
  120: require('../assets/mark-white-120.png'),
} as const;

const GRADIENT_MARK = {
  56:  require('../assets/mark-gradient-56.png'),
  80:  require('../assets/mark-gradient-80.png'),
  120: require('../assets/mark-gradient-120.png'),
} as const;

function nearestKey(size: number, keys: number[]) {
  return keys.reduce((a, b) => Math.abs(b - size) < Math.abs(a - size) ? b : a);
}

const WHITE_KEYS = [56, 80, 120] as const;
const GRAD_KEYS  = [56, 80, 120] as const;

export default function LogoMark({ size = 40, variant = 'gradient' }: Props) {
  if (variant === 'icon') {
    const rx = size * 0.22;
    const key = nearestKey(size, [...WHITE_KEYS]);
    return (
      <LinearGradient
        colors={['#6B5BFF', '#9B5CE8', '#E255B0', '#FFB46B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.iconBg, { width: size, height: size, borderRadius: rx }]}
      >
        <Image
          source={WHITE_MARK[key as keyof typeof WHITE_MARK]}
          style={{ width: size * 0.6, height: size * 0.6 }}
          resizeMode="contain"
        />
      </LinearGradient>
    );
  }

  if (variant === 'white') {
    const key = nearestKey(size, [...WHITE_KEYS]);
    return (
      <Image
        source={WHITE_MARK[key as keyof typeof WHITE_MARK]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  // gradient (default)
  const key = nearestKey(size, [...GRAD_KEYS]);
  return (
    <Image
      source={GRADIENT_MARK[key as keyof typeof GRADIENT_MARK]}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  iconBg: { alignItems: 'center', justifyContent: 'center' },
});
