// Shared domain types for the Burnrate algorithm.
// Internal units: kg, cm, kcal, minutes. Dates are local 'YYYY-MM-DD' strings.

export type ISODate = string; // 'YYYY-MM-DD'

export type FormulaSex = 'male' | 'female' | 'average';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type CalorieMode = 'adaptive' | 'daily_adjust';
export type PregnancyStatus = 'none' | 'pregnant' | 'breastfeeding';
export type DataSource = 'manual' | 'healthkit' | 'health_connect';
export type Intensity = 'light' | 'moderate' | 'vigorous';
export type WeightUnit = 'kg' | 'lb';

export interface Profile {
  formulaSex: FormulaSex;
  birthDate: ISODate;
  heightCm: number;
  activityLevel: ActivityLevel;
  calorieMode: CalorieMode;
  /** Share of estimated exercise burn added back in daily-adjust mode (0–1). */
  exerciseCredit: number;
  proteinGPerKg: number;
  fatMinGPerKg: number;
  pregnancyStatus: PregnancyStatus;
}

export interface Goal {
  id: string;
  type: GoalType;
  /** Always ≥ 0. Direction comes from `type`. Ignored for 'maintain'. */
  rateKgPerWeek: number;
  startDate: ISODate;
}

export type OutlierStatus = 'none' | 'confirmed';

export interface WeightEntry {
  id: string;
  localDate: ISODate;
  /** Epoch ms. Used to choose the earliest weigh-in of a day. */
  measuredAt: number;
  weightKg: number;
  source: DataSource;
  /** 'confirmed' = the user said this outlier is real, so it counts. */
  outlierStatus?: OutlierStatus;
}

export interface DayLog {
  date: ISODate;
  kcal: number;
  isComplete: boolean;
}

export interface ActivityLog {
  id: string;
  localDate: ISODate;
  /** Epoch ms; optional for manual entries. */
  startedAt?: number;
  activityCode: string;
  durationMin: number;
  intensity: Intensity;
  source: DataSource;
}

export interface StepEntry {
  localDate: ISODate;
  steps: number;
  source: DataSource;
}
