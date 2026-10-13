import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localDate } from '@/lib/format';

/** Today's local date. Updates when the app returns to the foreground (e.g. after midnight). */
export function useLocalToday(): string {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(localDate());
    });
    const timer = setInterval(() => setToday(localDate()), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}
