import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

const PULSE_MS = 700;
const GRID_TILES = 9;
const FEED_POSTS = 2;

function Block({ width = '100%', height }: { width?: DimensionValue; height: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, opacity }]} />;
}

export function SkeletonFeed() {
  return (
    <View style={styles.feed} accessibilityLabel="Loading">
      {Array.from({ length: FEED_POSTS }, (_, index) => (
        <View key={index} style={styles.post}>
          <Block width="40%" height={16} />
          <Block height={240} />
          <Block width="70%" height={18} />
          <Block width="90%" height={14} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonGrid() {
  return (
    <View style={styles.grid} accessibilityLabel="Loading">
      {Array.from({ length: GRID_TILES }, (_, index) => (
        <View key={index} style={styles.tile}>
          <Block height={120} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  feed: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  post: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  tile: {
    width: '33.33%',
    padding: 2,
  },
});
