// Design tokens. Calm, premium, neutral. There's no red anywhere: being above a target
// is shown in neutral tones, never as an error.
import { useColorScheme } from 'react-native';

export const palette = {
  light: {
    background: '#F6F7F5',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF1EF',
    border: '#DDE3E0',
    text: '#111816',
    textSecondary: '#56615E',
    primary: '#2F7F7A',
    onPrimary: '#FFFFFF',
    primarySoft: '#DCEEEC',
    protein: '#2F7F7A',
    carbs: '#A87521',
    fat: '#5F64AD',
    track: '#E3E8E6',
    notice: '#F3EEDF',
  },
  dark: {
    background: '#0F1413',
    surface: '#172020',
    surfaceAlt: '#1F2928',
    border: '#2A3634',
    text: '#EEF3F1',
    textSecondary: '#9AA7A3',
    primary: '#5FB3AC',
    onPrimary: '#062320',
    primarySoft: '#1D3634',
    protein: '#5FB3AC',
    carbs: '#D9A54A',
    fat: '#9196D8',
    track: '#26302F',
    notice: '#2A2718',
  },
} as const;

export type Colors = { [K in keyof (typeof palette)['light']]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  display: { fontSize: 40, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
