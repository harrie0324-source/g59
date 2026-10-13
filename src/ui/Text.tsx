import { Text as RNText, type TextProps } from 'react-native';

import { type, useColors } from './theme';

type Variant = keyof typeof type;
type Tone = 'default' | 'secondary' | 'primary' | 'onPrimary';

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = useColors();
  const color = tone === 'secondary' ? c.textSecondary : tone === 'primary' ? c.primary : tone === 'onPrimary' ? c.onPrimary : c.text;
  // Dynamic type: allowFontScaling stays on (the default); cap extreme sizes so layouts hold.
  return <RNText maxFontSizeMultiplier={1.8} style={[type[variant], { color }, style]} {...rest} />;
}
