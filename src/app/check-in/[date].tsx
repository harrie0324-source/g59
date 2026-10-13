import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { describeCheckIn, weeklyCheckIn } from '@/core';
import { db } from '@/db/client';
import { markCheckInSeen } from '@/db/repos/checkIns';
import { useAppData } from '@/hooks/useAppData';
import { dayLabel, formatKcal, localDate } from '@/lib/format';
import { toAnchorRow } from '@/services/checkins';
import { Button, Card, Screen, Text, space } from '@/ui';

export default function CheckIn() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const data = useAppData();

  useEffect(() => {
    if (date) markCheckInSeen(db, date);
  }, [date]);

  const idx = data.checkIns.findIndex((c) => c.date === date);
  const row = data.checkIns[idx];
  const p = data.profileRow;
  if (!row || !p || !data.profile) return null;

  // Re-derive the explanation from the same inputs (the algorithm is deterministic).
  const result = weeklyCheckIn({
    date: row.date,
    profile: data.profile,
    goals: data.goals,
    weights: data.weights,
    dayLogs: data.dayLogs,
    previous: toAnchorRow(data.checkIns[idx - 1]),
    options: { alpha: p.emaAlpha },
  });
  const lines = describeCheckIn(result, {
    unit: p.weightUnit,
    formulaSex: p.formulaSex,
    hideCalories: p.hideCalories,
    hideWeight: p.hideWeight,
  });

  return (
    <Screen footer={<Button title="Done" onPress={() => router.back()} />}>
      <Text tone="secondary">{dayLabel(row.date, localDate())}</Text>
      {!p.hideCalories && row.calorieTarget !== null ? (
        <Card>
          <Text variant="label" tone="secondary">
            Daily target
          </Text>
          <Text variant="display">
            {formatKcal(row.calorieTarget)}
            <Text variant="headline" tone="secondary">
              {' '}kcal
            </Text>
          </Text>
          <Text tone="secondary">
            {row.proteinG} g protein · {row.carbsG} g carbs · {row.fatG} g fat
          </Text>
        </Card>
      ) : null}
      <View style={{ gap: space.md }}>
        {lines.map((l) => (
          <Text key={l}>{l}</Text>
        ))}
      </View>
    </Screen>
  );
}
