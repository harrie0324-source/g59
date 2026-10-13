import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { radius, space, useColors } from './theme';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

/** Vertical list of large radio cards. */
export function ChoiceList<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space.sm }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.description ? `${o.label}. ${o.description}` : o.label}
            onPress={() => onChange(o.value)}
            style={{
              padding: space.lg,
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: selected ? c.primarySoft : c.surface,
              gap: 2,
            }}>
            <Text variant="headline">{o.label}</Text>
            {o.description ? (
              <Text variant="caption" tone="secondary">
                {o.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact horizontal segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{
              flexGrow: 1,
              minHeight: 40,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.surface : 'transparent',
            }}>
            <Text variant="label" tone={selected ? 'default' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
