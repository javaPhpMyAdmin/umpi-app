import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Crown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { isInTrial, getTrialDaysLeft } from '@/lib/subscription';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

        {/* Trial Banner */}
        {isInTrial(profile) && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerTitle}>Estás en periodo de prueba</Text>
            <Text style={styles.trialBannerText}>
              Te quedan {getTrialDaysLeft(profile)} días de premium gratis
            </Text>
          </View>
        )}

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
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.infoText}>
          La suscripción a los planes se realiza a través de la página web umpi.com.ar.
        </Text>
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
  trialBanner: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 14, padding: 16, marginBottom: 20 },
  trialBannerTitle: { fontSize: 15, fontWeight: '700', color: '#166534', marginBottom: 4 },
  trialBannerText: { fontSize: 13, color: '#15803D' },
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
  infoText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, marginTop: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyStateText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' },
});
