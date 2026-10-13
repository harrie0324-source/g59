import { Switch, View } from 'react-native';

import { Text } from './Text';
import { space, useColors } from './theme';

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={description}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.primary, false: c.track }}
      />
    </View>
  );
}
