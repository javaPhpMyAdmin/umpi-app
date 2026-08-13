import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';
import BottomSheetDialog from '@/components/BottomSheetDialog';

type Status = 'checking' | 'invalid' | 'ready' | 'success';

/**
 * ResetPasswordScreen — pantalla de "Nueva contraseña".
 *
 * Flujo del deep link `umpi://reset-password` (soporta PKCE E implicit):
 * 1. Supabase envía el recovery link apuntando a `umpi://reset-password`.
 *    - PKCE (default hoy): `umpi://reset-password?code=...` — el code llega
 *      como query param, se canjea con `exchangeCodeForSession` (mismo
 *      patrón que `auth/callback.tsx`).
 *    - Implicit (legacy): `umpi://reset-password#access_token=...&type=recovery`
 *      — el fragment NO llega a los params de Expo Router, se lee con
 *      `Linking.getInitialURL()` (app fría) o `Linking.addEventListener('url')`
 *      (app ya abierta).
 * 2. Hot-start race: con la app abierta, el listener global de expo-router
 *    navega primero y el evento de Linking puede perderse. El `code` PKCE
 *    queda en `useLocalSearchParams`, así que también se procesa desde ahí.
 * 3. GATE recovery-only: el form SOLO se habilita cuando la sesión vino de un
 *    link de recovery real (flag `recoveryMode`, seteada únicamente en los
 *    caminos de recovery: evento PASSWORD_RECOVERY, exchange PKCE exitoso o
 *    setSession desde el fragment). Una sesión normal persistida NUNCA
 *    habilita el form — en ese caso se muestra "El link es inválido o expiró".
 */
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { updatePassword, signOut } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Flag de recovery — ref para lecturas síncronas dentro de init() (el state
  // quedaría stale en el closure del effect). Solo los caminos de recovery la
  // setean; la sesión persistida normal jamás.
  const recoveryModeRef = useRef(false);

  const markRecoveryReady = useCallback((ok: boolean): boolean => {
    if (ok) {
      recoveryModeRef.current = true;
      setStatus('ready');
      return true;
    }
    return false;
  }, []);

  // PKCE: `?code=...` (query param) → exchangeCodeForSession
  const applyPkce = useCallback(async (code: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn('[reset-password] exchangeCodeForSession falló:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      // p. ej. AuthPKCECodeVerifierMissingError: el link se pidió desde otra
      // plataforma y este cliente no tiene el code-verifier → link inválido.
      console.warn('[reset-password] exchangeCodeForSession lanzó una excepción:', e);
      return false;
    }
  }, []);

  // Implicit: `#access_token=...&type=recovery` (fragment)
  const applyImplicit = useCallback(async (url: string): Promise<boolean> => {
    const fragment = url.split('#')[1];
    if (!fragment) return false;

    const fp: Record<string, string> = {};
    fragment.split('&').forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) fp[k] = decodeURIComponent(v);
    });

    // Recovery: el fragment del deep link trae type=recovery
    if (fp.access_token && fp.type === 'recovery') {
      const { error } = await supabase.auth.setSession({
        access_token: fp.access_token,
        refresh_token: fp.refresh_token || '',
      });
      if (error) return false;
      // Validar el JWT del link contra el server antes de habilitar el form
      const { error: userError } = await supabase.auth.getUser();
      return !userError;
    }
    return false;
  }, []);

  // Resuelve una URL completa: code en query → PKCE, si no fragment → implicit
  const resolveUrl = useCallback(async (url: string | null): Promise<boolean> => {
    if (!url) return false;
    const codeMatch = url.match(/[?&]code=([^&]+)/);
    if (codeMatch) return applyPkce(decodeURIComponent(codeMatch[1]));
    return applyImplicit(url);
  }, [applyPkce, applyImplicit]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 1) App abierta fría con el deep link → la URL completa viene acá
      //    (query con `code` y/o fragment con access_token)
      const url = await Linking.getInitialURL();
      if (cancelled) return;
      if (await resolveUrl(url)) {
        markRecoveryReady(true);
        return;
      }

      // 2) Hot start: expo-router ya navegó y consumió el evento; el `code`
      //    PKCE quedó en los params de la ruta — procesarlo igual que Linking
      if (params.code) {
        if (await applyPkce(params.code)) {
          markRecoveryReady(true);
          return;
        }
      }

      // 3) Ventana defensiva: dejar llegar un evento de Linking o de auth
      //    (PASSWORD_RECOVERY) que expo-router pueda haber retrasado antes de
      //    decidir que el link es inválido.
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      // 4) Fallback: sin token/code → una sola getSession(). La sesión
      //    persistida normal NO habilita el form (gate recovery-only): solo
      //    recoveryMode decide. Sin recovery → link inválido.
      await supabase.auth.getSession();
      if (cancelled) return;
      if (!recoveryModeRef.current) setStatus('invalid');
    };

    // App ya abierta cuando llega el deep link (si expo-router no lo consumió)
    const sub = Linking.addEventListener('url', ({ url }) => {
      resolveUrl(url).then((ok) => markRecoveryReady(ok));
    });

    // Red de seguridad: si el SDK procesa el recovery por su cuenta
    // (exchangeCodeForSession PKCE emite PASSWORD_RECOVERY para recovery),
    // el evento avisa — y es la única vía que marca recoveryMode.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') markRecoveryReady(true);
    });

    init();

    return () => {
      cancelled = true;
      sub.remove();
      subscription.unsubscribe();
    };
  }, [applyPkce, applyImplicit, resolveUrl, markRecoveryReady, params.code]);

  const handleSubmit = async () => {
    if (password.length < 6) return showError('Error', 'La contraseña debe tener al menos 6 caracteres');
    if (password !== confirmPassword) return showError('Error', 'Las contraseñas no coinciden');

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      showError('Error', error.message);
    } else {
      setStatus('success');
    }
  };

  const handleDone = async () => {
    // Cerrar la sesión de recovery para que el usuario ingrese con la nueva
    // contraseña. Si signOut rechaza (p. ej. offline), igual navegamos.
    try {
      await signOut();
    } catch (e) {
      console.warn('[reset-password] signOut falló tras actualizar la contraseña:', e);
    }
    router.replace('/login');
  };

  if (status === 'checking') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.checkingTitle}>Verificando el link...</Text>
        <Text style={styles.checkingSubtitle}>Un momento mientras validamos tu solicitud.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
        <ArrowLeft size={24} color={Colors.text} />
      </TouchableOpacity>

      {status === 'invalid' ? (
        /* ── Link inválido / expirado ─────────────────────────── */
        <View style={styles.invalid}>
          <KeyRound size={48} color={Colors.error} style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={styles.invalidTitle}>El link es inválido o expiró</Text>
          <Text style={styles.invalidText}>
            Los links de recuperación son de un solo uso y expiran rápido. Pedí uno nuevo para continuar.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.btnText}>Solicitar nuevo link</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.link}>Volver a <Text style={styles.linkBold}>Iniciar sesión</Text></Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Form de nueva contraseña ─────────────────────────── */
        <>
          <Text style={styles.title}>Nueva contraseña</Text>
          <Text style={styles.subtitle}>Ingresa tu nueva contraseña para continuar.</Text>

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Nueva contraseña"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirmar contraseña"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>Mínimo 6 caracteres.</Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Actualizando...' : 'Actualizar contraseña'}</Text>
          </TouchableOpacity>
        </>
      )}

      <BottomSheetDialog
        visible={status === 'success'}
        onClose={handleDone}
        icon={<CheckCircle size={28} color={Colors.success} />}
        title="Contraseña actualizada"
        message="Tu contraseña se cambió correctamente. Ingresá con tu nueva contraseña."
        primaryLabel="Entendido"
        primaryAction={handleDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24, paddingBottom: 24 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  checkingTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 20, textAlign: 'center' },
  checkingSubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4, marginBottom: 24 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.text },
  hint: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: Colors.textMuted },
  linkBold: { color: Colors.primary, fontWeight: '700' },
  // Invalid state
  invalid: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  invalidTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  invalidText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
