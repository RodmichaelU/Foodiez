import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, scanPhotos } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingOverlay } from '@/src/components/LoadingOverlay';
import { getDraft, setScan } from '@/src/lib/session';
import { compressPhoto } from '@/src/lib/photos';
import { colors, spacing } from '@/src/theme';

const MAX_PHOTOS = 3;

function ResumeCard({ onPress }: { onPress: () => void }) {
  const items = getDraft()?.items ?? [];
  if (items.length === 0) return null;

  const count = items.filter((item) => item.checked).length;
  return (
    <Pressable style={styles.resumeCard} onPress={onPress} accessibilityRole="button">
      <Text style={styles.resumeLabel}>
        Continue with {count} {count === 1 ? 'ingredient' : 'ingredients'}
      </Text>
      <SymbolView name="chevron.right" tintColor={colors.textMuted} size={16} />
    </Pressable>
  );
}

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isTaking, setIsTaking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<() => void>(() => {});

  async function takePhoto() {
    if (!camera.current || isTaking || photos.length >= MAX_PHOTOS) return;
    retry.current = takePhoto;
    setIsTaking(true);
    setError(null);
    try {
      const picture = await camera.current.takePictureAsync();
      const compressed = await compressPhoto(picture.uri);
      setPhotos((current) => [...current, compressed]);
    } catch {
      setError('Could not take that photo. Please try again.');
    } finally {
      setIsTaking(false);
    }
  }

  async function findRecipes() {
    retry.current = findRecipes;
    setIsScanning(true);
    setError(null);
    try {
      setScan(await scanPhotos(photos));
      setPhotos([]);
      router.push('/confirm');
    } catch (scanError) {
      setError(errorMessage(scanError));
    } finally {
      setIsScanning(false);
    }
  }

  if (!permission) return <View style={styles.permission} />;

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>See what you can cook</Text>
        <Text style={styles.permissionBody}>
          Foodiez uses your camera to spot the food you have on hand, so it can suggest recipes.
        </Text>
        <Pressable
          style={styles.primaryButton}
          accessibilityRole="button"
          onPress={permission.canAskAgain ? requestPermission : Linking.openSettings}>
          <Text style={styles.primaryLabel}>
            {permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />}

      <View style={[styles.controls, { paddingTop: insets.top }]}>
        {error && (
          <View style={styles.errorCard}>
            <ErrorState message={error} onRetry={() => retry.current()} />
          </View>
        )}
        {isFocused && <ResumeCard onPress={() => router.push('/confirm')} />}
        <View style={styles.spacer} />

        <View style={styles.thumbnails}>
          {photos.map((uri) => (
            <Pressable
              key={uri}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={() => setPhotos((current) => current.filter((photo) => photo !== uri))}>
              <Image source={{ uri }} style={styles.thumbnail} />
              <Text style={styles.remove}>×</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Text style={styles.count}>
            {photos.length}/{MAX_PHOTOS}
          </Text>
          <Pressable
            style={[styles.shutter, photos.length >= MAX_PHOTOS && styles.disabled]}
            disabled={photos.length >= MAX_PHOTOS || isTaking}
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel="Take photo">
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            style={[styles.findButton, photos.length === 0 && styles.disabled]}
            disabled={photos.length === 0}
            onPress={findRecipes}
            accessibilityRole="button">
            <Text style={styles.primaryLabel}>Find recipes</Text>
          </Pressable>
        </View>
      </View>

      {isScanning && <LoadingOverlay message="Looking at your food..." />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  controls: {
    flex: 1,
    padding: spacing.md,
  },
  spacer: {
    flex: 1,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  resumeLabel: {
    fontWeight: '600',
    color: colors.text,
  },
  errorCard: {
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  thumbnails: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 6,
    fontSize: 18,
    fontWeight: '700',
    color: colors.background,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  count: {
    width: 110,
    fontWeight: '600',
    color: colors.background,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 4,
    borderWidth: 4,
    borderColor: colors.background,
  },
  shutterInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: colors.background,
  },
  findButton: {
    width: 110,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  permissionBody: {
    marginVertical: spacing.md,
    textAlign: 'center',
    color: colors.textMuted,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    fontWeight: '600',
    color: colors.background,
  },
});
