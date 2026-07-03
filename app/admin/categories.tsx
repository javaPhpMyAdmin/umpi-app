import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { mockCategories } from '@/constants/mockData';

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data as Category[]);
    else setCategories(mockCategories);
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim() || !icon.trim()) return Alert.alert('Error', 'Completa nombre, slug e icono');
    setLoading(true);
    const { error } = await supabase.from('categories').insert({
      name: name.trim(),
      slug: slug.trim(),
      icon: icon.trim(),
      image_url: imageUrl.trim() || null,
    });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Exito', 'Categoria creada');
      setName('');
      setSlug('');
      setIcon('');
      setImageUrl('');
      fetchCategories();
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Eliminar', 'Seguro que queres eliminar esta categoria?', [
      { text: 'Cancelar' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else fetchCategories();
      }}
    ]);
  };

  if (!profile?.is_admin) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Acceso denegado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administrar categorias</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          <Text style={styles.label}>Nueva categoria</Text>
          <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Slug (ej: servicios)" placeholderTextColor={Colors.textMuted} value={slug} onChangeText={setSlug} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Icono (ej: Wrench, Car, Home)" placeholderTextColor={Colors.textMuted} value={icon} onChangeText={setIcon} />
          <TextInput style={styles.input} placeholder="URL de imagen (opcional)" placeholderTextColor={Colors.textMuted} value={imageUrl} onChangeText={setImageUrl} />
          <TouchableOpacity style={[styles.createBtn, loading && { opacity: 0.6 }]} onPress={handleCreate} disabled={loading}>
            <Plus size={18} color={Colors.white} />
            <Text style={styles.createBtnText}>Crear categoria</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.list}>
          <Text style={styles.listTitle}>Categorias existentes</Text>
          {categories.map(cat => (
            <View key={cat.id} style={styles.categoryRow}>
              <View style={styles.categoryInfo}>
                <CategoryIcon icon={cat.icon} size={20} color={Colors.primary} />
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categorySlug}>{cat.slug}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(cat.id)}>
                <Trash2 size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  loading: { textAlign: 'center', marginTop: 100, fontSize: 16, color: Colors.textMuted },
  scroll: { padding: 16, paddingBottom: 40 },
  form: { gap: 10 },
  label: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, padding: 12, borderRadius: 12, fontSize: 14, color: Colors.text },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 12, borderRadius: 12 },
  createBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  list: { marginTop: 24 },
  listTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  categorySlug: { fontSize: 12, color: Colors.textMuted },
});
