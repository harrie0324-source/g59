import { create } from 'zustand';

interface UiState {
  /** Day shown on the Today tab. Null = follow the real "today". */
  viewedDate: string | null;
  setViewedDate: (date: string | null) => void;
}

export const useUi = create<UiState>((set) => ({
  viewedDate: null,
  setViewedDate: (viewedDate) => set({ viewedDate }),
}));
