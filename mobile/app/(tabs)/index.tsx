import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage, getFeedPage } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { PostCard } from '@/src/components/PostCard';
import { SkeletonFeed } from '@/src/components/Skeleton';
import { rememberCooked } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';
import type { FeedItem } from '@/src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await getFeedPage(null);
      rememberCooked(page.items);
      setPosts(page.items);
      setCursor(page.next_cursor);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function loadMore() {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getFeedPage(cursor);
      rememberCooked(page.items);
      setPosts((current) => [...(current ?? []), ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      // Scrolling to the end again retries.
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (!posts) {
    return (
      <View style={styles.container}>
        {error ? <ErrorState message={error} onRetry={load} /> : <SkeletonFeed />}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={posts}
      keyExtractor={(post) => post.id}
      onEndReached={loadMore}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
      ListEmptyComponent={
        <Text style={styles.empty}>No dishes yet. Cook something and share it!</Text>
      }
      ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} /> : undefined}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onPress={() => router.push({ pathname: '/cooked/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
  },
  error: {
    marginBottom: spacing.md,
    textAlign: 'center',
    color: colors.danger,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
