import { View } from 'react-native';

import { radius, useColors } from './theme';

/** Fills up to 100 %. Past 100 % it simply stays full: no warning colors. */
export function ProgressBar({ value, max, color, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const c = useColors();
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: radius.pill, backgroundColor: c.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color ?? c.primary }} />
    </View>
  );
}
