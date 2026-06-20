import { create } from 'zustand';
import { saveItem, getItem, removeItem } from '../utils/storage';

interface User {
  id: string;
  email: string;
  username: string;
  tier: 'FREE' | 'PRO' | 'LIFETIME';
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: async (token: string, user: User) => {
    try {
      await saveItem('jwt_token', token);
      await saveItem('user_data', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    } catch (error) {
      console.error('Error saving auth state', error);
    }
  },

  logout: async () => {
    try {
      await removeItem('jwt_token');
      await removeItem('user_data');
      set({ token: null, user: null, isAuthenticated: false });
    } catch (error) {
      console.error('Error clearing auth state', error);
    }
  },

  initializeAuth: async () => {
    try {
      const token = await getItem('jwt_token');
      const userData = await getItem('user_data');
      if (token && userData) {
        set({ token, user: JSON.parse(userData), isAuthenticated: true });
      } else {
        set({ token: null, user: null, isAuthenticated: false });
      }
    } catch (error) {
      set({ token: null, user: null, isAuthenticated: false });
    }
  },
}));
