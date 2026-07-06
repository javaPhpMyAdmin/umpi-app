import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';

export default function LoginScreen() {
  const router = useRouter();
  const { user, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return showError('Error', 'Completa todos los campos');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) showError('Error', error.message);
    else router.replace('/(tabs)');
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) showError('Error', error.message);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Iniciar sesion</Text>
      <Text style={styles.subtitle}>Bienvenido de vuelta a Umpi</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Contrasena"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
        <Text style={styles.googleBtnText}>Continuar con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/register')}>
        <Text style={styles.link}>No tenes cuenta? <Text style={styles.linkBold}>Registrate</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  backBtn: { marginTop: 48, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: Colors.surface, padding: 14, borderRadius: 14, fontSize: 15, color: Colors.text, marginBottom: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 14, borderRadius: 14, marginBottom: 12 },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.text },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: Colors.textMuted },
  googleBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 16, borderRadius: 14, alignItems: 'center' },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: Colors.textMuted },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
