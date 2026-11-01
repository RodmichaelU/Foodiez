import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/theme';

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
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
