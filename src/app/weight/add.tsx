import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { fromKg, toKg } from '@/core';
import { db } from '@/db/client';
import { getProfile } from '@/db/repos/profile';
import { logManualWeight, manualWeightOn, weightsQuery } from '@/db/repos/weights';
import { dayLabel, localDate } from '@/lib/format';
import { parseNumber } from '@/services/onboarding';
import { Button, Field, Screen, Text } from '@/ui';

/** Epoch ms for a weigh-in on `date`: now if it's today, otherwise 8 am that day. */
function measuredAtFor(date: string, today: string): number {
  if (date === today) return Date.now();
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 8).getTime();
}

export default function AddWeight() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = localDate();
  const date = params.date && params.date <= today ? params.date : today;
  const profile = getProfile(db);
  const unit = profile?.weightUnit ?? 'lb';
  const existing = manualWeightOn(db, date);
  const prefill = existing ?? weightsQuery(db).all().at(-1);
  const [value, setValue] = useState(prefill && !profile?.hideWeight ? fromKg(prefill.weightKg, unit).toFixed(1) : '');
  const [error, setError] = useState<string | undefined>();

  const save = () => {
    const kg = toKg(parseNumber(value), unit);
    if (!(kg >= 30 && kg <= 300)) return setError(`Enter a weight between ${unit === 'lb' ? '66 and 660 lb' : '30 and 300 kg'}.`);
    logManualWeight(db, { weightKg: kg, localDate: date, measuredAt: existing?.measuredAt ?? measuredAtFor(date, today) });
    router.back();
  };

  return (
    <Screen footer={<Button title="Save" onPress={save} />}>
      <Text tone="secondary">
        {dayLabel(date, today)}
        {existing ? ' · updates this day’s weigh-in' : ''}
      </Text>
      <Field
        label="Weight"
        unit={unit}
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        value={value}
        onChangeText={setValue}
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <Text variant="caption" tone="secondary">
        Daily weight moves around with water, salt and food. Burnrate follows the trend, so any single number matters
        less than you'd think.
      </Text>
    </Screen>
  );
}
