import { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return showError('Error', 'Ingresa tu email');
    if (!EMAIL_REGEX.test(email.trim())) return showError('Error', 'Ingresa un email válido');

    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      showError('Error', error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={c.text} />
      </TouchableOpacity>

      {sent ? (
        /* ── Sent state ───────────────────────────────────────── */
        <View style={styles.sent}>
          <Mail size={48} color={c.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={styles.sentTitle}>Revisá tu email</Text>
          <Text style={styles.sentText}>
            Te enviamos un link para restablecer tu contraseña a{'\n'}
            <Text style={{ fontWeight: '700', color: c.text }}>{email.trim()}</Text>
          </Text>
          <Text style={styles.sentHint}>El link expira en unos minutos. Revisá también la carpeta de spam.</Text>
          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.sentBack}>
            <Text style={styles.sentBackText}>Volver al login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Olvidaste tu contraseña?</Text>
          <Text style={styles.subtitle}>
            Ingresa tu email y te enviamos un link para crear una nueva.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Enviando...' : 'Enviar link de recuperación'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.link}>
              Volver a <Text style={styles.linkBold}>Iniciar sesión</Text>
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 24, paddingBottom: 24 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 14, color: c.textMuted, marginTop: 4, marginBottom: 24, lineHeight: 20 },
  input: { backgroundColor: c.surface, padding: 14, borderRadius: 14, fontSize: 15, color: c.text, marginBottom: 12 },
  btn: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: c.white, fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: c.textMuted },
  linkBold: { color: c.primary, fontWeight: '700' },
  // Sent state
  sent: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  sentTitle: { fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 12 },
  sentText: { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
  sentHint: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 16 },
  sentBack: { marginTop: 24, alignItems: 'center' },
  sentBackText: { fontSize: 15, fontWeight: '700', color: c.primary },
});
