import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatIngredient } from '@/src/lib/format';
import { colors, spacing } from '@/src/theme';
import type { Recipe } from '@/src/types';

type Props = {
  recipe: Recipe;
  onPress: () => void;
};

export function RecipeCard({ recipe, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={styles.image} />
      ) : recipe.source === 'ai' ? (
        <Image
          source={require('@/assets/images/ai-recipe-placeholder.png')}
          style={[styles.image, styles.aiPlaceholder]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <SymbolView name="fork.knife" tintColor={colors.textMuted} size={32} />
        </View>
      )}
      <View style={styles.body}>
        {recipe.source === 'ai' && <Text style={styles.badge}>AI idea</Text>}
        {recipe.source === 'chef' && (
          <Text style={[styles.badge, styles.chefBadge]}>Chef's Pick</Text>
        )}
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.meta}>
          {[
            recipe.prep_minutes ? `${recipe.prep_minutes} min` : null,
            recipe.match_known ? `You have ${recipe.have_count}/${recipe.total_core}` : null,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>
        {recipe.match_known && recipe.missing.length > 0 && (
          <Text style={styles.missing}>
            Missing: {recipe.missing.map(formatIngredient).join(', ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  image: {
    height: 140,
    width: '100%',
  },
  aiPlaceholder: {
    backgroundColor: colors.aiPlaceholder,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  body: {
    padding: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.surface,
  },
  chefBadge: {
    color: colors.background,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
  },
  missing: {
    marginTop: 4,
    color: colors.danger,
  },
});
