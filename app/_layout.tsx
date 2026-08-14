import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { SplashOverlay } from '@/components/SplashOverlay';
import LegalConsentGate from '@/components/LegalConsentGate';
import { toastConfig } from '@/lib/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // refetchOnWindowFocus: false — en mobile no aplica como en web.
      // Cada query ya tiene su staleTime y las mutations invalidan
      // lo necesario. Sin esto evitamos N refetches al volver a la app.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Syncs unread messages + realtime subscription for notification badge */
function SyncMessageNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Sync inicial (mensajes no leídos existentes antes de los triggers)
    supabase.rpc('sync_message_notifications', { p_user_id: user.id })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
      });

    // Realtime: actualizar badge al instante cuando cambia una notificación
    channelRef.current = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, queryClient]);

  return null;
}

/** Root StatusBar theme-aware (dentro del ThemeProvider). */
function RootStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SyncMessageNotifications />
            <LegalConsentGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="confirm-email" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="terms" options={{ headerShown: false }} />
                <Stack.Screen name="privacy" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </LegalConsentGate>
            <RootStatusBar />
            <Toast config={toastConfig} />
            {!splashDone && <SplashOverlay onFinish={() => setSplashDone(true)} />}
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
