import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { formatKcal } from '@/lib/format';
import { Text, radius, space, useColors } from '@/ui';

/** One food in a list: tap opens details, "+" logs the default serving in one tap. */
export function FoodRow({
  name,
  subtitle,
  kcal,
  hideCalories,
  onPress,
  onQuickAdd,
}: {
  name: string;
  subtitle?: string | null;
  kcal: number;
  hideCalories: boolean;
  onPress: () => void;
  onQuickAdd?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}${hideCalories ? '' : `, ${formatKcal(kcal)} calories`}`}
        accessibilityHint="Opens serving options"
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Text numberOfLines={2}>{name}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[subtitle, hideCalories ? null : `${formatKcal(kcal)} kcal`].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
      {onQuickAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${name}${subtitle ? `, ${subtitle}` : ''}`}
          onPress={onQuickAdd}
          hitSlop={8}
          style={({ pressed }) => ({ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="add-circle" size={30} color={c.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
