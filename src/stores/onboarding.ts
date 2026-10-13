import { create } from 'zustand';

import { emptyDraft, type OnboardingDraft } from '@/services/onboarding';

interface OnboardingState {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

/** In-progress onboarding answers. Nothing is saved to the database until the last step. */
export const useOnboarding = create<OnboardingState>((set) => ({
  draft: emptyDraft,
  update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: () => set({ draft: emptyDraft }),
}));
