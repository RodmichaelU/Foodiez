import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';

import { colors } from '@/src/theme';

function tabIcon(name: SFSymbol) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name} tintColor={color} size={26} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('house.fill') }} />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('magnifyingglass') }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          headerShown: false,
          tabBarLabel: () => null,
          tabBarButton: ({ onPress, accessibilityState }) => (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel="Capture"
              accessibilityState={accessibilityState}
              style={styles.captureSlot}>
              <View style={styles.captureButton}>
                <SymbolView name="camera.fill" tintColor={colors.background} size={28} />
              </View>
            </Pressable>
          ),
        }}
      />
      {/* Double width balances Home and Search, which keeps Capture in the true centre. */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person.fill'),
          tabBarItemStyle: styles.profileItem,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  captureSlot: {
    flex: 1,
    alignItems: 'center',
  },
  captureButton: {
    width: 64,
    height: 64,
    marginTop: -20,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.background,
    shadowColor: colors.text,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  profileItem: {
    flex: 2,
  },
});
