import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { setDayComplete } from '@/db/repos/days';
import { foodLogsForDateQuery } from '@/db/repos/foodLogs';
import { confirmWeight, deleteWeight } from '@/db/repos/weights';
import { BurnRateCard, CaloriesCard, DayHeader, FoodList, WeightCard } from '@/features/today/components';
import { useAppData } from '@/hooks/useAppData';
import { useLocalToday } from '@/hooks/useLocalToday';
import { dayPhrase, formatWeight } from '@/lib/format';
import { buildTodayModel } from '@/services/today';
import { useUi } from '@/stores/ui';
import { Button, Card, Screen, Text, ToggleRow, space } from '@/ui';

export default function Today() {
  const today = useLocalToday();
  const { viewedDate, setViewedDate } = useUi();
  const date = viewedDate && viewedDate < today ? viewedDate : today;
  const data = useAppData();
  const { data: logs } = useLiveQuery(foodLogsForDateQuery(db, date), [date]);

  const p = data.profileRow;
  if (!p || !data.profile) return null;

  const model = buildTodayModel({
    date,
    today,
    profile: data.profile,
    emaAlpha: p.emaAlpha,
    goals: data.goals,
    weights: data.weights,
    dayLogs: data.dayLogs,
    checkIns: data.checkIns,
    dayFood: logs,
  });
  const isComplete = data.days.find((d) => d.localDate === date)?.isComplete ?? false;

  return (
    <Screen edges={['top']}>
      <DayHeader date={date} today={today} onChange={setViewedDate} />

      {model.unseenCheckIn ? (
        <Card tone="soft">
          <Text variant="headline">Your weekly check-in is ready</Text>
          <Text>See what Burnrate learned this week.</Text>
          <Button title="Open check-in" compact onPress={() => router.push({ pathname: '/check-in/[date]', params: { date: model.unseenCheckIn! } })} />
        </Card>
      ) : null}

      {model.outlier ? (
        <Card tone="notice">
          <Text>
            Your weigh-in {dayPhrase(model.outlier.date, today)}
            {p.hideWeight ? '' : ` (${formatWeight(model.outlier.weightKg, p.weightUnit)})`} is quite different from your
            trend.{' '}
            Scales jump around, so it's left out unless you keep it.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Keep it" variant="secondary" compact onPress={() => confirmWeight(db, model.outlier!.entryId)} />
            <Button title="Remove" variant="ghost" compact onPress={() => deleteWeight(db, model.outlier!.entryId)} />
          </View>
        </Card>
      ) : null}

      <CaloriesCard model={model} hideCalories={p.hideCalories} />

      <Button title="Add food" onPress={() => router.push({ pathname: '/food/quick-add', params: { date } })} />

      <FoodList logs={logs} date={date} hideCalories={p.hideCalories} />

      <Card>
        <ToggleRow
          label="Fully logged"
          description="Turn on when everything you ate is logged. Burnrate only learns from these days."
          value={isComplete}
          onValueChange={(v) => setDayComplete(db, date, v)}
        />
      </Card>

      <WeightCard model={model} unit={p.weightUnit} hideWeight={p.hideWeight} date={date} />
      <BurnRateCard model={model} hideCalories={p.hideCalories} today={today} />
    </Screen>
  );
}
