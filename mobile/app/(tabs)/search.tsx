import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { errorMessage, searchRecipes } from '@/src/api/client';
import type { SearchMode } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { useTabBarSpace } from '@/src/components/GlassTabBar';
import { RecipeCard } from '@/src/components/RecipeCard';
import { rememberSearched, toSections } from '@/src/lib/session';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';
import type { RecipesResponse } from '@/src/types';

const DEBOUNCE_MS = 600;
const MIN_NAME_LENGTH = 3;
// Matches the backend's threshold for when AI recipes can fill in.
const FEW_RESULTS = 3;

const MODES: { value: SearchMode; label: string; placeholder: string }[] = [
  { value: 'name', label: 'By name', placeholder: 'Try "pasta"' },
  { value: 'ingredient', label: 'By ingredient', placeholder: 'Try "egg, spinach"' },
];

export default function SearchScreen() {
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const [mode, setMode] = useState<SearchMode>('name');
  const [text, setText] = useState('');
  const [response, setResponse] = useState<RecipesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triedAi, setTriedAi] = useState(false);
  // Only the newest search may update the screen, however the responses arrive.
  const latestSearch = useRef(0);

  async function runSearch(useAi = false) {
    const query = text.trim();
    if (!query) return;
    setTriedAi(useAi);

    const searchId = ++latestSearch.current;
    setIsLoading(true);
    setError(null);
    try {
      const found = await searchRecipes(query, mode, useAi);
      if (searchId !== latestSearch.current) return;
      rememberSearched(found);
      setResponse(found);
    } catch (searchError) {
      if (searchId === latestSearch.current) setError(errorMessage(searchError));
    } finally {
      if (searchId === latestSearch.current) setIsLoading(false);
    }
  }

  // Name searches run while typing. Ingredient searches can call Gemini, so half-typed
  // ingredients would waste quota: those wait for the Search button or the return key.
  useEffect(() => {
    latestSearch.current += 1;
    setIsLoading(false);
    setError(null);
    setResponse(null);
    setTriedAi(false);

    if (mode !== 'name' || text.trim().length < MIN_NAME_LENGTH) return;
    const timer = setTimeout(() => runSearch(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mode]);

  const sections = response ? toSections(response) : [];
  const resultCount = sections.reduce((total, section) => total + section.data.length, 0);
  const canAskAi = mode === 'name' && response !== null && !triedAi && resultCount < FEW_RESULTS;
  const activeMode = MODES.find((item) => item.value === mode) ?? MODES[0];

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.modes}>
          {MODES.map((item) => (
            <Pressable
              key={item.value}
              style={[styles.mode, item.value === mode && styles.activeMode]}
              onPress={() => setMode(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.value === mode }}>
              <Text style={[styles.modeLabel, item.value === mode && styles.activeModeLabel]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            // The return key means the name is finished, so AI can help if results are thin.
            onSubmitEditing={() => runSearch(mode === 'name')}
            placeholder={activeMode.placeholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            maxLength={200}
          />
          {mode === 'ingredient' && (
            <Pressable
              style={[styles.searchButton, !text.trim() && styles.disabled]}
              disabled={!text.trim()}
              onPress={() => runSearch()}
              accessibilityRole="button">
              <Text style={styles.searchLabel}>Search</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && <ActivityIndicator style={styles.status} color={colors.primary} />}
      {error && <ErrorState message={error} onRetry={() => runSearch(triedAi)} />}
      {!isLoading && !error && (
        <SectionList
          sections={sections}
          keyExtractor={(recipe) => recipe.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace }]}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {response
                ? triedAi
                  ? 'No recipes found. Check the spelling or try a different name.'
                  : 'No saved recipes for that dish yet.'
                : mode === 'name'
                  ? 'Search for any dish by name.'
                  : 'List what you have, separated by commas.'}
            </Text>
          }
          ListFooterComponent={
            canAskAi ? (
              <Pressable
                style={styles.aiButton}
                onPress={() => runSearch(true)}
                accessibilityRole="button">
                <Text style={styles.searchLabel}>Create recipes for "{text.trim()}" with AI</Text>
              </Pressable>
            ) : undefined
          }
          renderSectionHeader={({ section }) => <Text style={styles.heading}>{section.title}</Text>}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controls: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  modes: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  activeMode: {
    backgroundColor: colors.background,
  },
  modeLabel: {
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
  },
  activeModeLabel: {
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  searchButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  searchLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
  aiButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  status: {
    marginTop: spacing.lg,
  },
  list: {
    padding: spacing.md,
  },
  heading: {
    marginBottom: spacing.sm,
    fontSize: fontSizes.section,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
