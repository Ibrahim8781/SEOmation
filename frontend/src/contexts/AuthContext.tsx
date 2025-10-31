import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { AuthResponse, AuthTokens, User } from '@/types';
import { AuthAPI, type LoginPayload, type RegisterPayload } from '@/api/auth';
import { UserAPI, type UpdateProfilePayload } from '@/api/user';
import {
  getAuthTokens,
  registerRefreshHandler,
  setAuthTokens as setClientTokens
} from '@/api/client';
import { extractErrorMessage } from '@/utils/error';
import { clearOnboardingState, loadAuthTokens, storeAuthTokens } from '@/utils/storage';

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  initializing: boolean;
  authLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistTokens(tokens: AuthTokens | null) {
  setClientTokens(tokens);
  storeAuthTokens(tokens);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const clearSession = useCallback(() => {
    persistTokens(null);
    setTokens(null);
    setUser(null);
  }, []);

  const handleAuthSuccess = useCallback((response: AuthResponse) => {
    const sessionTokens: AuthTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken
    };
    persistTokens(sessionTokens);
    setTokens(sessionTokens);
    setUser(response.user);
    return response;
  }, []);

  useEffect(() => {
    const storedTokens = loadAuthTokens();
    if (storedTokens) {
      persistTokens(storedTokens);
      setTokens(storedTokens);
    }

    const init = async () => {
      if (!storedTokens) {
        setInitializing(false);
        return;
      }
      try {
        const { data } = await UserAPI.getCurrentUser();
        setUser(data);
      } catch (error) {
        console.warn('Failed to hydrate session', extractErrorMessage(error));
        clearSession();
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [clearSession]);

  useEffect(() => {
    registerRefreshHandler((payload) => {
      if (!payload) {
        clearSession();
        return;
      }
      const updatedTokens: AuthTokens = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken
      };
      storeAuthTokens(updatedTokens);
      setClientTokens(updatedTokens);
      setTokens(updatedTokens);
      setUser(payload.user);
    });

    return () => {
      registerRefreshHandler(null);
    };
  }, [clearSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setAuthLoading(true);
      try {
        const { data } = await AuthAPI.login(payload);
        return handleAuthSuccess(data);
      } finally {
        setAuthLoading(false);
      }
    },
    [handleAuthSuccess]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setAuthLoading(true);
      try {
        const { data } = await AuthAPI.register(payload);
        return handleAuthSuccess(data);
      } finally {
        setAuthLoading(false);
      }
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(async () => {
    const currentTokens = getAuthTokens();
    try {
      if (currentTokens?.refreshToken) {
        await AuthAPI.logout(currentTokens.refreshToken);
      }
    } catch (error) {
      console.warn('Failed to call logout endpoint', extractErrorMessage(error));
    } finally {
      if (user) {
        clearOnboardingState(user.id);
      }
      clearSession();
    }
  }, [clearSession, user]);

  const refreshUser = useCallback(async () => {
    if (!tokens) return null;
    try {
      const { data } = await UserAPI.getCurrentUser();
      setUser(data);
      return data;
    } catch (error) {
      console.warn('Failed to refresh user', extractErrorMessage(error));
      clearSession();
      return null;
    }
  }, [tokens, clearSession]);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const { data } = await UserAPI.updateProfile(payload);
    setUser(data);
    return data;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      initializing,
      authLoading,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      setUser
    }),
    [authLoading, initializing, login, logout, refreshUser, register, tokens, updateProfile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
