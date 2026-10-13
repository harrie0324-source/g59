import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen, Text, space } from '@/ui';

export const TOTAL_STEPS = 4;

export function Step({ step, title, subtitle, children, footer }: { step: number; title: string; subtitle?: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Screen footer={footer}>
      <View style={{ gap: space.sm }}>
        <Text variant="caption" tone="secondary" accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}>
          {step} / {TOTAL_STEPS}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}
