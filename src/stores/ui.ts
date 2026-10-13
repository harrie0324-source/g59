import { create } from 'zustand';

export interface AddedFood {
  logId: string;
  name: string;
}

interface UiState {
  /** Day shown on the Today tab. Null = follow the real "today". */
  viewedDate: string | null;
  setViewedDate: (date: string | null) => void;
  /** Last food added from the food screens, for the "Added · Undo" banner. */
  lastAdded: AddedFood | null;
  setLastAdded: (a: AddedFood | null) => void;
}

export const useUi = create<UiState>((set) => ({
  viewedDate: null,
  setViewedDate: (viewedDate) => set({ viewedDate }),
  lastAdded: null,
  setLastAdded: (lastAdded) => set({ lastAdded }),
}));
