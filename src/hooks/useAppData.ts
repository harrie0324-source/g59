import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { toDayLogs, toGoal, toProfile, toWeightEntry } from '@/db/mappers';
import { checkInsQuery } from '@/db/repos/checkIns';
import { daysQuery } from '@/db/repos/days';
import { dailyTotalsQuery } from '@/db/repos/foodLogs';
import { goalsQuery } from '@/db/repos/goals';
import { profileQuery } from '@/db/repos/profile';
import { weightsQuery } from '@/db/repos/weights';

/** Live view of everything the algorithm needs. Re-renders when any of these tables change. */
export function useAppData() {
  const profile = useLiveQuery(profileQuery(db));
  const goals = useLiveQuery(goalsQuery(db));
  const weights = useLiveQuery(weightsQuery(db));
  const totals = useLiveQuery(dailyTotalsQuery(db));
  const days = useLiveQuery(daysQuery(db));
  const checkIns = useLiveQuery(checkInsQuery(db));

  const queries = [profile, goals, weights, totals, days, checkIns];
  // Surface database errors (to the error boundary) instead of waiting forever on a blank screen.
  const failed = queries.find((q) => q.error)?.error;
  if (failed) throw failed;
  const loaded = queries.every((q) => q.updatedAt !== undefined);
  const profileRow = profile.data[0];

  return useMemo(
    () => ({
      loaded,
      profileRow,
      profile: profileRow ? toProfile(profileRow) : undefined,
      goals: goals.data.map(toGoal),
      weights: weights.data.map(toWeightEntry),
      dayLogs: toDayLogs(totals.data, days.data),
      days: days.data,
      checkIns: checkIns.data,
    }),
    [loaded, profileRow, goals.data, weights.data, totals.data, days.data, checkIns.data],
  );
}
