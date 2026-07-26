import { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';
import { validatePassword } from '@/lib/validation';
import { isDisposableEmail } from '@/lib/blockedEmails';
import BottomSheetDialog from '@/components/BottomSheetDialog';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Honeypot — bots auto-fill this, humans never see it
  const [website, setWebsite] = useState('');

  const strength = useMemo(() => validatePassword(password), [password]);

  const handleRegister = async () => {
    // Honeypot: bots auto-fill hidden fields, humans never touch them
    if (website) return;

    if (!fullName.trim() || !email.trim() || !password.trim()) return showError('Error', 'Completa todos los campos');

    if (isDisposableEmail(email)) {
      return showError('Error', 'No se permiten emails temporales. Usá tu correo real.');
    }

    if (!strength.valid) return showError('Error', 'La contraseña no cumple los requisitos de seguridad');
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) showError('Error', error.message);
    else setShowSuccess(true);
  };

  const getBarColor = (index: number) => {
    if (index >= strength.score) return Colors.border || '#E0E0E0';
    if (strength.score <= 1) return '#EF4444'; // red
    if (strength.score === 2) return '#F59E0B'; // yellow
    return '#22C55E'; // green
  };

  const getCheckColor = (passed: boolean) => passed ? '#22C55E' : Colors.textMuted;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Unite a Umpi y empeza a publicar</Text>

      <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <View style={styles.passwordRow}>
        <TextInput style={styles.passwordInput} placeholder="Contraseña" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
        </TouchableOpacity>
      </View>

      {/* Password Strength Indicator */}
      {password.length > 0 && (
        <View style={styles.strengthContainer}>
          {/* Bars */}
          <View style={styles.barsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.bar, { backgroundColor: getBarColor(i) }]} />
            ))}
          </View>
          {/* Checks */}
          {strength.checks.map((check, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={[styles.checkDot, { color: getCheckColor(check.passed) }]}>
                {check.passed ? '✓' : '○'}
              </Text>
              <Text style={[styles.checkLabel, { color: getCheckColor(check.passed) }]}>
                {check.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Honeypot — invisible to humans, bots auto-fill it */}
      <TextInput
        style={styles.honeypot}
        value={website}
        onChangeText={setWebsite}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        aria-hidden
        accessible={false}
      />

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Creando...' : 'Registrarme'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/login')}>
        <Text style={styles.link}>Ya tenes cuenta? <Text style={styles.linkBold}>Inicia sesion</Text></Text>
      </TouchableOpacity>

      <BottomSheetDialog
        visible={showSuccess}
        onClose={() => { setShowSuccess(false); router.push('/login'); }}
        icon={<CheckCircle size={28} color={Colors.success} />}
        title="Cuenta creada"
        message="Tu cuenta se creo correctamente. Ahora inicia sesion para empezar a publicar."
        primaryLabel="Iniciar sesion"
        primaryAction={() => { setShowSuccess(false); router.push('/login'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24, paddingBottom: 24 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: Colors.surface, padding: 14, borderRadius: 14, fontSize: 15, color: Colors.text, marginBottom: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 14, borderRadius: 14, marginBottom: 8 },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.text },
  strengthContainer: { marginBottom: 12 },
  honeypot: { position: 'absolute', left: -9999, opacity: 0, height: 0, width: 0 },
  barsRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  checkDot: { fontSize: 12, width: 16 },
  checkLabel: { fontSize: 12 },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: Colors.textMuted },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
