import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

// Configure native Google Sign-In (must be called before any use)
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signUpWithEmail: (email: string, fullName: string) => Promise<{ error: any }>;
  sendMagicLink: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signUpWithEmail: async () => ({ error: null }),
  sendMagicLink: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSession: async () => false,
});

// Module-level store for pending profile name (survives across the magic link flow)
let pendingProfileName: string | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialSessionChecked = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else {
      // Profile doesn't exist yet — create it
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const fullName = pendingProfileName
          || user.user_metadata.full_name
          || user.user_metadata.name
          || user.email?.split('@')[0]
          || 'Usuario';
        const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        pendingProfileName = null;
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (newProfile) setProfile(newProfile as Profile);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      initialSessionChecked.current = true;
      setIsLoading(false);
    }).catch(() => {
      initialSessionChecked.current = true;
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => { await fetchProfile(session.user.id); })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    try {
      if (Platform.OS !== 'web') {
        // Native: Google Sign-In → idToken → Supabase session. No redirects.
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken || (userInfo as any).idToken;
        if (!idToken) return { error: new Error('No ID token from Google') };

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        return { error };
      }

      // Web: Supabase OAuth redirect
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl },
      });
      if (error) return { error };
      if (!data?.url) return { error: new Error('No auth URL') };
      window.location.href = data.url;
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSession(session);
      setUser(session.user);
      await fetchProfile(session.user.id);
      return true;
    }
    return false;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
      });
    }
    return { error };
  };

  /**
   * Magic Link registration — sends OTP email for passwordless signup.
   * Stores the name so fetchProfile can create the profile after auth.
   */
  const signUpWithEmail = async (email: string, fullName: string) => {
    pendingProfileName = fullName;

    // Try signInWithOtp first (works if user already exists)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'umpi://confirm-email' },
    });

    if (error) {
      // User doesn't exist — create account first, then send OTP
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { full_name: fullName } },
      });

      if (signUpError && !signUpError.message.includes('already registered')) {
        return { error: signUpError };
      }

      // Send OTP to the newly created (unconfirmed) user
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: 'umpi://confirm-email' },
      });
      if (otpError) return { error: otpError };
    }

    return { error: null };
  };

  /**
   * Magic Link login — sends OTP email for existing users.
   */
  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'umpi://confirm-email' },
    });
    return { error };
  };

  const signOut = async () => {
    if (Platform.OS !== 'web') {
      try { await GoogleSignin.signOut(); } catch {}
    }
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signIn, signInWithGoogle, signUp, signUpWithEmail, sendMagicLink, signOut, refreshProfile, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
