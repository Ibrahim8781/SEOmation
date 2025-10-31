import type { AuthTokens, BusinessProfile } from '@/types';

const AUTH_KEY = 'seomation:auth';
const ONBOARDING_KEY = 'seomation:onboarding';

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export function loadAuthTokens(): AuthTokens | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthTokens;
  } catch (error) {
    console.error('Failed to load auth tokens', error);
    return null;
  }
}

export function storeAuthTokens(tokens: AuthTokens | null): void {
  if (!hasWindow()) return;
  try {
    if (!tokens) {
      window.localStorage.removeItem(AUTH_KEY);
    } else {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
    }
  } catch (error) {
    console.error('Failed to persist auth tokens', error);
  }
}

type OnboardingMap = Record<
  string,
  {
    profile?: BusinessProfile;
    completed: boolean;
  }
>;

function readOnboardingMap(): OnboardingMap {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OnboardingMap;
  } catch (error) {
    console.error('Failed to parse onboarding storage', error);
    return {};
  }
}

function writeOnboardingMap(map: OnboardingMap): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(map));
  } catch (error) {
    console.error('Failed to persist onboarding storage', error);
  }
}

export function loadOnboardingState(userId: string): { completed: boolean; profile?: BusinessProfile } {
  const map = readOnboardingMap();
  return map[userId] ?? { completed: false };
}

export function storeOnboardingState(userId: string, profile: BusinessProfile, completed = true): void {
  const map = readOnboardingMap();
  map[userId] = { profile, completed };
  writeOnboardingMap(map);
}

export function clearOnboardingState(userId: string): void {
  const map = readOnboardingMap();
  if (map[userId]) {
    delete map[userId];
    writeOnboardingMap(map);
  }
}
