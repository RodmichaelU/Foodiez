import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { errorMessage, getProfile, updateProfile } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { formatIngredient } from '@/src/lib/format';
import { clearResults } from '@/src/lib/session';
import { supabase } from '@/src/lib/supabase';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';

export default function SettingsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [newAvoid, setNewAvoid] = useState('');

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const profile = await getProfile();
      setDisplayName(profile.display_name ?? '');
      setAvoid(profile.avoid_ingredients);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Saved as soon as it changes: a forgotten Save button must never leave an allergy unapplied.
  async function save(nextAvoid: string[]): Promise<boolean> {
    setIsSaving(true);
    setSaveError(null);
    try {
      const profile = await updateProfile(displayName.trim() || null, nextAvoid);
      setAvoid(profile.avoid_ingredients);
      clearResults();
      return true;
    } catch (error) {
      setSaveError(errorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addAvoid() {
    const name = newAvoid.trim();
    if (!name) return;
    if (await save([...avoid, name])) setNewAvoid('');
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <ErrorState message={loadError} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        onEndEditing={() => save(avoid)}
        placeholder="Your name"
        placeholderTextColor={colors.textMuted}
        maxLength={50}
        returnKeyType="done"
      />

      <Text style={styles.heading}>Never include</Text>
      <Text style={styles.hint}>
        Recipes with these ingredients are hidden. This is a best-effort filter, so if you have an
        allergy, always check the recipe and product labels yourself.
      </Text>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.addInput]}
          value={newAvoid}
          onChangeText={setNewAvoid}
          onSubmitEditing={addAvoid}
          placeholder="e.g. peanuts"
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          returnKeyType="done"
        />
        <Pressable
          style={styles.addButton}
          onPress={addAvoid}
          disabled={isSaving}
          accessibilityRole="button">
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>
      {avoid.map((name) => (
        <View key={name} style={styles.avoidRow}>
          <Text style={styles.avoidLabel}>{formatIngredient(name)}</Text>
          <Pressable
            onPress={() => save(avoid.filter((item) => item !== name))}
            disabled={isSaving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${formatIngredient(name)}`}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <Pressable
        style={styles.logOut}
        onPress={() => supabase.auth.signOut()}
        accessibilityRole="button">
        <Text style={styles.logOutLabel}>Log out</Text>
      </Pressable>
    </ScrollView>
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
  content: {
    padding: spacing.md,
  },
  heading: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  hint: {
    marginBottom: spacing.sm,
    color: colors.textMuted,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  addLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
  avoidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avoidLabel: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  remove: {
    color: colors.danger,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
  },
  logOut: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logOutLabel: {
    fontWeight: fontWeights.medium,
    color: colors.danger,
  },
});
