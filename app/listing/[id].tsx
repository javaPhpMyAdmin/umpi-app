import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Star, MessageCircle, Calendar, LogIn, Edit3, Trash2, MoreHorizontal } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Listing, Profile } from '@/types';
import ReviewModal from '@/components/ReviewModal';
import { showError, showSuccess } from '@/lib/toast';
import BottomSheetDialog from '@/components/BottomSheetDialog';
import ActionSheet from '@/components/ActionSheet';
import { useDeleteListing } from '@/hooks/useListings';
import { SkeletonCard } from '@/components/SkeletonCard';

// ⚠️ Set to 0 in production — this is only for visual QA of the skeleton
const SIMULATED_DELAY_MS = 0;

export default function ListingDetailScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [hasConversation, setHasConversation] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewCheckLoading, setReviewCheckLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  const isOwner = !!user && !!listing && listing.user_id === user.id;
  const deleteMutation = useDeleteListing();

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);

    // Artificial delay for skeleton visual QA
    if (SIMULATED_DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
    }

    const { data } = await supabase
      .from('listings')
      .select('*, category:category_id(*)')
      .eq('id', id as string)
      .maybeSingle();
    if (data) {
      setListing(data as Listing);
      // Fetch seller profile separately (listings.user_id references auth.users, not profiles)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle();
      if (profile) setSeller(profile as Profile);
    }
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      setHasConversation(null);
      setHasReviewed(false);
      setReviewCheckLoading(true);
      if (!listing || !user) {
        setReviewCheckLoading(false);
        return;
      }
      if (listing.user_id === user.id) {
        setReviewCheckLoading(false);
        return;
      }

      // Buscar todas las conversaciones de este listing (archivadas incluidas)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!conversations || conversations.length === 0) {
        setReviewCheckLoading(false);
        return;
      }

      // Usar la más reciente para el modal de calificar
      const latestConv = conversations[0];
      setHasConversation(latestConv.id);

      // Buscar si YA calificó en cualquiera de las conversaciones
      const convIds = conversations.map((c: { id: string }) => c.id);
      const { data: review } = await supabase
        .from('reviews')
        .select('id')
        .in('conversation_id', convIds)
        .eq('reviewer_id', user.id)
        .maybeSingle();

      if (review) setHasReviewed(true);
      setReviewCheckLoading(false);
    };
    run();
  }, [listing?.id, user?.id]);

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!user || !hasConversation) return;
    const { error } = await supabase.from('reviews').insert({
      conversation_id: hasConversation,
      reviewer_id: user.id,
      rating,
      comment: comment || null,
    });
    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya calificaste a este vendedor.');
      }
      throw new Error('Error al enviar la calificación. Intentalo de nuevo.');
    }
  };

  const handleEdit = () => {
    router.push(`/publish?edit=${listing?.id}`);
  };

  const handleDeleteConfirm = () => {
    setShowActionSheet(false);
    setShowDeleteConfirm(true);
  };

  const handleDelete = () => {
    if (!listing) return;
    setShowDeleteConfirm(false);
    deleteMutation.mutate(
      { id: listing.id, images: listing.images || [] },
      {
        onSuccess: () => {
          showSuccess('Eliminado', 'Aviso eliminado');
          router.back();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Error al eliminar el aviso';
          showError('Error', msg);
        },
      },
    );
  };

  const handleContact = async () => {
    if (!user) return setShowLoginPrompt(true);
    if (!listing || user.id === listing.user_id) return;

    // Buscar cualquier conversación existente (incluso archivada)
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listing.id)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .maybeSingle();

    if (data) {
      // Si estaba archivada, la reabrimos
      await supabase.rpc('reopen_conversation', {
        conv_id: data.id,
        user_id: user.id,
      });
      router.push(`/chat/${data.id}`);
    } else {
      // No se crea la conversación aún — se crea al enviar el primer mensaje
      const name = encodeURIComponent(seller?.full_name || 'Usuario');
      router.push(`/chat/new?listingId=${listing.id}&otherUserId=${listing.user_id}&otherName=${name}`);
    }
  };

  if (loading || !listing) {
    return (
      <View style={styles.container}>
        <SkeletonCard variant="detail" />
      </View>
    );
  }

  const allImages = (listing.images?.length ? listing.images : [listing.category?.image_url || '']).filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.imageWrap, { width: screenWidth }]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={e => {
              const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setCurrentImage(page);
            }}
            scrollEventThrottle={16}
          >
            {allImages.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.image, { width: screenWidth }]} resizeMode="cover" />
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
          {allImages.length > 1 && (
            <View style={styles.dots}>
              {allImages.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentImage && styles.dotActive]} />
              ))}
            </View>
          )}
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
                <Text style={styles.sellerAvatarText}>{(seller?.full_name || 'U')[0]}</Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{seller?.full_name || 'Usuario'}</Text>
                <View style={styles.sellerMeta}>
                  <Star size={12} color={Colors.star} fill={Colors.star} />
                  <Text style={styles.sellerMetaText}>{seller?.rating?.toFixed(1) || '5.0'}</Text>
                  <Text style={styles.sellerMetaText}>· {seller?.reviews_count || 0} calificaciones</Text>
                </View>
                <Text style={styles.sellerMemberSince}>
                  Miembro desde {seller?.created_at ? new Date(seller.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'desconocido'}
                </Text>
              </View>
            </View>
          </View>

          {user && listing.user_id !== user.id && hasConversation && !reviewCheckLoading ? (
            hasReviewed ? (
              <Text style={styles.reviewedText}>Ya calificaste este aviso</Text>
            ) : (
              <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowModal(true)}>
                <Star size={16} color={Colors.white} fill={Colors.white} />
                <Text style={styles.reviewBtnText}>Calificar vendedor</Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </ScrollView>

      <ReviewModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmitReview}
        conversationId={hasConversation || ''}
      />

      <BottomSheetDialog
        visible={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        icon={<LogIn size={28} color={Colors.primary} />}
        title="Inicia sesion"
        message="Necesitas una cuenta para contactar al vendedor."
        primaryLabel="Iniciar sesion"
        primaryAction={() => { setShowLoginPrompt(false); router.push('/login'); }}
        secondaryLabel="Cancelar"
      />

      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        options={[
          { label: 'Editar', icon: <Edit3 size={20} color={Colors.text} />, action: handleEdit },
          { label: 'Eliminar', icon: <Trash2 size={20} color={Colors.error} />, destructive: true, action: handleDeleteConfirm },
        ]}
      />

      <BottomSheetDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        icon={<Trash2 size={28} color={Colors.error} />}
        title="Eliminar aviso"
        message="Se eliminaran las imagenes y el aviso dejara de ser visible. Esta accion no se puede deshacer."
        primaryLabel="Eliminar"
        primaryAction={handleDelete}
        secondaryLabel="Cancelar"
        destructiveSecondary
      />

      <View style={styles.bottomBar}>
        {isOwner ? (
          <TouchableOpacity style={styles.ownerMenuBtn} onPress={() => setShowActionSheet(true)}>
            <MoreHorizontal size={20} color={Colors.white} />
            <Text style={styles.contactBtnText}>Opciones</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
            <MessageCircle size={20} color={Colors.white} />
            <Text style={styles.contactBtnText}>Contactar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  imageWrap: { position: 'relative', height: 280 },
  image: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 48, left: 16, backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 12 },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 22, backgroundColor: Colors.white },
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
  sellerMemberSince: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.secondary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginTop: 12 },
  reviewBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  reviewedText: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 12, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 16, borderRadius: 14 },
  contactBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  ownerMenuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.textSecondary, padding: 16, borderRadius: 14 },
});
