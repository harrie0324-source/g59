import type { WeightUnit } from './types';

// Everything is stored in kg / cm. Convert only at the display/input edge.

export const KG_PER_LB = 0.45359237; // exact, by definition
export const CM_PER_IN = 2.54; // exact

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

/** Per-bodyweight ratios (e.g. protein): g/lb ↔ g/kg. */
export const gPerLbToGPerKg = (gPerLb: number): number => gPerLb / KG_PER_LB;
export const gPerKgToGPerLb = (gPerKg: number): number => gPerKg * KG_PER_LB;

export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(totalIn / 12), inches: totalIn % 12 };
}

/** Display weight with one decimal, e.g. "180.4 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${fromKg(kg, unit).toFixed(1)} ${unit}`;
}

/** Weekly rate for display, e.g. "0.5 kg/week" or "1.1 lb/week". */
export function formatRate(kgPerWeek: number, unit: WeightUnit): string {
  return `${fromKg(kgPerWeek, unit).toFixed(1)} ${unit}/week`;
}
