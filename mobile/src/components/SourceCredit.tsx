import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSizes, spacing } from '@/src/theme';

type Props = {
  name: string | null;
  url: string | null;
};

// Recipe providers require the original source to be credited.
export function SourceCredit({ name, url }: Props) {
  if (!name && !url) return null;

  const label = `Recipe from ${name ?? 'the original source'}`;
  if (!url) return <Text style={styles.credit}>{label}</Text>;

  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link">
      <Text style={[styles.credit, styles.link]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  credit: {
    marginTop: spacing.md,
    fontSize: fontSizes.small,
    color: colors.textMuted,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
