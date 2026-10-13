import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { db } from '@/db/client';
import { useAppData } from '@/hooks/useAppData';
import { useLocalToday } from '@/hooks/useLocalToday';
import { runDueCheckIns } from '@/services/checkins';
import { useColors } from '@/ui';

export default function TabsLayout() {
  const c = useColors();
  const { loaded, profileRow } = useAppData();
  const today = useLocalToday();

  // Weekly check-ins run on launch and when the day changes (catching up if needed).
  useEffect(() => {
    if (profileRow) runDueCheckIns(db, today);
  }, [profileRow, today]);

  if (!loaded) return null;
  if (!profileRow) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
