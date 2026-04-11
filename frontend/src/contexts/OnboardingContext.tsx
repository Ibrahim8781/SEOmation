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
import type { OnboardingFormValues } from '@/validation/onboardingSchema';
import { clearOnboardingState, loadOnboardingState, storeOnboardingState } from '@/utils/storage';
import { useAuthContext } from './AuthContext';

const ONBOARDING_DRAFT_KEY = 'seomation:onboarding-draft';

interface OnboardingContextValue {
  businessProfile: BusinessProfile | null;
  onboardingDraft: OnboardingFormValues | null;
  isOnboarded: boolean;
  initializing: boolean;
  saveProgress: (profile: BusinessProfile, completed?: boolean) => void;
  completeOnboarding: (profile: BusinessProfile) => void;
  resetOnboarding: () => void;
  setOnboardingDraft: (values: OnboardingFormValues) => void;
  clearOnboardingDraft: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [onboardingDraft, setOnboardingDraftState] = useState<OnboardingFormValues | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const initializing = user ? resolvedUserId !== user.id : false;

  useEffect(() => {
    if (!user) {
      setBusinessProfile(null);
      setOnboardingDraftState(null);
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

    if (typeof window === 'undefined') {
      setOnboardingDraftState(null);
      return;
    }

    try {
      const rawDraft = window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!rawDraft) {
        setOnboardingDraftState(null);
        return;
      }
      const draftMap = JSON.parse(rawDraft) as Record<string, OnboardingFormValues>;
      setOnboardingDraftState(draftMap[user.id] ?? null);
    } catch (error) {
      console.warn('Failed to read onboarding draft from sessionStorage', error);
      setOnboardingDraftState(null);
    }
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
      if (user) {
        if (typeof window === 'undefined') {
          setOnboardingDraftState(null);
          return;
        }
        try {
          const rawDraft = window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
          if (!rawDraft) {
            setOnboardingDraftState(null);
            return;
          }
          const draftMap = JSON.parse(rawDraft) as Record<string, OnboardingFormValues>;
          delete draftMap[user.id];
          window.sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draftMap));
          setOnboardingDraftState(null);
        } catch (error) {
          console.warn('Failed to clear onboarding draft from sessionStorage', error);
        }
      }
    },
    [saveProgress, user]
  );

  const resetOnboarding = useCallback(() => {
    if (!user) return;
    clearOnboardingState(user.id);
    setBusinessProfile(null);
    setIsOnboarded(false);
  }, [user]);

  const setOnboardingDraft = useCallback(
    (values: OnboardingFormValues) => {
      if (!user) return;
      if (typeof window === 'undefined') return;
      try {
        const rawDraft = window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
        const draftMap = rawDraft
          ? (JSON.parse(rawDraft) as Record<string, OnboardingFormValues>)
          : {};
        draftMap[user.id] = values;
        window.sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draftMap));
      } catch (error) {
        console.warn('Failed to persist onboarding draft to sessionStorage', error);
      }
    },
    [user]
  );

  const clearOnboardingDraft = useCallback(() => {
    if (!user) return;
    if (typeof window === 'undefined') {
      setOnboardingDraftState(null);
      return;
    }
    try {
      const rawDraft = window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!rawDraft) {
        setOnboardingDraftState(null);
        return;
      }
      const draftMap = JSON.parse(rawDraft) as Record<string, OnboardingFormValues>;
      delete draftMap[user.id];
      window.sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draftMap));
      setOnboardingDraftState(null);
    } catch (error) {
      console.warn('Failed to clear onboarding draft from sessionStorage', error);
    }
  }, [user]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      businessProfile,
      onboardingDraft,
      isOnboarded,
      initializing,
      saveProgress,
      completeOnboarding,
      resetOnboarding,
      setOnboardingDraft,
      clearOnboardingDraft
    }),
    [
      businessProfile,
      onboardingDraft,
      completeOnboarding,
      clearOnboardingDraft,
      initializing,
      isOnboarded,
      resetOnboarding,
      saveProgress,
      setOnboardingDraft
    ]
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
