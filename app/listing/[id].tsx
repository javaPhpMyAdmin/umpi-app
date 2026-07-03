import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Star, MessageCircle, Calendar, Tag } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types';
import { mockListings } from '@/constants/mockData';

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('listings')
      .select('*, category:category_id(*), user:user_id(*)')
      .eq('id', id as string)
      .maybeSingle();
    if (data) {
      setListing(data as Listing);
    } else {
      const mock = mockListings.find(l => l.id === id);
      if (mock) setListing(mock);
    }
    setLoading(false);
  };

  const handleContact = async () => {
    if (!user) return Alert.alert('Inicia sesion', 'Necesitas una cuenta para contactar al vendedor', [
      { text: 'Cancelar' },
      { text: 'Iniciar sesion', onPress: () => router.push('/login') }
    ]);
    if (!listing || user.id === listing.user_id) return;
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listing.id)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .maybeSingle();
    if (data) {
      router.push(`/chat/${data.id}`);
    } else {
      const otherId = listing.user_id;
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          user1_id: user.id,
          user2_id: otherId,
        })
        .select('id')
        .single();
      if (error) Alert.alert('Error', error.message);
      else if (conv) router.push(`/chat/${conv.id}`);
    }
  };

  if (loading || !listing) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Cargando...</Text>
      </View>
    );
  }

  const image = listing.images?.[0] || listing.category?.image_url || '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: image }} style={styles.image} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{listing.title}</Text>
            {listing.is_featured && (
              <View style={styles.featuredBadge}>
                <Star size={12} color={Colors.gold} fill={Colors.gold} />
                <Text style={styles.featuredText}>Destacado</Text>
              </View>
            )}
          </View>

          <Text style={styles.price}>
            {listing.price ? `$${listing.price.toLocaleString('es-AR')}` : 'Consultar'}
          </Text>

          <View style={styles.metaRow}>
            {listing.location && (
              <View style={styles.metaItem}>
                <MapPin size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{listing.location}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Star size={14} color={Colors.star} fill={Colors.star} />
              <Text style={styles.metaText}>{listing.rating}</Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{new Date(listing.created_at).toLocaleDateString('es-AR')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripcion</Text>
            <Text style={styles.description}>{listing.description || 'Sin descripcion'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vendedor</Text>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>{(listing.user?.full_name || 'U')[0]}</Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{listing.user?.full_name || 'Usuario'}</Text>
                <View style={styles.sellerMeta}>
                  <Star size={12} color={Colors.star} fill={Colors.star} />
                  <Text style={styles.sellerMetaText}>{listing.user?.rating?.toFixed(1) || '5.0'}</Text>
                  <Text style={styles.sellerMetaText}>· {listing.user?.total_sales || 0} ventas</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
          <MessageCircle size={20} color={Colors.white} />
          <Text style={styles.contactBtnText}>Contactar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { textAlign: 'center', marginTop: 100, fontSize: 16, color: Colors.textMuted },
  imageWrap: { position: 'relative', height: 280 },
  image: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 48, left: 16, backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 12 },
  content: { padding: 20, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: Colors.text, lineHeight: 28 },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${Colors.gold}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  featuredText: { fontSize: 10, color: Colors.gold, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textMuted },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sellerAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerMetaText: { fontSize: 12, color: Colors.textMuted },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 16, borderRadius: 14 },
  contactBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
