import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db, dbReady } from '@/db/client';
import { Text, space, useColors } from '@/ui';

import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Native: ready immediately. Web previews: wait for the SQLite worker.
  const [ready, setReady] = useState(dbReady === null);
  useEffect(() => {
    dbReady?.then(() => setReady(true));
  }, []);
  return ready ? <App /> : null;
}

function App() {
  const { success, error } = useMigrations(db, migrations);
  const scheme = useColorScheme();
  const c = useColors();

  useEffect(() => {
    if (success || error) SplashScreen.hide();
  }, [success, error]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: c.background }}>
        <Text variant="title">Something went wrong</Text>
        <Text tone="secondary">Burnrate couldn't open its local database. Please restart the app.</Text>
        <Text variant="caption" tone="secondary">
          {error.message}
        </Text>
      </View>
    );
  }
  if (!success) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.background, card: c.background, text: c.text, border: c.border },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: c.primary,
            headerTitleStyle: { color: c.text },
            headerStyle: { backgroundColor: c.background },
            contentStyle: { backgroundColor: c.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="food/quick-add" options={{ presentation: 'modal', title: 'Quick add' }} />
          <Stack.Screen name="weight/add" options={{ presentation: 'modal', title: 'Log weight' }} />
          <Stack.Screen name="check-in/[date]" options={{ presentation: 'modal', title: 'Weekly check-in' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
