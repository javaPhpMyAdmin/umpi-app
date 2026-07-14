import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle, ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function SubscriptionResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.icon}>
        <CheckCircle size={64} color="#22C55E" />
      </View>
      <Text style={styles.title}>¡Suscripción exitosa!</Text>
      <Text style={styles.subtitle}>
        Tu plan ya está activo. Ya podés destacar tus avisos.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/')}
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
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
