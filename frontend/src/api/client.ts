import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, AuthTokens } from '@/types';
import { API_BASE_URL } from '@/utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

type RefreshHandler = (payload: AuthResponse | null) => void;

let tokens: AuthTokens | null = null;
let refreshHandler: RefreshHandler | null = null;
let refreshPromise: Promise<AuthTokens> | null = null;

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export function getApiClient() {
  return api;
}

export function setAuthTokens(newTokens: AuthTokens | null) {
  tokens = newTokens;
  if (newTokens?.accessToken) {
    api.defaults.headers.common.Authorization = `Bearer ${newTokens.accessToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function getAuthTokens(): AuthTokens | null {
  return tokens;
}

export function registerRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler;
}

async function performRefresh(): Promise<AuthTokens> {
  if (!tokens?.refreshToken) {
    throw new Error('Missing refresh token');
  }
  try {
    const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: tokens.refreshToken
    });
    const updatedTokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    };
    setAuthTokens(updatedTokens);
    refreshHandler?.(data);
    return updatedTokens;
  } catch (error) {
    setAuthTokens(null);
    refreshHandler?.(null);
    throw error;
  }
}

function setAuthorizationHeader(config: InternalAxiosRequestConfig, token: string) {
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }

  // Axios v1 may store headers as AxiosHeaders (with set method) or plain object.
  const headers = config.headers as any;
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.Authorization = `Bearer ${token}`;
  }
}

async function queueRefresh(): Promise<AuthTokens> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (tokens?.accessToken) {
    setAuthorizationHeader(config, tokens.accessToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const requestConfig = error.config as RetriableConfig | undefined;
    const requestUrl = requestConfig?.url ?? '';

    if (
      status === 401 &&
      tokens?.refreshToken &&
      requestConfig &&
      !requestConfig._retry &&
      !requestUrl.includes('/auth/login') &&
      !requestUrl.includes('/auth/register') &&
      !requestUrl.includes('/auth/refresh')
    ) {
      try {
        requestConfig._retry = true;
        const newTokens = await queueRefresh();
        setAuthorizationHeader(requestConfig, newTokens.accessToken);
        return api(requestConfig);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
