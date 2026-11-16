import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut, type AuthUser } from 'aws-amplify/auth';
import { ApiError, fetchMe, syncMe, type UserProfile } from '../lib/api.js';
import {
  captureSourceParam,
  clearStoredSource,
  getSourceAnswer,
  getStoredSource,
} from '../lib/source.js';
import { isAuthConfigured } from '../lib/auth.js';
import i18n from '../i18n.js';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  onPostLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Capture any ?src= referral parameter on page landing
  useEffect(() => {
    captureSourceParam();
  }, []);

  // Creates the profile on the first call (POST /me is idempotent), sending the ?src= tag and
  // the sign-up answer stored in this browser; clears them once the backend has the profile.
  const createOrLoadProfile = async (): Promise<UserProfile> => {
    const res = await syncMe({
      source: getSourceAnswer() ?? undefined,
      src: getStoredSource() ?? undefined,
      lang: i18n.language === 'en' ? 'en' : 'uk',
    });
    clearStoredSource();
    return res.profile;
  };

  const refreshUser = async () => {
    if (!isAuthConfigured) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      try {
        const session = await fetchAuthSession();
        const rawGroups = (session.tokens?.idToken?.payload as any)?.['cognito:groups'];
        const isUserAdmin = Array.isArray(rawGroups)
          ? rawGroups.includes('admins')
          : typeof rawGroups === 'string'
            ? rawGroups.split(',').map((g: string) => g.trim()).includes('admins')
            : false;
        setIsAdmin(isUserAdmin);
      } catch {
        setIsAdmin(false);
      }

      try {
        const { profile: userProfile } = await fetchMe();
        setProfile(userProfile);
      } catch (err) {
        // Signed in, but the profile was never created (e.g. POST /me failed after sign-in).
        if (err instanceof ApiError && err.status === 404) {
          try {
            setProfile(await createOrLoadProfile());
          } catch (syncErr) {
            console.error('Failed to create profile', syncErr);
          }
        }
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const onPostLogin = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setProfile(await createOrLoadProfile());
    } catch (err) {
      console.error('Failed to sync profile after login', err);
    }
  };

  const signOut = async () => {
    try {
      if (isAuthConfigured) {
        await amplifySignOut();
      }
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isLoading,
        isConfigured: isAuthConfigured,
        refreshUser,
        signOut,
        onPostLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
