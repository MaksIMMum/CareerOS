import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, signOut as amplifySignOut, type AuthUser } from 'aws-amplify/auth';
import { fetchMe, syncMe, type UserProfile } from '../lib/api.js';
import { captureSourceParam, getStoredSource } from '../lib/source.js';
import { isAuthConfigured } from '../lib/auth.js';
import i18n from '../i18n.js';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  onPostLogin: (selectedSource?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Capture any ?src= referral parameter on page landing
  useEffect(() => {
    captureSourceParam();
  }, []);

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
        const { profile: userProfile } = await fetchMe();
        setProfile(userProfile);
      } catch {
        // Profile not created yet or network error
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

  const onPostLogin = async (selectedSource?: string) => {
    const storedSource = getStoredSource();
    const source = selectedSource || storedSource || 'direct';
    const lang = i18n.language === 'en' ? 'en' : 'uk';

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const res = await syncMe({ source, lang });
      setProfile(res.profile);
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
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
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
