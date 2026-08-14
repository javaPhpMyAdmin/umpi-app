import { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';
import { isDisposableEmail } from '@/lib/blockedEmails';
import BottomSheetDialog from '@/components/BottomSheetDialog';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { signUpWithEmail } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Honeypot — bots auto-fill this, humans never see it
  const [website, setWebsite] = useState('');

  const handleRegister = async () => {
    // Honeypot: bots auto-fill hidden fields, humans never touch them
    if (website) return;

    if (!fullName.trim() || !email.trim()) return showError('Error', 'Completa todos los campos');

    if (isDisposableEmail(email)) {
      return showError('Error', 'No se permiten emails temporales. Usá tu correo real.');
    }

    setLoading(true);
    const { error } = await signUpWithEmail(email, fullName);
    setLoading(false);
    if (error) showError('Error', error.message);
    else setShowSuccess(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Unite a Umpi y empeza a publicar</Text>

      <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={c.textMuted} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={c.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

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
        <Text style={styles.btnText}>{loading ? 'Enviando...' : 'Enviar link mágico'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/login')}>
        <Text style={styles.link}>Ya tenes cuenta? <Text style={styles.linkBold}>Inicia sesion</Text></Text>
      </TouchableOpacity>

      <BottomSheetDialog
        visible={showSuccess}
        onClose={() => { setShowSuccess(false); router.push('/login'); }}
        icon={<CheckCircle size={28} color={c.success} />}
        title="Revisa tu email"
        message="Te enviamos un link mágico para crear tu cuenta. Hacé clic en el link para empezar a usar Umpi."
        primaryLabel="Entendido"
        primaryAction={() => { setShowSuccess(false); router.push('/login'); }}
      />
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 24, paddingBottom: 24 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 14, color: c.textMuted, marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: c.surface, padding: 14, borderRadius: 14, fontSize: 15, color: c.text, marginBottom: 12 },
  honeypot: { position: 'absolute', left: -9999, opacity: 0, height: 0, width: 0 },
  btn: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: c.white, fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: c.textMuted },
  linkBold: { color: c.primary, fontWeight: '700' },
});
