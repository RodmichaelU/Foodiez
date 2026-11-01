import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { GlassTabBar } from '@/src/components/GlassTabBar';

function tabIcon(name: SFSymbol) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <SymbolView name={name} tintColor={color} size={size} />
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerShown: false, tabBarIcon: tabIcon('house.fill') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('magnifyingglass') }}
      />
      <Tabs.Screen
        name="capture"
        options={{ title: 'Capture', headerShown: false, tabBarIcon: tabIcon('camera.fill') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person.fill') }}
      />
    </Tabs>
  );
}
