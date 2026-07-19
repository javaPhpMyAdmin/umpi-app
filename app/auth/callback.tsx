import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    let cancelled = false;
    const goHome = () => { if (!cancelled) router.replace('/(tabs)'); };

    const handleUrl = async (url: string) => {
      // PKCE: ?code=xxx
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1])).catch(() => {});
        if (!cancelled) goHome();
        return;
      }
      // Implicit: #access_token=xxx
      const fragment = url.split('#')[1];
      if (fragment) {
        const fp: Record<string, string> = {};
        fragment.split('&').forEach(p => { const [k, v] = p.split('='); if (k && v) fp[k] = decodeURIComponent(v); });
        if (fp.access_token) {
          await supabase.auth.setSession({
            access_token: fp.access_token,
            refresh_token: fp.refresh_token || '',
          }).catch(() => {});
        }
      }
      if (!cancelled) goHome();
    };

    // Caso 1: code en query params de Expo Router
    if (params.code) {
      handleUrl('?code=' + params.code);
      return;
    }

    // Caso 2: intentar obtener URL completa (con fragment)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
      else {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && !cancelled) goHome();
          else {
            const t = setTimeout(goHome, 1500);
            cancelled ? clearTimeout(t) : null;
          }
        });
      }
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') goHome();
    });

    const t = setTimeout(goHome, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});
