// Loads everything the algorithm needs from the database, as pure core types.
import type { DayLog, Goal, Profile, WeightEntry } from '@/core';
import { toDayLogs, toGoal, toProfile, toWeightEntry } from '@/db/mappers';
import { checkInsQuery, type CheckInRow } from '@/db/repos/checkIns';
import { daysQuery } from '@/db/repos/days';
import { dailyTotalsQuery } from '@/db/repos/foodLogs';
import { goalsQuery } from '@/db/repos/goals';
import { getProfile, type ProfileRow } from '@/db/repos/profile';
import { weightsQuery } from '@/db/repos/weights';
import type { DB } from '@/db/types';

export interface AppData {
  profileRow: ProfileRow;
  profile: Profile;
  goals: Goal[];
  weights: WeightEntry[];
  dayLogs: DayLog[];
  checkIns: CheckInRow[];
}

export function loadAppData(db: DB): AppData | null {
  const profileRow = getProfile(db);
  if (!profileRow) return null;
  return {
    profileRow,
    profile: toProfile(profileRow),
    goals: goalsQuery(db).all().map(toGoal),
    weights: weightsQuery(db).all().map(toWeightEntry),
    dayLogs: toDayLogs(dailyTotalsQuery(db).all(), daysQuery(db).all()),
    checkIns: checkInsQuery(db).all(),
  };
}
