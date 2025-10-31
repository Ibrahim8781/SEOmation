import type { Language, User } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export interface UpdateProfilePayload {
  name?: string;
  company?: string;
  niche?: string;
  timezone?: string;
  language?: Language;
}

export const UserAPI = {
  getCurrentUser() {
    return api.get<User>('/users/me');
  },
  updateProfile(payload: UpdateProfilePayload) {
    return api.put<User>('/users/me', payload);
  }
};
