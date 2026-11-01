import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, getFeedPage } from '@/src/api/client';
import { AppBanner, BANNER_HEIGHT } from '@/src/components/AppBanner';
import { ErrorState } from '@/src/components/ErrorState';
import { useTabBarSpace } from '@/src/components/GlassTabBar';
import { PostCard } from '@/src/components/PostCard';
import { SkeletonFeed } from '@/src/components/Skeleton';
import { useCollapsingHeader } from '@/src/hooks/useCollapsingHeader';
import { rememberCooked } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';
import type { FeedItem } from '@/src/types';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { translateY, listProps } = useCollapsingHeader(BANNER_HEIGHT);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Clips the banner as it slides, so it never covers the status bar. */}
      <View style={styles.content}>
        {posts ? (
          <Animated.FlatList
            {...listProps}
            style={styles.container}
            contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace }]}
            data={posts}
            keyExtractor={(post) => post.id}
            onEndReached={loadMore}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
            ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
            ListEmptyComponent={
              <Text style={styles.empty}>No dishes yet. Cook something and share it!</Text>
            }
            ListFooterComponent={
              isLoadingMore ? <ActivityIndicator color={colors.primary} /> : undefined
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onPress={() => router.push({ pathname: '/cooked/[id]', params: { id: item.id } })}
              />
            )}
          />
        ) : (
          <View style={styles.loading}>
            {error ? <ErrorState message={error} onRetry={load} /> : <SkeletonFeed />}
          </View>
        )}
        <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
          <AppBanner />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  loading: {
    flex: 1,
    paddingTop: BANNER_HEIGHT,
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
