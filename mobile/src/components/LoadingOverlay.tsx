import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, fontWeights, spacing } from '@/src/theme';

export function LoadingOverlay({ message }: { message: string }) {
  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color={colors.background} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
});
