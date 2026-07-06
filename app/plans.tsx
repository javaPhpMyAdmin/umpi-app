import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Crown, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';
export default function PlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from('subscription_plans').select('*').order('listing_priority');
    if (data) setPlans(data as SubscriptionPlan[]);
  };

  const defaultPlans: SubscriptionPlan[] = [
    { id: '1', name: 'Plata', slug: 'plata', price: 7000, currency: 'ARS', features: ['1 destacado', 'Visibilidad basica', '1 semana'], listing_priority: 1, created_at: '' },
    { id: '2', name: 'Oro', slug: 'oro', price: 8000, currency: 'ARS', features: ['3 destacados', 'Visibilidad media', '2 semanas', 'Badge Oro'], listing_priority: 2, created_at: '' },
    { id: '3', name: 'Premium', slug: 'premium', price: 10000, currency: 'ARS', features: ['5 destacados', 'Maxima visibilidad', '1 mes', 'Badge Premium', 'Sin publicidad'], listing_priority: 3, created_at: '' },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  const planColors = ['#C0C0C0', '#FFD700', '#FF6B35'];
  const planIcons = [Star, Crown, Zap];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planes</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Destaca tus avisos y llega a mas personas</Text>

        <View style={styles.plansRow}>
          {displayPlans.map((plan, i) => {
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
                  <TouchableOpacity style={[styles.planBtn, { backgroundColor: planColors[i] }]}>
                    <Text style={styles.planBtnText}>Elegir plan</Text>
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
});
