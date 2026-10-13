import { router } from 'expo-router';
import { View } from 'react-native';

import { formatRate, maxRateKgPerWeek, type GoalType } from '@/core';
import { Step } from '@/features/onboarding/Step';
import { localDate } from '@/lib/format';
import { defaultRate, parseAbout, rateOptions, weightUnitOf } from '@/services/onboarding';
import { useOnboarding } from '@/stores/onboarding';
import { Button, Card, ChoiceList, Text, space } from '@/ui';

export default function Goal() {
  const { draft, update } = useOnboarding();
  const about = parseAbout(draft, localDate());
  const weightKg = about.ok ? about.weightKg : 70;
  const pregnant = draft.pregnancyStatus !== 'none';
  const goalType = pregnant && draft.goalType === 'lose' ? null : draft.goalType;
  const paces = goalType ? rateOptions(goalType, weightKg, draft.units) : [];
  const unit = weightUnitOf(draft.units);

  const goals: { value: GoalType; label: string; description: string }[] = [
    ...(pregnant ? [] : [{ value: 'lose' as const, label: 'Lose weight', description: 'A steady, sustainable deficit.' }]),
    { value: 'maintain', label: 'Maintain', description: 'Keep your weight where it is.' },
    { value: 'gain', label: 'Gain weight', description: 'A small surplus to build muscle.' },
  ];

  const choose = (type: GoalType) => update({ goalType: type, rateKgPerWeek: defaultRate(type, weightKg, draft.units) });
  const ready = goalType === 'maintain' || (goalType !== null && draft.rateKgPerWeek !== null);

  return (
    <Step step={3} title="What's your goal?" footer={<Button title="See my plan" disabled={!ready} onPress={() => router.push('/plan')} />}>
      {pregnant ? (
        <Card tone="notice">
          <Text>Weight loss isn't offered while pregnant or breastfeeding. Your doctor can help with what's right for you.</Text>
        </Card>
      ) : null}
      <ChoiceList label="Goal" options={goals} value={goalType} onChange={choose} />
      {goalType && goalType !== 'maintain' ? (
        <View style={{ gap: space.sm }}>
          <Text variant="headline">Pace</Text>
          <ChoiceList
            label="Pace"
            options={paces.map((p) => ({ value: p.kgPerWeek, label: p.label }))}
            value={draft.rateKgPerWeek}
            onChange={(rateKgPerWeek) => update({ rateKgPerWeek })}
          />
          <Text variant="caption" tone="secondary">
            Up to {formatRate(maxRateKgPerWeek(goalType, weightKg), unit)} for you. Faster paces are harder to sustain and
            {goalType === 'lose' ? ' can cost muscle' : ' mostly add fat'}, so Burnrate doesn't offer them.
          </Text>
        </View>
      ) : null}
    </Step>
  );
}
