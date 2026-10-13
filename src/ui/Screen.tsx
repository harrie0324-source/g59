import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useColors } from './theme';

/** Scrollable page with safe areas, keyboard avoidance and an optional pinned footer. */
export function Screen({
  children,
  footer,
  edges = ['bottom'],
}: {
  children: ReactNode;
  footer?: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const c = useColors();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {children}
        </ScrollView>
        {footer ? <View style={{ padding: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
