import { create } from 'zustand';
import api from '../api/client';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data.data;
      
      localStorage.setItem('token', token);
      set({ user, token, isLoading: false });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Login gagal';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Register
  register: async (name, email, password, role) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        role
      });
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Registrasi gagal';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  // Verify token
  verifyToken: async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const response = await api.post('/auth/verify-token');
      set({ user: response.data.user });
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null });
      return false;
    }
  },

  // Clear error
  clearError: () => set({ error: null })
}));
