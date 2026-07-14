import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Crown } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showInfo } from '@/lib/toast';

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
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price');
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
      // TODO: revertir payer_email fijo antes de producción
      const testBuyerEmail = 'test_user_906191175949745667@testuser.com';
      // MP requires http/https URLs for back_url — use a valid-looking URL
      // openAuthSessionAsync will intercept the redirect regardless of whether the URL exists
      const redirectUrl = Linking.createURL('subscription/result');
      const mpBackUrl = Platform.OS === 'web'
        ? redirectUrl
        : 'https://umpi.app/subscription/result';
      const { data: efData, error: efError } = await supabase.functions.invoke(
        'create-subscription',
        {
          body: {
            plan_id: planId,
            payer_email: testBuyerEmail,
            back_url: mpBackUrl,
          },
        },
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

      // 3.4 Show link directly in a dismissible toast
      if (Platform.OS === 'web') {
        window.location.href = efData.init_point;
        return;
      }

      console.warn('\n══════════════════════════════════════════');
      console.warn('🔗 LINK DE PAGO — copialo y abrilo en incógnito:');
      console.warn(efData.init_point);
      console.warn('📋 PREAPPROVAL_ID:', efData.preapproval_id);
      console.warn('══════════════════════════════════════════\n');

      showInfo('Link generado', 'Revisá la terminal, copiá el link y abrilo en incógnito');

      // 3.6 Reset loading state
      setSelectedPlanId(null);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      showError('Error al crear la suscripción', msg);
      setSelectedPlanId(null);
    }
  };

  const planColors = ['#C0C0C0', '#FFD700'];
  const planIcons = [Star, Crown];

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
