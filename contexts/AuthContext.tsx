import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  getAuthDebug: () => string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSession: async () => false,
  getAuthDebug: () => '',
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authDebugRef = useRef<string[]>([]);
  const logAuthDebug = (msg: string) => {
    authDebugRef.current.push(new Date().toLocaleTimeString() + ' ' + msg);
    console.log('[AuthDebug]', msg);
  };
  const getAuthDebug = () => authDebugRef.current.join('\n');

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else {
      // No hay perfil aún → crearlo desde metadata del provider (Google, etc.)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const fullName = user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'Usuario';
        const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
        });
        // refrescar
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
    const isWeb = Platform.OS === 'web';
    const redirectUrl = isWeb ? `${window.location.origin}/` : Linking.createURL('auth/callback');
    logAuthDebug('1. redirectTo: ' + redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
    if (error) {
      logAuthDebug('2. ✗ signInWithOAuth error: ' + error.message);
      return { error };
    }
    logAuthDebug('2. ✓ Got auth URL: ' + (data?.url?.substring(0, 60) + '...'));

    if (!data?.url) {
      logAuthDebug('3. ✗ No auth URL returned');
      return { error: new Error('No auth URL') };
    }

    if (isWeb) {
      window.location.href = data.url;
      return { error: null };
    }

    logAuthDebug('3. ▶ Opening openAuthSessionAsync...');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    logAuthDebug('4. ◀ Result type: ' + result.type + ', hasUrl: ' + !!result.url);

    if (result.type === 'success' && result.url) {
      logAuthDebug('5. URL: ' + result.url.substring(0, 120));

      // Intento 1: PKCE flow — code en query string (?code=xxx)
      const codeMatch = result.url.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        logAuthDebug('6. ✓ PKCE code found in query string');
        try {
          await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
          logAuthDebug('7. ✓ exchangeCodeForSession OK');
        } catch (e) {
          logAuthDebug('7. ✗ exchangeCodeForSession error: ' + (e instanceof Error ? e.message : String(e)));
        }
      } else {
        logAuthDebug('6. ✗ No PKCE code — checking implicit flow (fragment)...');
        // Intento 2: Implicit flow — tokens en el fragmento (#access_token=xxx&refresh_token=yyy)
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const fragmentParams: Record<string, string> = {};
          fragment.split('&').forEach(pair => {
            const [k, v] = pair.split('=');
            if (k && v) fragmentParams[k] = decodeURIComponent(v);
          });
          logAuthDebug('7. Fragment keys: ' + Object.keys(fragmentParams).join(', '));
          if (fragmentParams.access_token) {
            logAuthDebug('8. ✓ access_token found in fragment, calling setSession...');
            try {
              await supabase.auth.setSession({
                access_token: fragmentParams.access_token,
                refresh_token: fragmentParams.refresh_token || '',
              });
              logAuthDebug('9. ✓ setSession OK');
            } catch (e) {
              logAuthDebug('9. ✗ setSession error: ' + (e instanceof Error ? e.message : String(e)));
            }
          } else {
            logAuthDebug('8. ✗ No access_token in fragment either');
          }
        } else {
          logAuthDebug('7. ✗ No fragment in URL');
        }
      }
    } else {
      logAuthDebug('5. ✗ No success URL — browser likely cancelled/dismissed');
    }

    // Verificar sesión después
    await new Promise(r => setTimeout(r, 500));
    const { data: { session: s } } = await supabase.auth.getSession();
    logAuthDebug('8. getSession post-flow: ' + (s ? s.user?.email : 'null'));
    const { data: { user: u } } = await supabase.auth.getUser();
    logAuthDebug('9. getUser post-flow: ' + (u ? u.email : 'null'));

    return { error: null };
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signIn, signInWithGoogle, signUp, signOut, refreshProfile, refreshSession, getAuthDebug }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
