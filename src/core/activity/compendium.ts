import type { Intensity } from '../types';

// MET values approximated from the Compendium of Physical Activities
// (Ainsworth et al., 2011; Herrmann et al., 2024 update, pacompendium.com).
// Each entry maps light / moderate / vigorous to a representative Compendium activity.
// Verify against the official tables before launch.

export interface ActivityType {
  code: string;
  name: string;
  category: 'walking' | 'running' | 'cycling' | 'cardio' | 'strength' | 'sport' | 'mind_body' | 'daily_life';
  met: Record<Intensity, number>;
  /** Typical steps per minute, for activities a step counter also records. */
  stepsPerMin?: Record<Intensity, number>;
}

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  { code: 'walking', name: 'Walking', category: 'walking', met: { light: 2.8, moderate: 3.5, vigorous: 5.0 }, stepsPerMin: { light: 90, moderate: 105, vigorous: 120 } },
  { code: 'hiking', name: 'Hiking', category: 'walking', met: { light: 5.3, moderate: 6.0, vigorous: 7.8 }, stepsPerMin: { light: 85, moderate: 95, vigorous: 105 } },
  { code: 'running', name: 'Running', category: 'running', met: { light: 8.3, moderate: 9.8, vigorous: 11.0 }, stepsPerMin: { light: 155, moderate: 165, vigorous: 175 } },
  { code: 'treadmill_walk', name: 'Treadmill walking', category: 'walking', met: { light: 3.0, moderate: 4.3, vigorous: 5.3 }, stepsPerMin: { light: 95, moderate: 110, vigorous: 120 } },
  { code: 'cycling', name: 'Cycling', category: 'cycling', met: { light: 6.8, moderate: 8.0, vigorous: 10.0 } },
  { code: 'stationary_bike', name: 'Stationary bike', category: 'cycling', met: { light: 3.5, moderate: 6.8, vigorous: 8.8 } },
  { code: 'swimming', name: 'Swimming', category: 'cardio', met: { light: 5.8, moderate: 8.3, vigorous: 9.8 } },
  { code: 'elliptical', name: 'Elliptical', category: 'cardio', met: { light: 4.0, moderate: 5.0, vigorous: 7.0 } },
  { code: 'rowing_machine', name: 'Rowing machine', category: 'cardio', met: { light: 4.8, moderate: 7.0, vigorous: 8.5 } },
  { code: 'stair_climber', name: 'Stair climber', category: 'cardio', met: { light: 5.0, moderate: 8.8, vigorous: 9.0 } },
  { code: 'hiit', name: 'HIIT / circuit', category: 'cardio', met: { light: 4.3, moderate: 6.0, vigorous: 8.0 } },
  { code: 'strength', name: 'Strength training', category: 'strength', met: { light: 3.5, moderate: 5.0, vigorous: 6.0 } },
  { code: 'yoga', name: 'Yoga', category: 'mind_body', met: { light: 2.5, moderate: 3.0, vigorous: 4.0 } },
  { code: 'pilates', name: 'Pilates', category: 'mind_body', met: { light: 2.8, moderate: 3.0, vigorous: 4.0 } },
  { code: 'dancing', name: 'Dancing', category: 'cardio', met: { light: 3.0, moderate: 5.0, vigorous: 7.3 } },
  { code: 'climbing', name: 'Climbing / bouldering', category: 'sport', met: { light: 5.8, moderate: 7.5, vigorous: 8.0 } },
  { code: 'basketball', name: 'Basketball', category: 'sport', met: { light: 4.5, moderate: 6.5, vigorous: 8.0 } },
  { code: 'soccer', name: 'Soccer', category: 'sport', met: { light: 5.0, moderate: 7.0, vigorous: 10.0 } },
  { code: 'tennis', name: 'Tennis', category: 'sport', met: { light: 5.0, moderate: 7.3, vigorous: 8.0 } },
  { code: 'yard_work', name: 'Yard work / chores', category: 'daily_life', met: { light: 2.5, moderate: 3.5, vigorous: 5.0 } },
];

/** Used when an imported workout has a type we don't know. */
export const FALLBACK_MET: Record<Intensity, number> = { light: 3.0, moderate: 5.0, vigorous: 8.0 };

const BY_CODE = new Map(ACTIVITY_TYPES.map((a) => [a.code, a]));

export function getActivityType(code: string): ActivityType | undefined {
  return BY_CODE.get(code);
}

export function searchActivityTypes(query: string): ActivityType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ACTIVITY_TYPES];
  return ACTIVITY_TYPES.filter((a) => a.name.toLowerCase().includes(q) || a.code.includes(q));
}
