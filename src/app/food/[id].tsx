import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { db } from '@/db/client';
import { defaultServing, deleteFoodLog, getFoodLog, logFood, updateLoggedFood } from '@/db/repos/foodLogs';
import { getFood, setFavorite } from '@/db/repos/foods';
import { getProfile } from '@/db/repos/profile';
import type { Meal } from '@/db/schema';
import { formatKcal, localDate, mealForTime } from '@/lib/format';
import { GRAM_UNIT, gramsFor, nutrientsFor } from '@/services/food/nutrition';
import { parseNumber } from '@/services/onboarding';
import { useUi } from '@/stores/ui';
import { Button, Card, Field, Screen, Segmented, Text, space, useColors } from '@/ui';

const SOURCE_NOTE = { usda: 'Data: USDA FoodData Central', off: 'Data from Open Food Facts (ODbL)', custom: 'Your food' } as const;

export default function FoodDetail() {
  const c = useColors();
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: Meal; logId?: string }>();
  const food = getFood(db, params.id);
  const log = params.logId ? getFoodLog(db, params.logId) : undefined;
  const hideCalories = getProfile(db)?.hideCalories ?? false;
  const setLastAdded = useUi((s) => s.setLastAdded);

  const initial = log ? { qty: log.servingsQty, unit: log.servingLabel ?? GRAM_UNIT } : food ? defaultServing(food) : { qty: 1, unit: GRAM_UNIT };
  const [qty, setQty] = useState(String(initial.qty));
  const [unit, setUnit] = useState(initial.unit);
  const [meal, setMeal] = useState<Meal>(log?.meal ?? params.meal ?? mealForTime());
  const [favorite, setFav] = useState(food?.isFavorite ?? false);

  if (!food) {
    return (
      <Screen>
        <Text>This food is no longer available.</Text>
      </Screen>
    );
  }

  const units = [...food.servings.map((s) => s.label), ...(food.gramsKnown ? [GRAM_UNIT] : [])];
  const amount = parseNumber(qty);
  const grams = gramsFor(food.servings, unit, amount);
  const n = grams !== null ? nutrientsFor(food, grams) : null;
  const date = log?.localDate ?? params.date ?? localDate();

  const save = () => {
    if (!n || grams === null || amount > 5000) return;
    const input = { food, qty: amount, unit, meal, localDate: date };
    if (log) {
      updateLoggedFood(db, log.id, input);
    } else {
      const logId = logFood(db, input);
      setLastAdded({ logId, name: food.name });
    }
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => (deleteFoodLog(db, log!.id), router.back()) },
    ]);

  const toggleFavorite = () => {
    setFavorite(db, food.id, !favorite);
    setFav(!favorite);
  };

  return (
    <Screen
      footer={
        <>
          <Button title={log ? 'Save changes' : 'Add'} disabled={!n} onPress={save} />
          {log ? <Button title="Delete entry" variant="ghost" onPress={remove} /> : null}
        </>
      }>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'} hitSlop={12} onPress={toggleFavorite}>
              <Ionicons name={favorite ? 'star' : 'star-outline'} size={24} color={c.primary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: 2 }}>
        <Text variant="title" accessibilityRole="header">
          {food.name}
        </Text>
        {food.brand ? <Text tone="secondary">{food.brand}</Text> : null}
      </View>

      {!hideCalories && n ? (
        <Card>
          <Text variant="display" accessibilityLabel={`${formatKcal(n.kcal)} calories`}>
            {formatKcal(n.kcal)}
            <Text variant="headline" tone="secondary">
              {' '}kcal
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            {(
              [
                ['Protein', n.proteinG, c.protein],
                ['Carbs', n.carbsG, c.carbs],
                ['Fat', n.fatG, c.fat],
              ] as const
            ).map(([label, g, color]) => (
              <View key={label} accessible accessibilityLabel={`${label} ${Math.round(g)} grams`}>
                <Text variant="headline" style={{ color }}>
                  {Math.round(g)} g
                </Text>
                <Text variant="caption" tone="secondary">
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Field
        label="Amount"
        keyboardType="decimal-pad"
        selectTextOnFocus
        value={qty}
        onChangeText={setQty}
        unit={unit === GRAM_UNIT ? 'g' : undefined}
        error={qty && !n ? 'Enter an amount above 0.' : undefined}
      />
      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="secondary">
          Serving
        </Text>
        <Segmented
          label="Serving"
          value={unit}
          onChange={(u) => {
            // Switching between servings and grams keeps the same amount of food.
            if (grams !== null && (u === GRAM_UNIT) !== (unit === GRAM_UNIT)) {
              setQty(String(u === GRAM_UNIT ? Math.round(grams) : Math.round((grams / food.servings.find((s) => s.label === u)!.grams) * 100) / 100));
            }
            setUnit(u);
          }}
          options={units.map((u) => ({ value: u, label: u === GRAM_UNIT ? 'grams' : u }))}
        />
      </View>
      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="secondary">
          Meal
        </Text>
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
      </View>

      {food.source === 'custom' ? (
        <Button title="Edit this food" variant="ghost" compact onPress={() => router.push({ pathname: '/food/custom', params: { id: food.id } })} />
      ) : null}
      <Text variant="caption" tone="secondary">
        {SOURCE_NOTE[food.source]}. Nutrition values are estimates.
      </Text>
    </Screen>
  );
}
