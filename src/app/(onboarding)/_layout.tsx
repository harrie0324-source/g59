import { Stack } from 'expo-router';

import { useColors } from '@/ui';

export default function OnboardingLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        title: '',
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: c.primary,
        headerStyle: { backgroundColor: c.background },
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
