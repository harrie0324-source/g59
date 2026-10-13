import { router } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/stores/onboarding';
import { Button, Card, Screen, Text, space } from '@/ui';

const POINTS = [
  'Log what you eat and weigh in when you can.',
  'Burnrate smooths out daily weight swings to find your trend.',
  'Every week it learns how much you really burn and adjusts your targets.',
];

export default function Welcome() {
  const update = useOnboarding((s) => s.update);
  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <Button
          title="I understand, let's start"
          onPress={() => {
            update({ disclaimerAccepted: true });
            router.push('/about');
          }}
        />
      }>
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Text variant="display" tone="primary" accessibilityRole="header">
          Burnrate
        </Text>
        <Text variant="headline">Targets based on your real burn rate, not a guess.</Text>
      </View>
      <View style={{ gap: space.md }}>
        {POINTS.map((p, i) => (
          <View key={p} style={{ flexDirection: 'row', gap: space.md }}>
            <Text variant="headline" tone="primary">
              {i + 1}
            </Text>
            <Text style={{ flex: 1 }}>{p}</Text>
          </View>
        ))}
      </View>
      <Card tone="notice">
        <Text variant="headline">Not medical advice</Text>
        <Text>
          Burnrate gives general estimates for healthy adults. It isn't a diagnosis or treatment plan. If you have a
          medical condition, are pregnant or breastfeeding, or have a history of disordered eating, please talk with a
          doctor or registered dietitian first.
        </Text>
      </Card>
    </Screen>
  );
}
