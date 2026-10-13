import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { radius, space, type, useColors } from './theme';

export const Field = forwardRef<TextInput, TextInputProps & { label: string; unit?: string; error?: string; flex?: number }>(
  function Field({ label, unit, error, flex, style, ...rest }, ref) {
    const c = useColors();
    return (
      <View style={{ gap: space.xs, flex }}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? c.text : c.border,
            paddingHorizontal: space.md,
          }}>
          <TextInput
            ref={ref}
            accessibilityLabel={unit ? `${label} in ${unit}` : label}
            placeholderTextColor={c.textSecondary}
            style={[type.body, { flex: 1, minHeight: 48, color: c.text }, style]}
            {...rest}
          />
          {unit ? (
            <Text tone="secondary" importantForAccessibility="no">
              {unit}
            </Text>
          ) : null}
        </View>
        {error ? (
          <Text variant="caption" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);
