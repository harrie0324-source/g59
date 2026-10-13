import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { addDays, type WeightUnit } from '@/core';
import type { FoodLogRow } from '@/db/repos/foodLogs';
import type { Meal } from '@/db/schema';
import { dayLabel, dayPhrase, formatKcal, formatWeight } from '@/lib/format';
import type { Macros, TodayModel } from '@/services/today';
import { Button, Card, ProgressBar, Text, space, useColors } from '@/ui';

export function DayHeader({ date, today, onChange }: { date: string; today: string; onChange: (d: string | null) => void }) {
  const c = useColors();
  const isToday = date === today;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" hitSlop={12} onPress={() => onChange(addDays(date, -1))}>
        <Ionicons name="chevron-back" size={26} color={c.primary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={isToday ? 'Today' : `${dayLabel(date, today)}. Go to today`} onPress={() => onChange(null)}>
        <Text variant="title" accessibilityRole="header">
          {dayLabel(date, today)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: isToday }}
        disabled={isToday}
        hitSlop={12}
        onPress={() => onChange(addDays(date, 1) >= today ? null : addDays(date, 1))}>
        <Ionicons name="chevron-forward" size={26} color={isToday ? c.track : c.primary} />
      </Pressable>
    </View>
  );
}

export function CaloriesCard({ model, hideCalories }: { model: TodayModel; hideCalories: boolean }) {
  const c = useColors();
  const { target, eaten, remainingKcal } = model;
  const above = remainingKcal !== null && remainingKcal < 0;
  const macros: [keyof Macros, string, string][] = [
    ['proteinG', 'Protein', c.protein],
    ['carbsG', 'Carbs', c.carbs],
    ['fatG', 'Fat', c.fat],
  ];
  return (
    <Card>
      {hideCalories ? (
        <Text variant="headline">Food today</Text>
      ) : target && remainingKcal !== null ? (
        <View accessible accessibilityLabel={above ? `${formatKcal(-remainingKcal)} calories above today's target` : `${formatKcal(remainingKcal)} calories left today`}>
          <Text variant="display">{formatKcal(Math.abs(remainingKcal))}</Text>
          <Text tone="secondary">{above ? "kcal above today's target" : 'kcal left'}</Text>
        </View>
      ) : (
        <View accessible>
          <Text variant="display">{formatKcal(eaten.kcal)}</Text>
          <Text tone="secondary">kcal logged</Text>
        </View>
      )}
      {target ? <ProgressBar value={eaten.kcal} max={target.kcal} height={10} /> : null}
      {!hideCalories && target ? (
        <Text variant="caption" tone="secondary">
          {formatKcal(eaten.kcal)} eaten · {formatKcal(target.kcal)} target
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {macros.map(([key, label, color]) => (
          <View key={key} style={{ flex: 1, gap: space.xs }} accessible accessibilityLabel={hideCalories ? label : `${label}: ${Math.round(eaten[key])} of ${Math.round(target?.[key] ?? 0)} grams`}>
            <Text variant="label">{label}</Text>
            {target ? <ProgressBar value={eaten[key]} max={target[key]} color={color} /> : null}
            {!hideCalories ? (
              <Text variant="caption" tone="secondary">
                {Math.round(eaten[key])}
                {target ? ` / ${Math.round(target[key])}` : ''} g
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export function FoodList({ logs, date, hideCalories }: { logs: FoodLogRow[]; date: string; hideCalories: boolean }) {
  const c = useColors();
  if (logs.length === 0) {
    return (
      <Text tone="secondary" style={{ textAlign: 'center', paddingVertical: space.md }}>
        Nothing logged yet.
      </Text>
    );
  }
  return (
    <View style={{ gap: space.lg }}>
      {MEALS.map(({ key, label }) => {
        const items = logs.filter((l) => l.meal === key);
        if (!items.length) return null;
        const total = items.reduce((s, l) => s + l.kcal, 0);
        return (
          <View key={key} style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" tone="secondary" accessibilityRole="header">
                {label}
              </Text>
              {!hideCalories ? (
                <Text variant="label" tone="secondary">
                  {formatKcal(total)}
                </Text>
              ) : null}
            </View>
            {items.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`${l.name}${hideCalories ? '' : `, ${formatKcal(l.kcal)} calories`}. Edit`}
                onPress={() => router.push({ pathname: '/food/quick-add', params: { id: l.id, date } })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: 48,
                  paddingHorizontal: space.md,
                  borderRadius: 10,
                  backgroundColor: pressed ? c.surfaceAlt : c.surface,
                })}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text>{l.name}</Text>
                  {!hideCalories && (l.proteinG || l.carbsG || l.fatG) ? (
                    <Text variant="caption" tone="secondary">
                      P {Math.round(l.proteinG)} · C {Math.round(l.carbsG)} · F {Math.round(l.fatG)}
                    </Text>
                  ) : null}
                </View>
                {!hideCalories ? <Text>{formatKcal(l.kcal)}</Text> : null}
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function WeightCard({ model, unit, hideWeight, date }: { model: TodayModel; unit: WeightUnit; hideWeight: boolean; date: string }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="secondary">
            Trend weight
          </Text>
          {hideWeight ? (
            <Text variant="headline">{model.latestWeight ? 'Logged' : 'No weigh-ins yet'}</Text>
          ) : (
            <Text variant="title">{model.trendKg !== null ? formatWeight(model.trendKg, unit) : '—'}</Text>
          )}
          {model.latestWeight && !hideWeight ? (
            <Text variant="caption" tone="secondary">
              Last weigh-in {formatWeight(model.latestWeight.kg, unit)}
            </Text>
          ) : null}
        </View>
        <Button title="Log weight" variant="secondary" compact onPress={() => router.push({ pathname: '/weight/add', params: { date } })} />
      </View>
    </Card>
  );
}

const CONFIDENCE = { learning: 1, low: 2, medium: 3, high: 4 } as const;
const CONFIDENCE_LABEL = { learning: 'Still learning', low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' } as const;

export function BurnRateCard({ model, hideCalories, today }: { model: TodayModel; hideCalories: boolean; today: string }) {
  const c = useColors();
  const e = model.estimate;
  if (!e) return null;
  const level = e.status === 'learning' ? 'learning' : e.confidence;
  const filled = CONFIDENCE[level];
  const needs: string[] = [];
  if (e.needed.completeDays > 0) needs.push(`${e.needed.completeDays} more fully logged ${e.needed.completeDays === 1 ? 'day' : 'days'}`);
  if (e.needed.weighIns > 0) needs.push(`${e.needed.weighIns} more ${e.needed.weighIns === 1 ? 'weigh-in' : 'weigh-ins'}`);
  return (
    <Card>
      <Text variant="label" tone="secondary">
        Estimated burn rate
      </Text>
      {!hideCalories ? (
        <Text variant="title">
          ~{formatKcal(Math.round(e.tdee / 10) * 10)}
          <Text tone="secondary"> kcal/day</Text>
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={CONFIDENCE_LABEL[level]}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: i <= filled ? c.primary : c.track }} />
          ))}
        </View>
        <Text variant="caption" tone="secondary">
          {CONFIDENCE_LABEL[level]}
        </Text>
      </View>
      {e.status === 'learning' ? (
        <Text variant="caption" tone="secondary">
          {e.learningStarts
            ? `Using a formula estimate for now. Learning starts ${dayPhrase(e.learningStarts, today)}: the first week after setting a goal mostly shows water shifts, so it isn't used. Keep logging as usual.`
            : needs.length
              ? `Using a formula estimate for now. Needs ${needs.join(' and ')} to learn from your data.`
              : 'Enough data collected. Your estimate updates at the next weekly check-in.'}
        </Text>
      ) : null}
    </Card>
  );
}
