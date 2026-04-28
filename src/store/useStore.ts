import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  role: 'admin' | 'agent' | null;
  setUser: (user: User | null) => void;
  setRole: (role: 'admin' | 'agent' | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  role: null,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
}));
