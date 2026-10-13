import { Stack } from 'expo-router';

import { useColors } from '@/ui';

/** Food screens live in their own stack, presented as one modal from Today. */
export default function FoodLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: c.primary,
        headerTitleStyle: { color: c.text },
        headerStyle: { backgroundColor: c.background },
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Screen name="search" options={{ title: 'Add food' }} />
      <Stack.Screen name="quick-add" options={{ title: 'Quick add' }} />
      <Stack.Screen name="custom" options={{ title: 'Create food' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
