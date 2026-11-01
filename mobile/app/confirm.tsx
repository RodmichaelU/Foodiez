import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { errorMessage, findRecipes } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingOverlay } from '@/src/components/LoadingOverlay';
import { toCanonicalName } from '@/src/lib/format';
import { getDraft, hasResultsFor, setResults, updateDraft } from '@/src/lib/session';
import type { DraftItem } from '@/src/lib/session';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';

export default function ConfirmScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(() => getDraft()?.items ?? []);
  const [newName, setNewName] = useState('');
  const [useStaples, setUseStaples] = useState(() => getDraft()?.useStaples ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => updateDraft(items, useStaples), [items, useStaples]);

  const selected = items.filter((item) => item.checked).map((item) => item.canonicalName);

  function toggle(canonicalName: string) {
    setItems((current) =>
      current.map((item) =>
        item.canonicalName === canonicalName ? { ...item, checked: !item.checked } : item,
      ),
    );
  }

  function remove(canonicalName: string) {
    setItems((current) => current.filter((item) => item.canonicalName !== canonicalName));
  }

  function add() {
    const name = newName.trim();
    const canonicalName = toCanonicalName(name);
    if (!canonicalName) return;
    setItems((current) => [
      { name, canonicalName, checked: true },
      ...current.filter((item) => item.canonicalName !== canonicalName),
    ]);
    setNewName('');
  }

  async function showRecipes() {
    if (hasResultsFor(selected, useStaples)) {
      router.push('/results');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const found = await findRecipes(getDraft()?.scanId ?? null, selected, useStaples);
      setResults(found, selected, useStaples);
      router.push('/results');
    } catch (recipesError) {
      setError(errorMessage(recipesError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.canonicalName}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={add}
              placeholder="Add an ingredient"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              maxLength={60}
            />
            <Pressable style={styles.addButton} onPress={add} accessibilityRole="button">
              <Text style={styles.primaryLabel}>Add</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            We did not spot any food. Add what you have above, or go back and take another photo.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.check}
              onPress={() => toggle(item.canonicalName)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.checked }}>
              <SymbolView
                name={item.checked ? 'checkmark.circle.fill' : 'circle'}
                tintColor={item.checked ? colors.primary : colors.textMuted}
                size={24}
              />
              <Text style={styles.rowLabel}>{item.name}</Text>
            </Pressable>
            <Pressable
              onPress={() => remove(item.canonicalName)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}>
              <SymbolView name="trash" tintColor={colors.textMuted} size={20} />
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        {error && <ErrorState message={error} onRetry={showRecipes} />}
        <View style={styles.stapleRow}>
          <Text style={styles.rowLabel}>Use pantry staples</Text>
          <Switch value={useStaples} onValueChange={setUseStaples} />
        </View>
        <Pressable
          style={[styles.showButton, selected.length === 0 && styles.disabled]}
          disabled={selected.length === 0}
          onPress={showRecipes}
          accessibilityRole="button">
          <Text style={styles.primaryLabel}>Show recipes</Text>
        </Pressable>
      </View>

      {isLoading && <LoadingOverlay message="Finding recipes..." />}
    </View>
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
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  addButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  check: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    flexShrink: 1,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stapleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  showButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
});
