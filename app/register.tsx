import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/toast';
import BottomSheetDialog from '@/components/BottomSheetDialog';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) return showError('Error', 'Completa todos los campos');
    if (password.length < 6) return showError('Error', 'La contrasena debe tener al menos 6 caracteres');
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) showError('Error', error.message);
    else setShowSuccess(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Unite a Umpi y empeza a publicar</Text>

      <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <View style={styles.passwordRow}>
        <TextInput style={styles.passwordInput} placeholder="Contrasena" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
        </TouchableOpacity>
      </View>

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
  link: { textAlign: 'center', marginTop: 20, fontSize: 14, color: Colors.textMuted },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
