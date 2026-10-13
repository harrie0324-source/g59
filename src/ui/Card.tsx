import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { radius, space, useColors } from './theme';

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: ViewStyle; tone?: 'surface' | 'notice' | 'soft' }) {
  const c = useColors();
  const bg = tone === 'notice' ? c.notice : tone === 'soft' ? c.primarySoft : c.surface;
  return (
    <View style={[{ backgroundColor: bg, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: tone === 'surface' ? 1 : 0, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}
