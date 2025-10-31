import type { AuthResponse, Language } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  company: string;
  niche: string;
  timezone: string;
  language: Language;
  role?: 'USER' | 'ADMIN';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const AuthAPI = {
  register(payload: RegisterPayload) {
    return api.post<AuthResponse>('/auth/register', payload);
  },
  login(payload: LoginPayload) {
    return api.post<AuthResponse>('/auth/login', payload);
  },
  logout(refreshToken: string) {
    return api.post<void>('/auth/logout', { refreshToken });
  }
};
