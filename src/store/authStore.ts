import { create } from 'zustand';
import { Doctor } from '../types';

interface AuthState {
    user: Doctor | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setUser: (user: Doctor | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setLoading: (isLoading) => set({ isLoading }),
    logout: () => set({ user: null, isAuthenticated: false }),
}));
