import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createCooked, errorMessage } from '@/src/api/client';
import { LoadingOverlay } from '@/src/components/LoadingOverlay';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { compressPhoto } from '@/src/lib/photos';
import { getRecipe, getScanIdForRecipe } from '@/src/lib/session';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';

const MAX_CAPTION_LENGTH = 300;

export default function MadeThisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipe = getRecipe(id);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recipe) {
    return <PlaceholderScreen title="Recipe not found" subtitle="Please scan your food again." />;
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Allow camera access in Settings to take a photo of your dish.');
          return;
        }
      }
      const launch =
        source === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;
      const result = await launch({ mediaTypes: ['images'] });
      if (!result.canceled) setPhotoUri(await compressPhoto(result.assets[0].uri));
    } catch {
      setError('Could not use that photo. Please try another.');
    }
  }

  async function save() {
    if (!recipe) return;
    setIsSaving(true);
    setError(null);
    try {
      await createCooked({
        recipe,
        scanId: getScanIdForRecipe(recipe.id),
        caption,
        isPublic,
        photoUri,
      });
      Alert.alert('Saved', 'This dish is now on your profile.');
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{recipe.title}</Text>

        {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} />}
        <View style={styles.photoButtons}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickPhoto('camera')}
            accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Take photo</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickPhoto('library')}
            accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Choose photo</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption (optional)"
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_CAPTION_LENGTH}
          multiline
        />

        <View style={styles.publicRow}>
          <View style={styles.publicText}>
            <Text style={styles.publicLabel}>Share publicly</Text>
            <Text style={styles.publicHint}>Other Foodiez users can see public dishes.</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.saveButton} onPress={save} accessibilityRole="button">
          <Text style={styles.saveLabel}>Save dish</Text>
        </Pressable>
      </ScrollView>
      {isSaving && <LoadingOverlay message="Saving your dish..." />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  input: {
    minHeight: 80,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  publicText: {
    flex: 1,
  },
  publicLabel: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  publicHint: {
    marginTop: 2,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
});
