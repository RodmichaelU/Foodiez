import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * A header that slides away when scrolling down and returns when scrolling up.
 * Pass `height` as the list's top content inset, which leaves room for the header
 * and keeps pull to refresh visible below it.
 */
export function useCollapsingHeader(height: number) {
  const { scrollY, translateY } = useRef(createAnimation(height)).current;

  return {
    translateY,
    listProps: {
      contentInset: { top: height },
      contentOffset: { x: 0, y: -height },
      scrollIndicatorInsets: { top: height },
      scrollEventThrottle: 16,
      onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    },
  };
}

function createAnimation(height: number) {
  // The list starts at -height because of its inset.
  const scrollY = new Animated.Value(-height);
  // Pulling down past the top must not count as scrolling up.
  const distance = Animated.add(scrollY, height).interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: 'clamp',
  });
  const translateY = Animated.diffClamp(distance, 0, height).interpolate({
    inputRange: [0, height],
    outputRange: [0, -height],
  });
  return { scrollY, translateY };
}
