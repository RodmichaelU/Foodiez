import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text } from 'react-native';

import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { RecipeSteps } from '@/src/components/RecipeSteps';
import { formatIngredient } from '@/src/lib/format';
import { getCooked } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';

export default function CookedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cooked = getCooked(id);

  if (!cooked) {
    return <PlaceholderScreen title="Dish not found" subtitle="Please go back and try again." />;
  }

  const { recipe } = cooked;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {cooked.photo_url && <Image source={{ uri: cooked.photo_url }} style={styles.photo} />}
      <Text style={styles.title}>{recipe?.title ?? 'Recipe no longer available'}</Text>
      {cooked.caption && <Text style={styles.caption}>{cooked.caption}</Text>}
      <Text style={styles.meta}>
        {new Date(cooked.created_at).toLocaleDateString()} ·{' '}
        {cooked.is_public ? 'Public' : 'Private'}
      </Text>

      {cooked.ingredients_used.length > 0 && (
        <>
          <Text style={styles.heading}>Ingredients used</Text>
          <Text style={styles.line}>
            {cooked.ingredients_used.map(formatIngredient).join(', ')}
          </Text>
        </>
      )}

      {recipe && (
        <>
          <Text style={styles.heading}>Recipe</Text>
          {recipe.ingredient_lines.map((line, index) => (
            <Text key={index} style={styles.line}>
              {[line.amount, line.unit, line.name].filter(Boolean).join(' ')}
            </Text>
          ))}
          <RecipeSteps steps={recipe.steps} />
        </>
      )}
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
  photo: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: spacing.md,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    marginTop: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  heading: {
    marginTop: spacing.lg,
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
});
