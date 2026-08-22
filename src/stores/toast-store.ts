import { create } from 'zustand';

import type { ToastVariant } from '@/components/ui/toast';

type ToastState = {
  toast: { message: string; variant: ToastVariant } | null;
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, variant = 'default') => set({ toast: { message, variant } }),
  hide: () => set({ toast: null }),
}));
