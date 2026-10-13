import { router } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { Step } from '@/features/onboarding/Step';
import { formatKcal, localDate } from '@/lib/format';
import { buildPlan, completeOnboarding, planSummary } from '@/services/onboarding';
import { useOnboarding } from '@/stores/onboarding';
import { Button, Card, Text, space, useColors } from '@/ui';

export default function Plan() {
  const { draft, reset } = useOnboarding();
  const c = useColors();
  const today = localDate();
  const plan = buildPlan(draft, today);

  if (!plan) {
    return (
      <Step step={4} title="Almost there" footer={<Button title="Go back" onPress={() => router.back()} />}>
        <Text>A few answers are missing. Go back to finish them.</Text>
      </Step>
    );
  }

  const { sentence, notes } = planSummary(plan, draft.units);
  const t = plan.preview.targets;

  return (
    <Step
      step={4}
      title="Your starting plan"
      footer={
        <Button
          title="Start logging"
          onPress={() => {
            completeOnboarding(db, plan, today);
            reset();
            router.replace('/');
          }}
        />
      }>
      {t ? (
        <Card>
          <Text variant="label" tone="secondary">
            Daily target
          </Text>
          <Text variant="display" accessibilityLabel={`${formatKcal(t.calories)} calories a day`}>
            {formatKcal(t.calories)}
            <Text variant="headline" tone="secondary">
              {' '}kcal
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            {[
              ['Protein', t.proteinG, c.protein],
              ['Carbs', t.carbsG, c.carbs],
              ['Fat', t.fatG, c.fat],
            ].map(([label, g, color]) => (
              <View key={label as string} style={{ gap: 2 }}>
                <Text variant="headline" style={{ color: color as string }}>
                  {g as number} g
                </Text>
                <Text variant="caption" tone="secondary">
                  {label as string}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Text>{sentence}</Text>
      {notes.map((n) => (
        <Card key={n} tone="notice">
          <Text>{n}</Text>
        </Card>
      ))}
      <Card tone="soft">
        <Text variant="headline">Still learning</Text>
        <Text>
          Mark days as "fully logged" when you've logged everything, and weigh in when you can. After about 2–3 weeks,
          Burnrate switches from the formula to your real data.
        </Text>
      </Card>
      <Text variant="caption" tone="secondary">
        Estimates only. Not medical advice.
      </Text>
    </Step>
  );
}
