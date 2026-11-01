import { Image, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/src/theme';

const LOGO_HEIGHT = 46;
const LOGO_ASPECT_RATIO = 685 / 251;

export const BANNER_HEIGHT = LOGO_HEIGHT + spacing.sm * 2;

export function AppBanner() {
  return (
    <View style={styles.banner}>
      <Image
        source={require('@/assets/images/foodiez-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="header"
        accessibilityLabel="Foodiez"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    height: LOGO_HEIGHT,
    aspectRatio: LOGO_ASPECT_RATIO,
  },
});
