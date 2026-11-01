import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatIngredient } from '@/src/lib/format';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';
import type { FeedItem } from '@/src/types';

type Props = {
  post: FeedItem;
  onPress: () => void;
};

export function PostCard({ post, onPress }: Props) {
  const imageUrl = post.photo_url ?? post.recipe?.image_url;

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.author}>{post.author_name}</Text>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.placeholderFrame}>
          <Image
            source={require('@/assets/images/ai-recipe-placeholder.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      )}
      <Text style={styles.title}>{post.recipe?.title ?? 'A home-cooked dish'}</Text>
      {post.caption && <Text style={styles.caption}>{post.caption}</Text>}
      {post.ingredients_used.length > 0 && (
        <Text style={styles.ingredients} numberOfLines={2}>
          Used: {post.ingredients_used.map(formatIngredient).join(', ')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  author: {
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  image: {
    width: '100%',
    height: 280,
    borderRadius: radius.lg,
  },
  placeholderFrame: {
    borderRadius: radius.lg,
    backgroundColor: colors.aiPlaceholder,
  },
  title: {
    fontSize: fontSizes.cardTitle,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  caption: {
    color: colors.text,
  },
  ingredients: {
    color: colors.textMuted,
  },
});
