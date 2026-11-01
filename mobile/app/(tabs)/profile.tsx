import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { errorMessage, getCookedPage, getProfile } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { rememberCooked } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';
import type { CookedItem, Profile } from '@/src/types';

const COLUMNS = 3;

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<CookedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextProfile, page] = await Promise.all([getProfile(), getCookedPage(null)]);
      rememberCooked(page.items);
      setProfile(nextProfile);
      setItems(page.items);
      setCursor(page.next_cursor);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function loadMore() {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getCookedPage(cursor);
      rememberCooked(page.items);
      setItems((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      // Scrolling to the end again retries.
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      onEndReached={loadMore}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{profile.display_name ?? 'Add your name in Settings'}</Text>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings">
              <SymbolView name="gearshape" tintColor={colors.text} size={24} />
            </Pressable>
          </View>
          <Text style={styles.counts}>
            {profile.cooked_count} cooked · {profile.scan_count} scans
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          Dishes you make will show up here. Scan some food and tap "I made this" on a recipe.
        </Text>
      }
      ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} /> : undefined}
      renderItem={({ item }) => (
        <Pressable
          style={styles.tile}
          onPress={() => router.push({ pathname: '/cooked/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={item.recipe?.title ?? 'Your dish'}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.tileImage} />
          ) : (
            <View style={[styles.tileImage, styles.tilePlaceholder]}>
              <SymbolView name="fork.knife" tintColor={colors.textMuted} size={24} />
            </View>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  counts: {
    marginTop: 4,
    color: colors.textMuted,
  },
  empty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
  tile: {
    flex: 1 / COLUMNS,
    padding: 1,
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
  },
  tilePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
