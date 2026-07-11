import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Crown, Zap } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess, showInfo } from '@/lib/toast';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('subscription_plans').select('*').order('price');
    if (data) setPlans(data as SubscriptionPlan[]);
    setIsLoading(false);
  };

  const handleSelectPlan = async (planId: string) => {
    // 3.1 Guard: user must be authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    // 3.2 Guard: user must not have an active subscription
    if (profile?.subscription_type && profile.subscription_type !== 'none') {
      showError('Ya tenés un plan activo', 'Cancelá tu plan actual antes de elegir otro');
      return;
    }

    setSelectedPlanId(planId);

    try {
      // 3.3 Call create-subscription Edge Function
      const { data: efData, error: efError } = await supabase.functions.invoke(
        'create-subscription',
        // TODO: revertir payer_email fijo antes de producción
        { body: { plan_id: planId } },
      );

      if (efError || !efData?.init_point) {
        // Extract the actual error body from the Response object (efError.context)
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
          } else if (ctx && typeof (ctx as Record<string, unknown>).text === 'text') {
            console.error('create-subscription error text:', await (ctx as Response).text());
            msg = await (ctx as Response).text();
          }
        } catch (parseErr) {
          console.error('create-subscription parse error:', parseErr);
          msg = 'Error al crear la suscripción';
        }
        showError('Error al crear la suscripción', msg);
        setSelectedPlanId(null);
        return;
      }

      // Log the init_point so it shows in Metro dev server
      console.log('MercadoPago init_point:', efData.init_point);

      // 3.4 Web fallback
      if (Platform.OS === 'web') {
        window.location.href = efData.init_point;
        return;
      }

      // 3.5 Open MP page via expo-web-browser
      const result = await WebBrowser.openAuthSessionAsync(efData.init_point);

      // 3.6 Browser closed without completing the flow
      if (result.type === 'cancel') {
        showInfo('Pago cancelado', 'Podés retomar cuando quieras desde Planes');
        setSelectedPlanId(null);
        return;
      }

      // 3.7 Check for pending status from back_url
      if (result.type === 'success' && result.url?.includes('/pending')) {
        showInfo('Pago pendiente de aprobación', 'Se activará automáticamente en unos minutos');
        setSelectedPlanId(null);
        return;
      }

      // 3.8 Poll subscription status: 3s × 5 attempts
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;

        const { data: subData } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subData?.status === 'active') {
          clearInterval(pollInterval);
          setSelectedPlanId(null);
          showSuccess('Suscripción activada', 'Ya podés destacar tus avisos');
          router.push('/(tabs)/profile');
          return;
        }

        if (attempts >= 5) {
          clearInterval(pollInterval);
          setSelectedPlanId(null);
          showError('Tiempo de espera agotado', 'La suscripción se activará en breve');
        }
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      showError('Error al crear la suscripción', msg);
      setSelectedPlanId(null);
    }
  };

  const planColors = ['#C0C0C0', '#FFD700', '#FF6B35'];
  const planIcons = [Star, Crown, Zap];

  // 3.4 Empty state for authenticated users with no plans
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
});
