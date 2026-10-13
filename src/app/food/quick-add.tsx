import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { db } from '@/db/client';
import { deleteFoodLog, getFoodLog, quickAdd, updateQuickAdd } from '@/db/repos/foodLogs';
import type { Meal } from '@/db/schema';
import { localDate, mealForTime } from '@/lib/format';
import { parseQuickAdd, toForm, type QuickAddForm } from '@/services/quickAdd';
import { Button, Field, Screen, Segmented, Text, space } from '@/ui';

export default function QuickAdd() {
  const params = useLocalSearchParams<{ date?: string; id?: string; meal?: Meal }>();
  const existing = params.id ? getFoodLog(db, params.id) : undefined;
  const date = existing?.localDate ?? params.date ?? localDate();

  const [meal, setMeal] = useState<Meal>(existing?.meal ?? params.meal ?? mealForTime());
  const [name, setName] = useState(existing?.name === 'Quick add' ? '' : existing?.name ?? '');
  const [form, setForm] = useState<QuickAddForm>(existing ? toForm(existing) : { kcal: '', proteinG: '', carbsG: '', fatG: '' });
  const [error, setError] = useState<string | undefined>();
  const set = (k: keyof QuickAddForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const r = parseQuickAdd(form);
    if (!r.ok) return setError(r.error);
    const input = { localDate: date, meal, name, kcal: r.kcal, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG };
    if (existing) updateQuickAdd(db, existing.id, input);
    else quickAdd(db, input);
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteFoodLog(db, existing!.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      footer={
        <>
          <Button title={existing ? 'Save changes' : 'Add'} onPress={save} />
          {existing ? <Button title="Delete entry" variant="ghost" onPress={remove} /> : null}
        </>
      }>
      <Stack.Screen options={{ title: existing ? 'Edit entry' : 'Quick add' }} />
      <Segmented
        label="Meal"
        value={meal}
        onChange={setMeal}
        options={[
          { value: 'breakfast', label: 'Breakfast' },
          { value: 'lunch', label: 'Lunch' },
          { value: 'dinner', label: 'Dinner' },
          { value: 'snack', label: 'Snack' },
        ]}
      />
      <Field
        label="Calories"
        unit="kcal"
        keyboardType="number-pad"
        autoFocus={!existing}
        value={form.kcal}
        onChangeText={set('kcal')}
        placeholder="e.g. 450"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field flex={1} label="Protein" unit="g" keyboardType="decimal-pad" value={form.proteinG} onChangeText={set('proteinG')} />
        <Field flex={1} label="Carbs" unit="g" keyboardType="decimal-pad" value={form.carbsG} onChangeText={set('carbsG')} />
        <Field flex={1} label="Fat" unit="g" keyboardType="decimal-pad" value={form.fatG} onChangeText={set('fatG')} />
      </View>
      <Text variant="caption" tone="secondary">
        Macros are optional. Leave calories blank to calculate them from macros.
      </Text>
      <Field label="Name (optional)" placeholder="Quick add" value={name} onChangeText={setName} maxLength={60} />
      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
