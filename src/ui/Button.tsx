import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Text } from './Text';
import { radius, space, useColors } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  compact,
  accessibilityLabel,
  ...rest
}: PressableProps & { title: string; variant?: Variant; loading?: boolean; compact?: boolean }) {
  const c = useColors();
  const isDisabled = disabled || loading;
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.primarySoft : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      hitSlop={compact ? 8 : 0}
      style={({ pressed }) => ({
        minHeight: compact ? 36 : 50,
        paddingHorizontal: compact ? space.md : space.xl,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
      })}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.onPrimary : c.primary} />
      ) : (
        <Text variant={compact ? 'label' : 'headline'} tone={variant === 'primary' ? 'onPrimary' : 'primary'}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
