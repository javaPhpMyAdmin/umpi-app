import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Shield, ShieldCheck, FileText, ChevronRight, Moon } from 'lucide-react-native';
import { useTheme, useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/toast';
import { LEGAL_DOCUMENTS_CONFIG } from '@/lib/legalContent';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
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
          <ArrowLeft size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuracion</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Tu nombre" placeholderTextColor={c.textMuted} />
        <Text style={styles.label}>Telefono</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Tu telefono" placeholderTextColor={c.textMuted} keyboardType="phone-pad" />
        <Text style={styles.label}>Ubicacion</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Tu ciudad" placeholderTextColor={c.textMuted} />
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Save size={18} color={c.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
        </TouchableOpacity>

        {/* Modo oscuro — paridad web (mismo label/estado que AccountSettingsPage) */}
        <View style={styles.themeRow}>
          <Moon size={18} color={c.textSecondary} />
          <View style={styles.themeInfo}>
            <Text style={styles.themeLabel}>Modo oscuro</Text>
            <Text style={styles.themeStatus}>{isDark ? 'Activado' : 'Desactivado'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={c.white}
          />
        </View>

        {profile?.is_admin && (
          <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin/categories')}>
            <Shield size={18} color={c.primary} />
            <Text style={styles.adminBtnText}>Administrar categorias</Text>
          </TouchableOpacity>
        )}
        <View style={styles.legalSection}>
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => router.push(LEGAL_DOCUMENTS_CONFIG.terms.route)}
          >
            <FileText size={18} color={c.textSecondary} />
            <Text style={styles.legalRowText}>
              {LEGAL_DOCUMENTS_CONFIG.terms.fullTitle}
            </Text>
            <ChevronRight size={18} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => router.push(LEGAL_DOCUMENTS_CONFIG.privacy.route)}
          >
            <ShieldCheck size={18} color={c.textSecondary} />
            <Text style={styles.legalRowText}>
              {LEGAL_DOCUMENTS_CONFIG.privacy.fullTitle}
            </Text>
            <ChevronRight size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  form: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  input: { backgroundColor: c.surface, padding: 14, borderRadius: 14, fontSize: 15, color: c.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, padding: 14, borderRadius: 14, marginTop: 8 },
  saveBtnText: { color: c.white, fontWeight: '700', fontSize: 15 },
  themeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, padding: 14, borderRadius: 14, gap: 12, marginTop: 8 },
  themeInfo: { flex: 1 },
  themeLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  themeStatus: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.borderLight, padding: 14, borderRadius: 14, marginTop: 8 },
  adminBtnText: { color: c.primary, fontWeight: '700', fontSize: 15 },
  legalSection: { marginTop: 8, gap: 8 },
  legalRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, padding: 14, borderRadius: 14, gap: 12 },
  legalRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
});
