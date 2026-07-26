import { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

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
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !session?.user) return;

    // Session is active — profile creation is handled by fetchProfile in AuthContext.
    // Just redirect to the main tabs.
    router.replace('/(tabs)');
  }, [session, isLoading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.title}>Verificando tu email...</Text>
      <Text style={styles.subtitle}>Un momento mientras confirmamos tu cuenta.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
