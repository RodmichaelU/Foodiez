import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, fontWeights, spacing } from '@/src/theme';

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
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  number: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  text: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.text,
  },
});
