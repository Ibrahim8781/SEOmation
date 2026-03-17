import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { BusinessProfile } from '@/types';
import { clearOnboardingState, loadOnboardingState, storeOnboardingState } from '@/utils/storage';
import { useAuthContext } from './AuthContext';

interface OnboardingContextValue {
  businessProfile: BusinessProfile | null;
  isOnboarded: boolean;
  initializing: boolean;
  saveProgress: (profile: BusinessProfile, completed?: boolean) => void;
  completeOnboarding: (profile: BusinessProfile) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const initializing = user ? resolvedUserId !== user.id : false;

  useEffect(() => {
    if (!user) {
      setBusinessProfile(null);
      setIsOnboarded(false);
      setResolvedUserId(null);
      return;
    }

    const onboardingPrefs = user.preferences?.onboarding;
    if (onboardingPrefs?.businessProfile) {
      setBusinessProfile(onboardingPrefs.businessProfile);
      setIsOnboarded(Boolean(onboardingPrefs.completed));
      storeOnboardingState(user.id, onboardingPrefs.businessProfile, Boolean(onboardingPrefs.completed));
      setResolvedUserId(user.id);
      return;
    }

    const stored = loadOnboardingState(user.id);
    setBusinessProfile(stored.profile ?? null);
    setIsOnboarded(stored.completed);
    setResolvedUserId(user.id);
  }, [user]);

  const saveProgress = useCallback(
    (profile: BusinessProfile, completed = false) => {
      if (!user) return;
      storeOnboardingState(user.id, profile, completed);
      setBusinessProfile(profile);
      setIsOnboarded(completed);
    },
    [user]
  );

  const completeOnboarding = useCallback(
    (profile: BusinessProfile) => {
      saveProgress(profile, true);
    },
    [saveProgress]
  );

  const resetOnboarding = useCallback(() => {
    if (!user) return;
    clearOnboardingState(user.id);
    setBusinessProfile(null);
    setIsOnboarded(false);
  }, [user]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      businessProfile,
      isOnboarded,
      initializing,
      saveProgress,
      completeOnboarding,
      resetOnboarding
    }),
    [businessProfile, completeOnboarding, initializing, isOnboarded, resetOnboarding, saveProgress]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }
  return ctx;
}
