import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X, MapPin, DollarSign, Tag, FileText, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { Category } from '@/types';
import { CategoryBadge } from '@/components/CategoryBadge';
import { showError, showSuccess } from '@/lib/toast';
import { useListing } from '@/hooks/useListing';
import { useEditListing } from '@/hooks/useListings';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const editMode = !!edit;
  const { data: editListing, isLoading: editLoading } = useListing(edit || null);

  // Fetch categorías reales desde Supabase
  useEffect(() => {
    supabase.from('categories')
      .select('*')
      .eq('is_active', true)
      .neq('slug', 'todos')
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCategories(data as Category[]);
        }
      });
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceType, setPriceType] = useState<'fixed' | 'contact'>('fixed');
  const [images, setImages] = useState<string[]>([]);
  const [initialImages, setInitialImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const editMutation = useEditListing();

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPrice('');
    setLocation('');
    setSelectedCategory(null);
    setPriceType('fixed');
    setImages([]);
    setInitialImages([]);
    setPrefilled(false);
  }, []);

  // Detect edit param disappearing — reset form to clean state
  useEffect(() => {
    if (!edit) {
      resetForm();
    }
  }, [edit, resetForm]);

  // Prefill form when edit listing data arrives
  useEffect(() => {
    if (editMode && editListing && !prefilled) {
      // Validate ownership
      if (editListing.user_id !== user?.id) {
        showError('No tienes permiso', 'No tienes permiso para editar este aviso');
        return;
      }

      setTitle(editListing.title);
      setDescription(editListing.description || '');
      setPrice(editListing.price ? editListing.price.toString() : '');
      setLocation(editListing.location || '');
      setSelectedCategory(editListing.category_id);
      setPriceType((editListing.price_type as 'fixed' | 'contact') || 'fixed');
      const imgs = editListing.images || [];
      setImages(imgs);
      setInitialImages([...imgs]);
      setPrefilled(true);
    }
  }, [editMode, editListing, user?.id, prefilled]);

  // Fallback: if listing not found or wrong owner, clear edit mode
  useEffect(() => {
    if (editMode && !editLoading && editListing === null && !prefilled) {
      showError('Aviso no encontrado');
    }
  }, [editMode, editLoading, editListing, prefilled]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('Permiso requerido', 'Necesitamos acceso a tu galeria para seleccionar fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10 - images.length,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(a => a.uri);
      setImages(prev => [...prev, ...newUris]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!title.trim()) return showError('Error', 'Ingresa un titulo');
    if (!selectedCategory) return showError('Error', 'Selecciona una categoria');
    if (!user) return showError('Error', 'Debes iniciar sesion');

    setLoading(true);

    // Subir imágenes nuevas a Supabase Storage
    const uploadedUrls: string[] = [];
    for (const uri of images) {
      if (uri.startsWith('http')) {
        uploadedUrls.push(uri);
      } else {
        try {
          const publicUrl = await uploadImage(uri, user.id);
          uploadedUrls.push(publicUrl);
        } catch (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          // No bloquear el update — imágenes que fallan se omiten
        }
      }
    }

    // Validar que category_id sea UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const updates = {
      title,
      description,
      price: priceType === 'fixed' && price ? parseFloat(price) : null,
      price_type: priceType,
      location,
      category_id: isValidUUID.test(selectedCategory) ? selectedCategory : null,
      images: uploadedUrls,
    };

    if (editMode && edit) {
      // Compute removed images for cleanup
      const removedImages = initialImages.filter((url) => !images.includes(url));

      editMutation.mutate(
        { id: edit, updates, removedImages },
        {
          onSuccess: () => {
            setLoading(false);
            showSuccess('Exito', 'Aviso actualizado');
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          },
          onError: (err) => {
            setLoading(false);
            const msg = err instanceof Error ? err.message : 'Error al actualizar';
            showError('Error', msg);
          },
        },
      );
    } else {
      const { error } = await supabase.from('listings').insert({
        ...updates,
        user_id: user.id,
      });

      setLoading(false);

      if (error) {
        showError('Error', error.message);
      } else {
        showSuccess('Exito', 'Publicacion creada');
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        setTitle('');
        setDescription('');
        setPrice('');
        setLocation('');
        setSelectedCategory(null);
        setImages([]);
      }
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.emptyHeaderTitle}>Publicar</Text>
        </View>
        <View style={styles.emptyAuth}>
          <Plus size={48} color={Colors.textMuted} />
          <Text style={styles.emptyAuthTitle}>Inicia sesion para publicar</Text>
          <Text style={styles.emptyAuthSubtitle}>Publica tus avisos gratuitamente. Solo necesitas una cuenta.</Text>
          <TouchableOpacity style={styles.emptyAuthBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyAuthBtnText}>Iniciar sesion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => {
          if (editMode) {
            resetForm();
            router.replace('/publish');
          } else {
            router.back();
          }
        }}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editMode ? 'Editar aviso' : 'Nueva publicacion'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryRow}>
              {categories.map(cat => (
                <CategoryBadge
                  key={cat.id}
                  category={cat}
                  isActive={selectedCategory === cat.id}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                />
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fotos {images.length > 0 ? `(${images.length}/10)` : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.imageRow}>
              {images.map((uri, index) => (
                <View key={uri} style={styles.imageThumbWrapper}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => handleRemoveImage(index)}>
                    <X size={14} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 10 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                  <Plus size={24} color={Colors.textMuted} />
                  <Text style={styles.addImageText}>Agregar</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        <TouchableOpacity style={[styles.publishBtn, loading && { opacity: 0.6 }]} onPress={handlePublish} disabled={loading}>
          <Text style={styles.publishBtnText}>
            {loading ? (editMode ? 'Guardando...' : 'Publicando...') : (editMode ? 'Guardar cambios' : 'Publicar aviso')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyHeader: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  emptyHeaderTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  emptyAuthSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAuthBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  form: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  categoryRow: { flexDirection: 'row', gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, gap: 8 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
  textArea: { height: 80, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceTypeBtn: { backgroundColor: Colors.borderLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  priceTypeText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  publishBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  publishBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  imageRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  imageThumbWrapper: { position: 'relative' },
  imageThumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: Colors.borderLight },
  imageRemoveBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addImageBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addImageText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});
