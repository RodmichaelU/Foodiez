import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text } from 'react-native';

import { errorMessage, getOnlineRecipe } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';

import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { RecipeSteps } from '@/src/components/RecipeSteps';
import { SourceCredit } from '@/src/components/SourceCredit';
import { formatIngredient } from '@/src/lib/format';
import { getCooked } from '@/src/lib/session';
import type { SavedRecipe } from '@/src/types';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';

export default function CookedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cooked = getCooked(id);
  const saved = cooked?.recipe ?? null;
  const [details, setDetails] = useState<SavedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Online recipes may only be stored as id, title and image, so the rest loads when opened.
  const needsDetails = saved?.source === 'online' && saved.steps.length === 0;
  const externalId = saved?.external_id ?? null;

  const loadDetails = useCallback(async () => {
    if (!externalId) return;
    setError(null);
    try {
      setDetails(await getOnlineRecipe(externalId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [externalId]);

  useEffect(() => {
    if (needsDetails) loadDetails();
  }, [needsDetails, loadDetails]);

  if (!cooked) {
    return <PlaceholderScreen title="Dish not found" subtitle="Please go back and try again." />;
  }

  const recipe = details ?? saved;
  const isLoadingDetails = needsDetails && !details && !error;

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

      {isLoadingDetails && <ActivityIndicator style={styles.loading} color={colors.primary} />}
      {needsDetails && error && <ErrorState message={error} onRetry={loadDetails} />}

      {recipe && recipe.steps.length > 0 && (
        <>
          <Text style={styles.heading}>Recipe</Text>
          {recipe.ingredient_lines.map((line, index) => (
            <Text key={index} style={styles.line}>
              {[line.amount, line.unit, line.name].filter(Boolean).join(' ')}
            </Text>
          ))}
          <RecipeSteps steps={recipe.steps} />
          <SourceCredit name={recipe.source_name} url={recipe.source_url} />
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
    borderRadius: radius.lg,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  caption: {
    marginTop: spacing.sm,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  meta: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  loading: {
    marginTop: spacing.lg,
  },
  heading: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  line: {
    paddingVertical: 3,
    fontSize: fontSizes.body,
    color: colors.text,
  },
});
