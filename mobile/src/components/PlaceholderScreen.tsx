import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, fontWeights, spacing } from '@/src/theme';

type Props = {
  title: string;
  subtitle: string;
};

export function PlaceholderScreen({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
