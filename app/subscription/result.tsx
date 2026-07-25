import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

type SyncState = 'syncing' | 'success' | 'error';

export default function SubscriptionResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ preapproval_id?: string; status?: string }>();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SyncState>('syncing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!params.preapproval_id) {
      setState('error');
      setErrorMsg('No se encontró el identificador de la suscripción.');
      return;
    }

    const sync = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sync-subscription');
        if (error) {
          console.error('[subscription-result] sync error:', error);
          // Still try to invalidate so UI refreshes on next load
          queryClient.invalidateQueries({ queryKey: ['auth'] });
          setState('error');
          setErrorMsg('No se pudo sincronizar automáticamente. Probá recargar la app.');
          return;
        }

        console.log('[subscription-result] sync result:', JSON.stringify(data));
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        setState('success');
      } catch (err) {
        console.error('[subscription-result] unexpected error:', err);
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        setState('error');
        setErrorMsg('Error inesperado al sincronizar.');
      }
    };

    sync();
  }, [params.preapproval_id, queryClient]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.icon}>
        {state === 'syncing' && <ActivityIndicator size="large" color={Colors.primary} />}
        {state === 'success' && <CheckCircle size={64} color="#22C55E" />}
        {state === 'error' && <AlertCircle size={64} color={Colors.error} />}
      </View>

      {state === 'syncing' && (
        <>
          <Text style={styles.title}>Sincronizando tu suscripción...</Text>
          <Text style={styles.subtitle}>Un momento, estamos verificando tu pago.</Text>
        </>
      )}
      {state === 'success' && (
        <>
          <Text style={styles.title}>¡Suscripción exitosa!</Text>
          <Text style={styles.subtitle}>
            Tu plan ya está activo. Ya podés destacar tus avisos.
          </Text>
        </>
      )}
      {state === 'error' && (
        <>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.btn, state === 'syncing' && styles.btnDisabled]}
        onPress={() => router.replace('/')}
        disabled={state === 'syncing'}
      >
        <ArrowLeft size={18} color={Colors.white} />
        <Text style={styles.btnText}>Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
