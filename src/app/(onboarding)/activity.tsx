import { router } from 'expo-router';

import type { ActivityLevel } from '@/core';
import { Step } from '@/features/onboarding/Step';
import { useOnboarding } from '@/stores/onboarding';
import { Button, ChoiceList } from '@/ui';

const LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Mostly sitting', description: 'Desk job, little planned exercise.' },
  { value: 'light', label: 'Lightly active', description: 'On your feet some of the day, or 1–3 workouts a week.' },
  { value: 'moderate', label: 'Moderately active', description: '3–5 workouts a week, or an active job.' },
  { value: 'very', label: 'Very active', description: '6–7 hard workouts a week.' },
  { value: 'extra', label: 'Extremely active', description: 'Physical job plus regular training.' },
];

export default function Activity() {
  const { draft, update } = useOnboarding();
  return (
    <Step
      step={2}
      title="How active are you?"
      subtitle="This only shapes your starting estimate. Burnrate learns your real burn from your data."
      footer={<Button title="Continue" disabled={!draft.activityLevel} onPress={() => router.push('/goal')} />}>
      <ChoiceList label="Activity level" options={LEVELS} value={draft.activityLevel} onChange={(activityLevel) => update({ activityLevel })} />
    </Step>
  );
}
