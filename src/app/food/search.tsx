import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { addDays } from '@/core';
import { db } from '@/db/client';
import { copyMeal, deleteFoodLog, defaultServing, foodLogsForDateQuery, logFood } from '@/db/repos/foodLogs';
import { customFoodsQuery, favoriteFoodsQuery, getFood, recentFoodsQuery, saveExternalFood, searchLocalFoods, type FoodRow as FoodRecord } from '@/db/repos/foods';
import { getProfile } from '@/db/repos/profile';
import type { Meal } from '@/db/schema';
import { dtoRowInfo, rowInfo } from '@/features/food/describe';
import { FoodRow } from '@/features/food/FoodRow';
import { useDebounced } from '@/hooks/useDebounced';
import { formatKcal, localDate, mealForTime } from '@/lib/format';
import { foodApi, FoodApiError } from '@/services/food/api';
import type { FoodDTO } from '@/services/food/types';
import { useUi } from '@/stores/ui';
import { Button, Card, Screen, Segmented, Text, radius, space, type, useColors } from '@/ui';

const MEAL_LABEL: Record<Meal, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snacks' };
type Tab = 'recent' | 'favorites' | 'mine';

export default function FoodSearch() {
  const c = useColors();
  const params = useLocalSearchParams<{ date?: string; meal?: Meal }>();
  const date = params.date ?? localDate();
  const [meal, setMeal] = useState<Meal>(params.meal ?? mealForTime());
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const q = useDebounced(query.trim(), 300);
  const searching = q.length >= 2;
  const hideCalories = getProfile(db)?.hideCalories ?? false;
  const { lastAdded, setLastAdded } = useUi();

  useEffect(() => () => setLastAdded(null), [setLastAdded]);

  const recent = useLiveQuery(recentFoodsQuery(db)).data;
  const favorites = useLiveQuery(favoriteFoodsQuery(db)).data;
  const mine = useLiveQuery(customFoodsQuery(db)).data;
  const yesterday = useLiveQuery(foodLogsForDateQuery(db, addDays(date, -1)), [date]).data;
  const today = useLiveQuery(foodLogsForDateQuery(db, date), [date]).data;

  // Cheap synchronous query; re-run each render so it reflects newly saved foods.
  const local = searching ? searchLocalFoods(db, q) : [];
  const remote = useQuery({
    queryKey: ['food-search', q.toLowerCase()],
    queryFn: ({ signal }) => foodApi.searchFoods(q, signal),
    enabled: searching && foodApi.mode !== 'none',
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const localKeys = new Set(local.map((f) => `${f.source}:${f.sourceId}`));
  const remoteFoods = (remote.data ?? []).filter((f) => !localKeys.has(`${f.source}:${f.sourceId}`));

  const yMeal = yesterday.filter((l) => l.meal === meal);
  const canCopy = !searching && yMeal.length > 0 && !today.some((l) => l.meal === meal);

  const open = (id: string) => router.push({ pathname: '/food/[id]', params: { id, date, meal } });
  const quickLog = (food: FoodRecord) => {
    const logId = logFood(db, { food, ...defaultServing(food), meal, localDate: date });
    setLastAdded({ logId, name: food.name });
  };
  const openRemote = (dto: FoodDTO) => open(saveExternalFood(db, dto));
  const quickLogRemote = (dto: FoodDTO) => quickLog(getFood(db, saveExternalFood(db, dto))!);

  const list = tab === 'recent' ? recent : tab === 'favorites' ? favorites : mine;
  const emptyText =
    tab === 'recent' ? 'Foods you log will show up here.' : tab === 'favorites' ? 'Tap the star on any food to keep it here.' : 'Foods you create will show up here.';

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Quick add" variant="secondary" onPress={() => router.push({ pathname: '/food/quick-add', params: { date, meal } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Create food" variant="secondary" onPress={() => router.push({ pathname: '/food/custom', params: { date, meal } })} />
          </View>
        </View>
      }>
      <Stack.Screen options={{ title: 'Add food', headerRight: () => <Button title="Done" variant="ghost" compact onPress={() => router.back()} /> }} />

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

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.md }}>
          <Ionicons name="search" size={18} color={c.textSecondary} />
          <TextInput
            accessibilityLabel="Search foods"
            placeholder="Search foods"
            placeholderTextColor={c.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[type.body, { flex: 1, minHeight: 48, marginLeft: space.sm, color: c.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a barcode"
          onPress={() => router.push({ pathname: '/food/scan', params: { date, meal } })}
          style={{ width: 50, height: 50, borderRadius: radius.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="barcode-outline" size={26} color={c.primary} />
        </Pressable>
      </View>

      {lastAdded ? (
        <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm }}>
          <Text style={{ flex: 1 }} accessibilityLiveRegion="polite" numberOfLines={2}>
            Added {lastAdded.name}
          </Text>
          <Button
            title="Undo"
            variant="ghost"
            compact
            onPress={() => {
              deleteFoodLog(db, lastAdded.logId);
              setLastAdded(null);
            }}
          />
        </Card>
      ) : null}

      {canCopy ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const n = copyMeal(db, addDays(date, -1), date, meal);
            setLastAdded(null);
            if (n) router.back();
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="copy-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text>Copy yesterday&apos;s {MEAL_LABEL[meal]}</Text>
            <Text variant="caption" tone="secondary">
              {yMeal.length} {yMeal.length === 1 ? 'item' : 'items'}
              {hideCalories ? '' : ` · ${formatKcal(yMeal.reduce((s, l) => s + l.kcal, 0))} kcal`}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {searching ? (
        <View style={{ gap: space.sm }}>
          {local.length ? (
            <Text variant="label" tone="secondary" accessibilityRole="header">
              On this phone
            </Text>
          ) : null}
          {local.map((f) => {
            const info = rowInfo(f);
            return <FoodRow key={f.id} name={f.name} subtitle={[f.brand, info.serving].filter(Boolean).join(' · ')} kcal={info.kcal} hideCalories={hideCalories} onPress={() => open(f.id)} onQuickAdd={() => quickLog(f)} />;
          })}

          <Text variant="label" tone="secondary" accessibilityRole="header" style={{ marginTop: space.sm }}>
            Food database
          </Text>
          {foodApi.mode === 'none' ? (
            <Text tone="secondary">Online food search isn&apos;t set up yet. You can still create foods and use quick add.</Text>
          ) : remote.isFetching && !remote.data ? (
            <ActivityIndicator accessibilityLabel="Searching" color={c.primary} />
          ) : remote.error ? (
            <Text tone="secondary">
              {remote.error instanceof FoodApiError && remote.error.kind === 'offline'
                ? "You're offline. Foods saved on this phone still work."
                : 'Food search is having trouble right now. Try again in a moment.'}
            </Text>
          ) : remoteFoods.length === 0 ? (
            <Text tone="secondary">No matches. Try fewer words, or create the food.</Text>
          ) : (
            remoteFoods.map((dto) => {
              const info = dtoRowInfo(dto);
              return (
                <FoodRow
                  key={`${dto.source}:${dto.sourceId}`}
                  name={dto.name}
                  subtitle={[dto.brand, info.serving].filter(Boolean).join(' · ')}
                  kcal={info.kcal}
                  hideCalories={hideCalories}
                  onPress={() => openRemote(dto)}
                  onQuickAdd={() => quickLogRemote(dto)}
                />
              );
            })
          )}
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Segmented
            label="Food lists"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'favorites', label: 'Favorites' },
              { value: 'mine', label: 'My foods' },
            ]}
          />
          {list.length === 0 ? (
            <Text tone="secondary" style={{ textAlign: 'center', paddingVertical: space.lg }}>
              {emptyText}
            </Text>
          ) : (
            list.map((f) => {
              const info = rowInfo(f);
              return <FoodRow key={f.id} name={f.name} subtitle={[f.brand, info.serving].filter(Boolean).join(' · ')} kcal={info.kcal} hideCalories={hideCalories} onPress={() => open(f.id)} onQuickAdd={() => quickLog(f)} />;
            })
          )}
        </View>
      )}
    </Screen>
  );
}
