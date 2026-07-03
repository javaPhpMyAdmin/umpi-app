import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, Camera, MapPin, DollarSign, Tag, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Category, Listing } from '@/types';
import { mockCategories } from '@/constants/mockData';

export default function PublishScreen() {
  const router = useRouter();
  const { user, session, isLoading, signIn, signInWithGoogle, refreshSession, getAuthDebug } = useAuth();
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (user) {
      setShowLogin(false);
    } else {
      refreshSession().then(recovered => {
        if (recovered) setShowLogin(false);
      });
    }
  }, [user]);
  const [categories, setCategories] = useState<Category[]>(mockCategories.filter(c => c.slug !== 'todos' && c.slug !== 'destacados'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceType, setPriceType] = useState<'fixed' | 'contact'>('fixed');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleLogin = async () => {
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) Alert.alert('Error', error.message);
  };
  const handleGoogleLogin = async () => {
    addDebug('▶ Iniciando login con Google...');
    const { error } = await signInWithGoogle();
    if (error) {
      addDebug('✗ Error: ' + error.message);
      Alert.alert('Error', error.message);
    } else {
      addDebug('✓ signInWithGoogle completado');
      // Verificar sesión inmediatamente
      const { data: { session: s } } = await supabase.auth.getSession();
      addDebug('  getSession post-login: ' + (s ? 'HAY SESIÓN (' + s.user.email + ')' : 'null'));
      // Reintentar refreshSession
      const recovered = await refreshSession();
      addDebug('  refreshSession: ' + (recovered ? 'recuperada' : 'no recuperada'));
    }
  };
  const handleCheckSession = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    const { data: { user: u } } = await supabase.auth.getUser();
    setDebugInfo(
      'Context user: ' + (user ? user.email : 'null') + '\n' +
      'Context session: ' + (session ? session.user?.email : 'null') + '\n' +
      'getSession: ' + (s ? s.user?.email : 'null') + '\n' +
      'getUser: ' + (u ? u.email : 'null') + '\n' +
      'isLoading: ' + isLoading
    );
  };
  const addDebug = (msg: string) => {
    setDebugInfo(prev => prev + '\n' + msg);
  };

  const handlePublish = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Ingresa un titulo');
    if (!selectedCategory) return Alert.alert('Error', 'Selecciona una categoria');
    setLoading(true);
    const { error } = await supabase.from('listings').insert({
      user_id: user?.id,
      title,
      description,
      price: priceType === 'fixed' && price ? parseFloat(price) : null,
      price_type: priceType,
      location,
      category_id: selectedCategory,
      images,
    });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Exito', 'Publicacion creada');
      setTitle('');
      setDescription('');
      setPrice('');
      setLocation('');
      setSelectedCategory(null);
      setImages([]);
    }
  };

  const handleToggleDebug = () => setShowDebug(!showDebug);

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Publicar</Text>
          <TouchableOpacity onPress={handleToggleDebug} style={{ marginLeft: 'auto', padding: 4 }}>
            <Text style={{ fontSize: 12, color: Colors.primary }}>{showDebug ? 'Ocultar debug' : 'Debug'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.authGate}>
          <Text style={styles.authTitle}>Inicia sesion para publicar</Text>
          <Text style={styles.authSubtitle}>Publica tus avisos gratuitamente. Solo necesitas una cuenta.</Text>
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Contrasena" placeholderTextColor={Colors.textMuted} value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
          <TouchableOpacity style={styles.authBtn} onPress={handleLogin} disabled={loading}>
            <Text style={styles.authBtnText}>Iniciar sesion</Text>
          </TouchableOpacity>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} disabled={loading}>
            <Text style={styles.googleBtnText}>Continuar con Google</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.authLink}>No tenes cuenta? Registrate</Text>
          </TouchableOpacity>

          {showDebug && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>🔍 Debug Auth</Text>
              <Text style={styles.debugText}>{debugInfo || 'Esperando acción...'}</Text>
              <TouchableOpacity style={styles.debugBtn} onPress={handleCheckSession}>
                <Text style={styles.debugBtnText}>Chequear sesión ahora</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.debugBtn} onPress={async () => { const r = await refreshSession(); addDebug('refreshSession manual: ' + r); }}>
                <Text style={styles.debugBtnText}>Forzar refreshSession</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.debugBtn} onPress={() => { setDebugInfo(getAuthDebug() || '(vacio)'); }}>
                <Text style={styles.debugBtnText}>Ver log AuthContext</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva publicacion</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryRow}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, selectedCategory === cat.id && { backgroundColor: Colors.primary }]}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}>
                  <Text style={[styles.categoryChipText, selectedCategory === cat.id && { color: Colors.white }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Titulo</Text>
          <View style={styles.inputRow}>
            <Tag size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} placeholder="Que queres publicar?" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descripcion</Text>
          <View style={styles.inputRow}>
            <FileText size={18} color={Colors.textMuted} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Describe tu producto o servicio..." placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={4} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Precio</Text>
          <View style={styles.priceRow}>
            <TouchableOpacity style={[styles.priceTypeBtn, priceType === 'fixed' && { backgroundColor: Colors.primary }]} onPress={() => setPriceType('fixed')}>
              <Text style={[styles.priceTypeText, priceType === 'fixed' && { color: Colors.white }]}>Fijo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.priceTypeBtn, priceType === 'contact' && { backgroundColor: Colors.primary }]} onPress={() => setPriceType('contact')}>
              <Text style={[styles.priceTypeText, priceType === 'contact' && { color: Colors.white }]}>Consultar</Text>
            </TouchableOpacity>
          </View>
          {priceType === 'fixed' && (
            <View style={styles.inputRow}>
              <DollarSign size={18} color={Colors.textMuted} />
              <TextInput style={styles.input} placeholder="Precio en ARS" placeholderTextColor={Colors.textMuted} value={price} onChangeText={setPrice} keyboardType="numeric" />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ubicacion</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} placeholder="Ciudad, provincia..." placeholderTextColor={Colors.textMuted} value={location} onChangeText={setLocation} />
          </View>
        </View>

        <TouchableOpacity style={[styles.publishBtn, loading && { opacity: 0.6 }]} onPress={handlePublish} disabled={loading}>
          <Text style={styles.publishBtnText}>{loading ? 'Publicando...' : 'Publicar aviso'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  authGate: { padding: 24, gap: 12 },
  authTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  authSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  authBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 14, alignItems: 'center' },
  authBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  authLink: { color: Colors.primary, textAlign: 'center', fontWeight: '600', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: Colors.textMuted },
  googleBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 14, borderRadius: 14, alignItems: 'center' },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  form: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryChip: { backgroundColor: Colors.borderLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, gap: 8 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
  textArea: { height: 80, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceTypeBtn: { backgroundColor: Colors.borderLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  priceTypeText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  publishBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  publishBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  debugPanel: { marginTop: 16, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 12, gap: 8 },
  debugTitle: { color: '#e0e0e0', fontWeight: '700', fontSize: 12 },
  debugText: { color: '#0f0', fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
  debugBtn: { backgroundColor: '#333', padding: 8, borderRadius: 8, alignItems: 'center' },
  debugBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
