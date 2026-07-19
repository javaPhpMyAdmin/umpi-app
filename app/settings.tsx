import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/toast';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [saving, setSaving] = useState(false);

  // Sync form fields when profile loads (async)
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setLocation(profile.location || '');
    }
  }, [profile?.id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, location })
      .eq('id', user.id);
    setSaving(false);
    if (error) showError('Error', error.message);
    else {
      await refreshProfile();
      showSuccess('Exito', 'Perfil actualizado');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuracion</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Tu nombre" placeholderTextColor={Colors.textMuted} />
        <Text style={styles.label}>Telefono</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Tu telefono" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
        <Text style={styles.label}>Ubicacion</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Tu ciudad" placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Save size={18} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
        </TouchableOpacity>
        {profile?.is_admin && (
          <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin/categories')}>
            <Shield size={18} color={Colors.primary} />
            <Text style={styles.adminBtnText}>Administrar categorias</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  form: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surface, padding: 14, borderRadius: 14, fontSize: 15, color: Colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 14, borderRadius: 14, marginTop: 8 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.borderLight, padding: 14, borderRadius: 14, marginTop: 8 },
  adminBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
});
