import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { db } from '@/db/client';
import { createCustomFood, deleteFood, getFood, updateCustomFood } from '@/db/repos/foods';
import type { Meal } from '@/db/schema';
import { emptyCustomFood, parseCustomFood, type CustomFoodForm } from '@/services/customFood';
import { Button, Field, Screen, Text, space } from '@/ui';

function formFor(id: string | undefined): CustomFoodForm {
  const f = id ? getFood(db, id) : undefined;
  if (!f) return emptyCustomFood;
  const s = f.servings[0]!;
  const per = (v: number) => String(Math.round(((v * s.grams) / 100) * 10) / 10);
  return {
    name: f.name,
    brand: f.brand ?? '',
    servingLabel: s.label,
    servingGrams: f.gramsKnown ? String(s.grams) : '',
    kcal: per(f.kcal100g),
    proteinG: per(f.protein100g),
    carbsG: per(f.carbs100g),
    fatG: per(f.fat100g),
  };
}

export default function CustomFood() {
  const params = useLocalSearchParams<{ id?: string; barcode?: string; date?: string; meal?: Meal }>();
  const editing = params.id ? getFood(db, params.id) : undefined;
  const [form, setForm] = useState<CustomFoodForm>(() => formFor(params.id));
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof CustomFoodForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const parsed = parseCustomFood(form, editing?.barcode ?? params.barcode);
  const errors = submitted && !parsed.ok ? parsed.errors : {};

  const save = () => {
    setSubmitted(true);
    if (!parsed.ok) return;
    if (editing) {
      updateCustomFood(db, editing.id, parsed.value);
      router.back();
    } else {
      const id = createCustomFood(db, parsed.value);
      // Straight to logging it.
      router.replace({ pathname: '/food/[id]', params: { id, date: params.date, meal: params.meal } });
    }
  };

  const remove = () =>
    Alert.alert('Delete this food?', 'Entries you already logged stay in your log.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => (deleteFood(db, editing!.id), router.dismissAll()) },
    ]);

  return (
    <Screen
      footer={
        <>
          <Button title={editing ? 'Save food' : 'Create food'} onPress={save} />
          {editing ? <Button title="Delete food" variant="ghost" onPress={remove} /> : null}
        </>
      }>
      <Stack.Screen options={{ title: editing ? 'Edit food' : 'Create food' }} />
      {params.barcode && !editing ? (
        <Text variant="caption" tone="secondary">
          Barcode {params.barcode} will be saved with this food.
        </Text>
      ) : null}
      <Field label="Name" value={form.name} onChangeText={set('name')} error={errors.name} autoFocus={!editing} maxLength={80} />
      <Field label="Brand (optional)" value={form.brand} onChangeText={set('brand')} maxLength={60} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field flex={1.4} label="Serving" value={form.servingLabel} onChangeText={set('servingLabel')} maxLength={40} />
        <Field flex={1} label="Weight (optional)" unit="g" keyboardType="decimal-pad" value={form.servingGrams} onChangeText={set('servingGrams')} />
      </View>
      {errors.servingGrams ? <Text variant="caption">{errors.servingGrams}</Text> : null}
      <Text variant="label" tone="secondary">
        Per serving (from the label)
      </Text>
      <Field label="Calories" unit="kcal" keyboardType="number-pad" value={form.kcal} onChangeText={set('kcal')} error={errors.kcal} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field flex={1} label="Protein" unit="g" keyboardType="decimal-pad" value={form.proteinG} onChangeText={set('proteinG')} />
        <Field flex={1} label="Carbs" unit="g" keyboardType="decimal-pad" value={form.carbsG} onChangeText={set('carbsG')} />
        <Field flex={1} label="Fat" unit="g" keyboardType="decimal-pad" value={form.fatG} onChangeText={set('fatG')} />
      </View>
      {errors.proteinG ? <Text variant="caption">{errors.proteinG}</Text> : null}
      <Text variant="caption" tone="secondary">
        Adding the serving weight lets you log this food in grams too.
      </Text>
    </Screen>
  );
}
