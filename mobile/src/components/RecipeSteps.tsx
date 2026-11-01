import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/theme';

export function RecipeSteps({ steps }: { steps: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Steps</Text>
      {steps.map((step, index) => (
        <View key={index} style={styles.step}>
          <Text style={styles.number}>{index + 1}.</Text>
          <Text style={styles.text}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
  },
  heading: {
    marginBottom: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  number: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  text: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
});
