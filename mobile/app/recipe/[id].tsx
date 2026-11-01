import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { RecipeSteps } from '@/src/components/RecipeSteps';
import { getRecipe } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';
import type { IngredientLine, Recipe } from '@/src/types';

const SOURCE_LABELS: Record<Recipe['source'], string> = {
  chef: "Chef's Pick",
  online: 'Online recipe',
  ai: 'AI idea',
};

function IngredientSection({ title, lines }: { title: string; lines: IngredientLine[] }) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={index} style={styles.line}>
          {[line.amount, line.unit, line.name].filter(Boolean).join(' ')}
        </Text>
      ))}
    </View>
  );
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipe = getRecipe(id);

  if (!recipe) {
    return <PlaceholderScreen title="Recipe not found" subtitle="Please scan your food again." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.source}>{SOURCE_LABELS[recipe.source]}</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.prep_minutes ? <Text style={styles.meta}>{recipe.prep_minutes} min</Text> : null}
      {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

      <IngredientSection
        title="You have"
        lines={recipe.ingredient_lines.filter((line) => line.have)}
      />
      <IngredientSection
        title="Missing"
        lines={recipe.ingredient_lines.filter((line) => !line.have)}
      />

      <RecipeSteps steps={recipe.steps} />

      <Pressable
        style={styles.madeThis}
        onPress={() => router.push({ pathname: '/made-this', params: { id: recipe.id } })}
        accessibilityRole="button">
        <Text style={styles.madeThisLabel}>I made this</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  source: {
    fontWeight: '600',
    color: colors.primary,
  },
  title: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  section: {
    marginTop: spacing.lg,
  },
  heading: {
    marginBottom: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  line: {
    paddingVertical: 3,
    fontSize: 16,
    color: colors.text,
  },
  madeThis: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  madeThisLabel: {
    fontWeight: '600',
    color: colors.background,
  },
});
