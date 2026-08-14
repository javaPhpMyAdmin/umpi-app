import { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';
import { GoogleIcon } from '@/components/GoogleIcon';
import BottomSheetDialog from '@/components/BottomSheetDialog';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { user, signIn, signInWithGoogle, sendMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'password' | 'magiclink'>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigatedRef = useRef(false);

  // Si ya hay sesión, navegar al toque (una sola vez)
  useEffect(() => {
    if (user && !navigatedRef.current) {
      navigatedRef.current = true;
      router.replace('/(tabs)');
    }
  }, [user, router]);

  // Mientras está autenticando o hay sesión lista, mostrar skeleton
  if (loading || user) {
    return <LoginSkeleton styles={styles} />;
  }

  const handleLogin = async () => {
    if (!email.trim()) return showError('Error', 'Ingresa tu email');

    if (authMode === 'password') {
      if (!password.trim()) return showError('Error', 'Ingresa tu contraseña');
      setLoading(true);
      const { error } = await signIn(email, password);
      if (error) {
        setLoading(false);
        showError('Error', error.message);
      }
    } else {
      // Magic link mode
      setLoading(true);
      const { error } = await sendMagicLink(email);
      setLoading(false);
      if (error) {
        showError('Error', error.message);
      } else {
        setMagicLinkSent(true);
      }
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setLoading(false);
      showError('Error', error.message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Iniciar sesion</Text>
      <Text style={styles.subtitle}>Bienvenido de vuelta a Umpi</Text>

      {magicLinkSent ? (
        /* ── Magic Link sent state ─────────────────────────── */
        <View style={styles.magicLinkSent}>
          <Mail size={48} color={c.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={styles.magicLinkTitle}>Revisa tu email</Text>
          <Text style={styles.magicLinkText}>
            Te enviamos un link mágico a{'\n'}<Text style={{ fontWeight: '700', color: c.text }}>{email}</Text>
          </Text>
          <Text style={styles.magicLinkHint}>Hacé clic en el link para iniciar sesión.</Text>
          <TouchableOpacity onPress={() => { setMagicLinkSent(false); setEmail(''); }} style={styles.magicLinkBack}>
            <Text style={styles.magicLinkBackText}>Volver al login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Auth mode toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, authMode === 'password' && styles.toggleBtnActive]}
              onPress={() => setAuthMode('password')}
            >
              <Text style={[styles.toggleText, authMode === 'password' && styles.toggleTextActive]}>Contraseña</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, authMode === 'magiclink' && styles.toggleBtnActive]}
              onPress={() => setAuthMode('magiclink')}
            >
              <Text style={[styles.toggleText, authMode === 'magiclink' && styles.toggleTextActive]}>Link mágico</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {authMode === 'password' && (
            <>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Contrasena"
                  placeholderTextColor={c.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} color={c.textMuted} /> : <Eye size={20} color={c.textMuted} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotLinkText}>Olvidaste tu contrasena?</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>
              {loading
                ? (authMode === 'password' ? 'Ingresando...' : 'Enviando...')
                : (authMode === 'password' ? 'Ingresar' : 'Enviar link mágico')
              }
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
            <GoogleIcon size={48} />
            <Text style={styles.googleBtnText}>Continuar con Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>No tenes cuenta? <Text style={styles.linkBold}>Registrate</Text></Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function LoginSkeleton({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const Block = ({ style }: { style: any }) => (
    <Animated.View style={[style, { opacity, backgroundColor: c.border }]} />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Block style={{ width: 24, height: 24, borderRadius: 8, marginBottom: 24 }} />
      <Block style={{ width: '55%', height: 28, borderRadius: 8, marginBottom: 8 }} />
      <Block style={{ width: '40%', height: 14, borderRadius: 6, marginBottom: 24 }} />
      <Block style={{ width: '100%', height: 48, borderRadius: 14, marginBottom: 12 }} />
      <Block style={{ width: '100%', height: 48, borderRadius: 14, marginBottom: 16 }} />
      <Block style={{ width: '100%', height: 52, borderRadius: 14, marginBottom: 16 }} />
      <Block style={{ width: '40%', height: 14, borderRadius: 6, marginBottom: 16, alignSelf: 'center' }} />
      <Block style={{ width: '100%', height: 56, borderRadius: 14 }} />
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 24, paddingBottom: 24 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 14, color: c.textMuted, marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: c.surface, padding: 14, borderRadius: 14, fontSize: 15, color: c.text, marginBottom: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, paddingHorizontal: 14, borderRadius: 14, marginBottom: 12 },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: c.text },
  forgotLink: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 },
  forgotLinkText: { fontSize: 13, color: c.primary, fontWeight: '600' },
  btn: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: c.white, fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: c.textMuted },
  googleBtn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, height: 56, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: c.text },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: c.textMuted },
  linkBold: { color: c.primary, fontWeight: '700' },
  // Auth mode toggle
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: c.surface, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: c.background },
  toggleText: { fontSize: 14, fontWeight: '600', color: c.textMuted },
  toggleTextActive: { color: c.text },
  // Magic link sent state
  magicLinkSent: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  magicLinkTitle: { fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 12 },
  magicLinkText: { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
  magicLinkHint: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 16 },
  magicLinkBack: { marginTop: 24, alignItems: 'center' },
  magicLinkBackText: { fontSize: 15, fontWeight: '700', color: c.primary },
});
