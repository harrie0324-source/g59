import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { db } from '@/db/client';
import { updateProfile } from '@/db/repos/profile';
import { useAppData } from '@/hooks/useAppData';
import { eraseLocalData } from '@/services/erase';
import { Button, Card, Screen, Segmented, Text, ToggleRow, space } from '@/ui';

export default function Settings() {
  const { profileRow: p } = useAppData();
  if (!p) return null;

  const erase = () =>
    Alert.alert('Erase all data on this phone?', 'This removes your food log, weigh-ins and settings from this device. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: () => {
          eraseLocalData(db);
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <Screen edges={['top']}>
      <Text variant="title" accessibilityRole="header">
        Settings
      </Text>

      <Card>
        <Text variant="headline">Units</Text>
        <Segmented
          label="Units"
          value={p.weightUnit}
          onChange={(u) => updateProfile(db, { weightUnit: u, heightUnit: u === 'lb' ? 'ftin' : 'cm' })}
          options={[
            { value: 'lb', label: 'lb · ft/in' },
            { value: 'kg', label: 'kg · cm' },
          ]}
        />
      </Card>

      <Card>
        <ToggleRow
          label="Hide calorie numbers"
          description="Show progress without calorie counts."
          value={p.hideCalories}
          onValueChange={(hideCalories) => updateProfile(db, { hideCalories })}
        />
        <ToggleRow
          label="Hide weight numbers"
          description="Keep tracking your trend without seeing the numbers."
          value={p.hideWeight}
          onValueChange={(hideWeight) => updateProfile(db, { hideWeight })}
        />
      </Card>

      <Card tone="notice">
        <Text variant="headline">Not medical advice</Text>
        <Text>
          Burnrate's numbers are estimates for healthy adults, not a diagnosis or treatment plan. Talk with a doctor or
          registered dietitian about anything medical.
        </Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <Button title="Erase all data on this phone" variant="ghost" onPress={erase} />
      </View>
    </Screen>
  );
}
