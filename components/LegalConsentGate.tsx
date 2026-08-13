/**
 * LegalConsentGate — full-screen consent wall for logged-in users who have
 * not accepted the current legal version (see hooks/useLegalConsents).
 *
 * BEHAVIOR (replica of the web LegalConsentGate):
 * - Auth session still loading (not resolved) OR consents still loading →
 *   full-screen spinner (never flash gated content before the gate decides)
 * - Logged out (auth resolved, no session) → render children as-is
 * - Logged in + NOT accepted current version → full-screen wall: centered
 *   card with a plain-language summary and "Aceptar y continuar". The legal
 *   pages (/terms, /privacy) are EXEMPT so the user can read the full
 *   documents before accepting — see EXEMPT_PATHS below.
 * - Logged in + accepted → render children as-is
 *
 * The gate is a full screen, NOT a modal: the app is unusable until the
 * user decides, which is intentional for a legal requirement.
 *
 * MOBILE ADAPTATION: the web gate renders INSTEAD of the routed page; here
 * the gate is an opaque absolute overlay on top of the Stack (same pattern
 * as SplashOverlay). The Stack stays mounted so expo-router navigation state
 * survives acceptance and exempt-route navigation — the overlay blocks all
 * touches and never flashes the content underneath.
 *
 * SCOPE DECISION (documented): this gate is UX-level usage gating. The
 * server enforces the INTEGRITY of the acceptance record (version validated
 * against legal_consent_versions, accepted_at stamped server-side — see
 * record_legal_consent), but a modified client bundle could skip this wall
 * and still call the API. Full server-side usage enforcement (RLS checks on
 * core write tables) is a documented follow-up, deliberately not shipped
 * with this change.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, CircleAlert, ShieldCheck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LEGAL_DOCUMENTS_CONFIG, LEGAL_GATE_SUMMARY } from '@/lib/legalContent';
import { useLegalConsentGate } from '@/hooks/useLegalConsents';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Routes the gate must NOT block. The legal pages need to be readable before
 * accepting; /auth/callback and /confirm-email are the Supabase redirect /
 * magic-link landing routes that establish the session and navigate to the
 * tabs themselves (blocking them would trap the auth flow); /login and
 * /register must never be blocked (the gate applies to logged-in users).
 * The legal doc routes come from LEGAL_DOCUMENTS_CONFIG — the single source
 * of truth for legal routes/titles.
 */
const AUTH_EXEMPT_PATHS = [
  '/auth/callback',
  '/confirm-email',
  '/login',
  '/register',
] as const;

const EXEMPT_PATHS = new Set<string>([
  ...Object.values(LEGAL_DOCUMENTS_CONFIG).map((doc) => doc.route),
  ...AUTH_EXEMPT_PATHS,
]);

export default function LegalConsentGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    needsConsent,
    isChecking,
    queryError,
    refetch,
    recordConsent,
    isRecording,
    recordError,
  } = useLegalConsentGate();

  // Exempt routes (legal docs, auth landings) always render through.
  if (EXEMPT_PATHS.has(pathname)) return <>{children}</>;
  // Nothing to gate: logged out, or logged in with the current version accepted.
  if (!needsConsent && !isChecking) return <>{children}</>;

  return (
    <>
      {children}
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {isChecking ? (
          /* ── Loading: auth session and/or consents still loading ──────── */
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.checkingText}>Verificando tu cuenta...</Text>
          </View>
        ) : queryError ? (
          /* ── Error: consent records could not be fetched ─────────────── */
          <View style={styles.centerContent}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <CircleAlert size={28} color={Colors.error} />
              </View>
              <Text style={styles.cardTitle}>No pudimos verificar tus datos</Text>
              <Text style={styles.cardBody}>
                Ocurrió un error al consultar tu cuenta. Intentálo de nuevo.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => refetch()}>
                <Text style={styles.primaryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── Gate: user must accept the current legal version ────────── */
          <ScrollView contentContainerStyle={styles.centerContent}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <ShieldCheck size={28} color={Colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Aceptá los términos para continuar</Text>
              <Text style={styles.cardBody}>{LEGAL_GATE_SUMMARY}</Text>
              <Text style={styles.cardBody}>
                Podés leer los{' '}
                <Text
                  style={styles.link}
                  onPress={() => router.push(LEGAL_DOCUMENTS_CONFIG.terms.route)}
                >
                  {LEGAL_DOCUMENTS_CONFIG.terms.fullTitle}
                </Text>{' '}
                y la{' '}
                <Text
                  style={styles.link}
                  onPress={() => router.push(LEGAL_DOCUMENTS_CONFIG.privacy.route)}
                >
                  {LEGAL_DOCUMENTS_CONFIG.privacy.fullTitle}
                </Text>{' '}
                completos antes de continuar.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, isRecording && styles.primaryBtnDisabled]}
                onPress={() => {
                  // Error surfaces via recordError below; catch avoids an
                  // unhandled promise rejection.
                  void recordConsent().catch(() => {});
                }}
                disabled={isRecording}
              >
                {isRecording ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Guardando...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Aceptar y continuar</Text>
                    <ArrowRight size={18} color={Colors.white} />
                  </>
                )}
              </TouchableOpacity>

              {/* Escape hatch: a user who does NOT want to consent can sign
                  out instead of being trapped behind the wall (force-quit
                  would just re-show the gate). After sign-out needsConsent
                  is false (it requires a userId) and the gate disappears. */}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={signOut}
                disabled={isRecording}
              >
                <Text style={styles.secondaryBtnText}>Cerrar sesión</Text>
              </TouchableOpacity>

              {recordError && (
                <Text style={styles.errorText}>
                  No se pudo guardar tu aceptación. Intentálo de nuevo.
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 100,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  checkingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  link: {
    color: Colors.primary,
    fontWeight: '700',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 14,
    width: '100%',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 14,
  },
});
