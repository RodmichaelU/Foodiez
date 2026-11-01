import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { RecipeCard } from '@/src/components/RecipeCard';
import { getResultSections } from '@/src/lib/session';
import { colors, spacing } from '@/src/theme';

export default function ResultsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SectionList
        sections={getResultSections()}
        keyExtractor={(recipe) => recipe.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No recipes matched those ingredients. Go back and try adding a few more.
          </Text>
        }
        renderSectionHeader={({ section }) => <Text style={styles.heading}>{section.title}</Text>}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
          />
        )}
      />
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
  heading: {
    marginBottom: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
