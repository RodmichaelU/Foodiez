import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSizes, fontWeights, spacing } from '@/src/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const BAR_HEIGHT = 64;
const BAR_PADDING = 4;
const MIN_BOTTOM_GAP = spacing.sm;
const ICON_SIZE = 24;
// Keeps dark icons readable over anything behind the bar, including the camera.
const GLASS_TINT = 'rgba(255, 255, 255, 0.45)';

function bottomGap(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom - spacing.sm, MIN_BOTTOM_GAP);
}

/** Bottom padding that screens need, because they scroll underneath the floating bar. */
export function useTabBarSpace(): number {
  const { bottom } = useSafeAreaInsets();
  return BAR_HEIGHT + bottomGap(bottom) + spacing.md;
}

function GlassBackground() {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        colorScheme="light"
        tintColor={GLASS_TINT}
      />
    );
  }
  return <BlurView style={[StyleSheet.absoluteFill, styles.blur]} tint="light" intensity={80} />;
}

export function GlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: state.index,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }, [position, state.index]);

  const tabWidth = (barWidth - BAR_PADDING * 2) / state.routes.length;

  return (
    <View style={[styles.wrapper, { bottom: bottomGap(insets.bottom) }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
        <GlassBackground />
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.highlight,
              {
                width: tabWidth,
                transform: [{ translateX: Animated.multiply(position, tabWidth) }],
              },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? colors.primary : colors.text;
          const label = options.title ?? route.name;

          function onPress() {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) navigateToTab(route.key);
          }

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}>
              {options.tabBarIcon?.({ focused: isFocused, color, size: ICON_SIZE })}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Positioned absolutely so screens run all the way down behind the bar.
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    shadowColor: colors.text,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  blur: {
    backgroundColor: GLASS_TINT,
  },
  highlight: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.medium,
  },
});
