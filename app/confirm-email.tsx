import { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ConfirmEmailScreen — handles the Magic Link callback on mobile.
 *
 * When user taps the magic link in their email, the OS opens the app
 * via deep link (umpi://confirm-email). onAuthStateChange fires with
 * the new session. This screen waits for that, ensures the profile
 * exists, then redirects to the main tabs.
 */
export default function ConfirmEmailScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !session?.user) return;

    // Session is active — profile creation is handled by fetchProfile in AuthContext.
    // Just redirect to the main tabs.
    router.replace('/(tabs)');
  }, [session, isLoading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={styles.title}>Verificando tu email...</Text>
      <Text style={styles.subtitle}>Un momento mientras confirmamos tu cuenta.</Text>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: c.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
