import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, Linking, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Crown, ExternalLink, RefreshCw, Copy } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showInfo, showSuccess } from '@/lib/toast';
import * as Clipboard from 'expo-clipboard';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price');
    if (data) setPlans(data as SubscriptionPlan[]);
    setIsLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-subscription');
      if (error) {
        showError('Error', 'No se pudo sincronizar. Verificá que hayas completado el pago.');
      } else {
        showSuccess('¡Listo!', 'Tu suscripción fue sincronizada');
        setPaymentLink(null);
        router.replace('/');
      }
    } catch {
      showError('Error', 'No se pudo sincronizar.');
    }
    setSyncing(false);
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (profile?.subscription_type && profile.subscription_type !== 'none') {
      showError('Ya tenés un plan activo', 'Cancelá tu plan actual antes de elegir otro');
      return;
    }

    setSelectedPlanId(planId);

    try {
      const mpBackUrl = 'https://fvlbxnixrutffgjrohvm.supabase.co/functions/v1/subscription-result';
      const { data: efData, error: efError } = await supabase.functions.invoke(
        'create-subscription',
        {
          body: {
            plan_id: planId,
            payer_email: 'test_user_906191175949745667@testuser.com',
            back_url: mpBackUrl,
          },
        },
      );

      if (efError || !efData?.init_point) {
        let msg = 'Error inesperado al crear la suscripción';
        try {
          const ctx = (efError as Record<string, unknown>)?.context;
          if (ctx && typeof (ctx as Record<string, unknown>).json === 'function') {
            const errorBody = await (ctx as Response).json();
            console.error('create-subscription error body:', JSON.stringify(errorBody, null, 2));
            msg = errorBody?.error ?? JSON.stringify(errorBody);
            if (errorBody?.details) {
              msg += ` — ${JSON.stringify(errorBody.details)}`;
            }
          }
        } catch (parseErr) {
          console.error('create-subscription parse error:', parseErr);
        }
        showError('Error al crear la suscripción', msg);
        setSelectedPlanId(null);
        return;
      }

      if (Platform.OS === 'web') {
        window.location.href = efData.init_point;
        return;
      }

      // Native: show modal with link + try to open
      setPaymentLink(efData.init_point);
      setSelectedPlanId(null);

      // Try to open in browser
      try {
        await Linking.openURL(efData.init_point);
      } catch {
        // If can't open, user copies from modal
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      showError('Error al crear la suscripción', msg);
      setSelectedPlanId(null);
    }
  };

  const planColors = ['#C0C0C0', '#FFD700'];
  const planIcons = [Star, Crown];

  if (!isLoading && plans.length === 0 && user) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planes</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay planes disponibles</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planes</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Destaca tus avisos y llega a mas personas</Text>

        <View style={styles.plansRow}>
          {plans.map((plan, i) => {
            const Icon = planIcons[i] || Star;
            return (
              <View key={plan.id} style={[styles.planCard, { borderColor: planColors[i] }]}>
                <View style={[styles.planHeader, { backgroundColor: planColors[i] }]}>
                  <Icon size={24} color={Colors.white} />
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                <View style={styles.planBody}>
                  <Text style={styles.planPrice}>
                    ${plan.price.toLocaleString('es-AR')}
                    <Text style={styles.planPeriod}> /mes</Text>
                  </Text>
                  <View style={styles.features}>
                    {plan.features.map((f, fi) => (
                      <View key={fi} style={styles.featureRow}>
                        <Check size={14} color={Colors.secondary} />
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.planBtn, { backgroundColor: planColors[i] }]}
                    onPress={() => handleSelectPlan(plan.id)}
                    disabled={selectedPlanId === plan.id}
                  >
                    <Text style={styles.planBtnText}>
                      {selectedPlanId === plan.id ? 'Procesando...' : 'Elegir plan'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Payment link modal */}
      <Modal visible={!!paymentLink} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Link de pago generado</Text>
            <Text style={styles.modalSubtitle}>
              Abrilo en tu navegador para completar el pago. Después volvé acá para sincronizar.
            </Text>

            <TouchableOpacity
              style={styles.modalOpenBtn}
              onPress={() => paymentLink && Linking.openURL(paymentLink)}
            >
              <ExternalLink size={16} color={Colors.white} />
              <Text style={styles.modalOpenBtnText}>Abrir en navegador</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCopyBtn}
              onPress={() => {
                if (paymentLink) {
                  Clipboard.setStringAsync(paymentLink);
                  showInfo('Copiado', 'Link copiado al portapapeles');
                }
              }}
            >
              <Copy size={16} color={Colors.primary} />
              <Text style={styles.modalCopyBtnText}>Copiar link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSyncBtn}
              onPress={handleSync}
              disabled={syncing}
            >
              <RefreshCw size={16} color={Colors.primary} />
              <Text style={styles.modalSyncBtnText}>
                {syncing ? 'Sincronizando...' : 'Ya pagué, sincronizar'}
              </Text>
            </TouchableOpacity>

            <Pressable style={styles.modalCloseBtn} onPress={() => setPaymentLink(null)}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  scroll: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 15, color: Colors.textSecondary, marginBottom: 20 },
  plansRow: { gap: 12 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 2 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  planName: { fontSize: 18, fontWeight: '800', color: Colors.white },
  planBody: { padding: 16 },
  planPrice: { fontSize: 28, fontWeight: '800', color: Colors.text },
  planPeriod: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  features: { marginTop: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: Colors.text },
  planBtn: { marginTop: 20, padding: 14, borderRadius: 14, alignItems: 'center' },
  planBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyStateText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalOpenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, width: '100%', justifyContent: 'center', marginBottom: 12,
  },
  modalOpenBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  modalCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, width: '100%', justifyContent: 'center', marginBottom: 12,
  },
  modalCopyBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  modalSyncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, width: '100%', justifyContent: 'center', marginBottom: 12,
  },
  modalSyncBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  modalCloseBtn: { paddingVertical: 8 },
  modalCloseBtnText: { color: Colors.textMuted, fontSize: 14 },
});
