import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontWeights, radius, spacing } from '@/src/theme';

type Props = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.md,
  },
  message: {
    textAlign: 'center',
    color: colors.danger,
  },
  retry: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  retryLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
});
