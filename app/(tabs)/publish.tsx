import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Image, Modal, FlatList, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X, MapPin, DollarSign, Tag, FileText, Plus, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { Category, City } from '@/types';
import { CategoryBadge } from '@/components/CategoryBadge';
import { showError, showSuccess } from '@/lib/toast';
import { useListing } from '@/hooks/useListing';
import { useEditListing } from '@/hooks/useListings';
import { useFeaturedRemaining } from '@/hooks/useFeaturedRemaining';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const editMode = !!edit;
  const { data: editListing, isLoading: editLoading } = useListing(edit || null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceType, setPriceType] = useState<'fixed' | 'contact'>('fixed');
  const [images, setImages] = useState<string[]>([]);
  const [initialImages, setInitialImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const locationDetected = useRef(false);

  const hasActivePlan =
    profile?.subscription_type !== 'none' &&
    profile?.subscription_expires_at != null &&
    new Date(profile.subscription_expires_at) > new Date();
  const [featureToggle, setFeatureToggle] = useState(false);

  const editMutation = useEditListing();
  const { data: featured, isPending: featuredPending, error: featuredError, refetch: refetchFeatured } =
    useFeaturedRemaining(profile?.subscription_type);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [showCustomLocation, setShowCustomLocation] = useState(false);

  // Fetch categories and cities from Supabase
  useEffect(() => {
    supabase.from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCategories(data as Category[]);
        }
      });
    supabase.from('cities')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setCities(data as City[]);
      });
  }, []);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPrice('');
    setLocation('');
    setCityId(null);
    setSelectedCategory(null);
    setPriceType('fixed');
    setImages([]);
    setInitialImages([]);
    setPrefilled(false);
    setGpsDetected(false);
    setShowCustomLocation(false);
    setFeatureToggle(false);
    locationDetected.current = false;
  }, []);

  // Reset form al enfocar la pantalla (viniendo de otra tab), solo en modo nueva
  useFocusEffect(
    useCallback(() => {
      if (!editMode) {
        resetForm();
      }
    }, [editMode]),
  );

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
      setCityId(editListing.city_id || null);
      setLocation(editListing.location || '');
      setShowCustomLocation(!editListing.city_id && !!editListing.location);
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

  // Detectar ubicación automática — primero cache, después GPS con feedback
  useEffect(() => {
    if (!user || editMode || locationDetected.current || prefilled) return;

    let cancelled = false;
    (async () => {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          // Permiso denegado — el usuario elige manual
          return;
        }

        // Intentar ubicación cacheada primero (instantáneo)
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 300_000 }); // 5 min
        if (cancelled) return;
        const coords = cached?.coords || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;
        if (cancelled) return;

        const [reverse] = await Location.reverseGeocodeAsync(coords);
        if (cancelled) return;

        if (reverse?.city) {
          let region = reverse.region || '';
          region = region.replace(/^(Departamento de|Provincia de)\s+/i, '');

          let formatted: string;
          if (reverse.district) {
            formatted = `${reverse.district}, ${reverse.city}`;
          } else if (region && region !== reverse.city) {
            formatted = `${reverse.city}, ${region}`;
          } else {
            formatted = reverse.city;
          }
          setLocation(formatted);
          setGpsDetected(true);
        }
        locationDetected.current = true;
      } catch {
        // Si falla, el usuario puede elegir manualmente
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editMode, prefilled]);

  const handleSelectOther = useCallback(() => {
    setCityId(null);
    setLocation('');
    setShowCustomLocation(true);
    setGpsDetected(false);
    setShowLocationPicker(false);
  }, []);

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
    if (priceType === 'fixed' && !price.trim()) return showError('Error', 'Ingresa un precio');
    if (images.length === 0) return showError('Error', 'Agrega al menos una foto');
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
      city_id: cityId,
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
      const { data: listingData, error } = await supabase
        .from('listings')
        .insert({
          ...updates,
          user_id: user.id,
        })
        .select('id')
        .single();

      setLoading(false);

      if (error) {
        showError('Error', error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        setTitle('');
        setDescription('');
        setPrice('');
        setLocation('');
        setCityId(null);
        setSelectedCategory(null);
        setImages([]);

        if (featureToggle && listingData?.id) {
          setLoading(true);
          const { error: rpcError } = await supabase.rpc('feature_listing', {
            p_listing_id: listingData.id,
          });
          setLoading(false);

          if (rpcError) {
            showSuccess('Publicación creada');
            showError('No se pudo destacar el aviso', rpcError.message);
          } else {
            showSuccess('Tu aviso fue destacado correctamente');
          }
          refetchFeatured();
        } else {
          showSuccess('Exito', 'Publicacion creada');
        }
      }
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyHeader, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
          <View style={styles.headerRow}>
            <Sparkles size={32} color={Colors.white} />
            <Text style={styles.emptyHeaderTitle}>Publicar</Text>
          </View>
          <Text style={styles.headerSubtitle}>¡Dale, animate a publicar!</Text>
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
          resetForm();
          if (editMode) {
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
          <Text style={styles.sectionLabel}>Titulo <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputRow}>
            <Tag size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} placeholder="Que queres publicar?" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} maxLength={100} />
          </View>
          <Text style={styles.charCounter}>{title.length}/100</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descripcion</Text>
          <View style={styles.inputRow}>
            <FileText size={18} color={Colors.textMuted} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Describe tu producto o servicio..." placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={4} maxLength={500} />
          </View>
          <Text style={styles.charCounter}>{description.length}/500</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Precio <Text style={styles.required}>*</Text></Text>
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
          {showCustomLocation ? (
            <View style={styles.inputRow}>
              <MapPin size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Escribí tu ubicación..."
                placeholderTextColor={Colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
              <TouchableOpacity onPress={() => { setShowCustomLocation(false); setLocation(''); setCityId(null); }}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.inputRow} onPress={() => setShowLocationPicker(true)} activeOpacity={0.7}>
              <MapPin size={18} color={gpsDetected ? Colors.error : location ? Colors.primary : Colors.textMuted} />
              {locationLoading ? (
                <Text style={[styles.input, styles.loadingText]}>Obteniendo ubicacion...</Text>
              ) : (
                <Text style={[styles.input, !location && styles.placeholder]}>
                  {location || 'Seleccionar ciudad...'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fotos <Text style={styles.required}>*</Text> {images.length > 0 ? `(${images.length}/10)` : ''}</Text>
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

        {!editMode && (
          hasActivePlan ? (
            <View style={styles.section}>
              <View style={styles.featureRow}>
                <View style={styles.featureLabelContainer}>
                  <Text style={styles.sectionLabel}>Destacar aviso</Text>
                  <Text style={styles.featureHelper}>
                    Tu aviso aparecerá primero en los resultados
                  </Text>
                </View>
                <Switch
                  value={featureToggle}
                  onValueChange={setFeatureToggle}
                  disabled={!featuredPending && !featuredError && (featured?.remaining ?? 0) <= 0}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={featureToggle ? Colors.white : '#f4f3f4'}
                />
              </View>
              {featuredPending ? (
                <Text style={styles.featureRemaining}>Cargando...</Text>
              ) : featuredError ? (
                <Text style={[styles.featureRemaining, { color: Colors.error }]}>
                  Error al cargar tus destacados
                </Text>
              ) : (featured?.remaining ?? 0) > 0 ? (
                <Text style={styles.featureRemaining}>
                  Te {(featured?.remaining ?? 0) === 1 ? 'queda' : 'quedan'} {featured?.remaining} destacado{featured?.remaining !== 1 ? 's' : ''} de {featured?.maxFeatured} este período
                </Text>
              ) : (
                <Text style={[styles.featureRemaining, { color: Colors.error }]}>
                  Agotaste tus destacados de este período
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Suscribite a un plan para destacar tus avisos
              </Text>
              <TouchableOpacity style={styles.bannerBtn} onPress={() => router.push('/plans')}>
                <Text style={styles.bannerBtnText}>Ver planes</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        <TouchableOpacity style={[styles.publishBtn, loading && { opacity: 0.6 }]} onPress={handlePublish} disabled={loading}>
          <Text style={styles.publishBtnText}>
            {loading ? (editMode ? 'Guardando...' : 'Publicando...') : (editMode ? 'Guardar cambios' : 'Publicar aviso')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLocationPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar ubicacion</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.locationItem, location === item.name && styles.locationItemActive]}
                  onPress={() => {
                    setCityId(item.id);
                    setLocation(item.name);
                    setGpsDetected(false);
                    setShowLocationPicker(false);
                  }}
                >
                  <Text style={[styles.locationItemText, location === item.name && styles.locationItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={() => (
                <TouchableOpacity
                  style={styles.locationItem}
                  onPress={() => {
                    handleSelectOther();
                  }}
                >
                  <Text style={[styles.locationItemText, { color: Colors.primary, fontWeight: '600' }]}>
                    Otra ciudad...
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },

  emptyHeader: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  emptyHeaderTitle: { fontSize: 34, fontWeight: '800', color: Colors.white },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerSubtitle: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  emptyAuthSubtitle: { fontSize: 15, fontWeight: '600', color: '#4B5563', textAlign: 'center', lineHeight: 22, paddingHorizontal: 24 },
  emptyAuthBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  form: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  required: { color: Colors.error, fontWeight: '700' },
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
  placeholder: { color: Colors.textMuted },
  loadingText: { color: Colors.textMuted, fontStyle: 'italic' },
  featureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14 },
  featureLabelContainer: { flex: 1, marginRight: 12 },
  featureHelper: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  featureRemaining: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 4, paddingLeft: 16 },
  banner: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed' },
  bannerText: { fontSize: 14, color: Colors.text, fontWeight: '600', marginBottom: 12, lineHeight: 20 },
  bannerBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' },
  bannerBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  charCounter: { fontSize: 12, color: Colors.textMuted, textAlign: 'right', marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  locationItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  locationItemActive: { backgroundColor: Colors.borderLight },
  locationItemText: { fontSize: 15, color: Colors.text },
  locationItemTextActive: { color: Colors.primary, fontWeight: '600' },
});
