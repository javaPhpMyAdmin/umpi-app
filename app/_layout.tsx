import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SplashOverlay } from '@/components/SplashOverlay';
import { toastConfig } from '@/lib/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minuto antes de considerar datos viejos
      refetchOnWindowFocus: true, // refetch al volver al tab
      retry: 1,
    },
  },
});

/** Syncs unread messages as notifications when user authenticates */
function SyncMessageNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('sync_message_notifications', { p_user_id: user.id });
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SyncMessageNotifications />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="dark" />
          <Toast config={toastConfig} />
          {!splashDone && <SplashOverlay onFinish={() => setSplashDone(true)} />}
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
