import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, useWindowDimensions, BackHandler, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Star, MessageCircle, Calendar, LogIn, Edit3, Trash2, MoreHorizontal, X } from 'lucide-react-native';
import { GestureHandlerRootView, ScrollView as GHSscrollView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import ReviewModal from '@/components/ReviewModal';
import ReviewsListModal from '@/components/ReviewsListModal';
import { UserAvatar } from '@/components/UserAvatar';
import { showError, showSuccess } from '@/lib/toast';
import BottomSheetDialog from '@/components/BottomSheetDialog';
import ActionSheet from '@/components/ActionSheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useListing } from '@/hooks/useListing';
import { useProfile } from '@/hooks/useProfile';
import { useDeleteListing } from '@/hooks/useListings';
import { SkeletonCard } from '@/components/SkeletonCard';
import ZoomableImage from '@/components/ZoomableImage';

export default function ListingDetailScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const imageHeight = Math.min(screenHeight * 0.35, 340);
  const modalImageSize = Math.min(screenWidth * 0.95, 480);
  const { data: listing, isLoading } = useListing(id as string);
  const { data: seller, isLoading: sellerLoading } = useProfile(listing?.user_id);

  const [hasConversation, setHasConversation] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [contacting, setContacting] = useState(false);

  const queryClient = useQueryClient();

  const isOwner = !!user && !!listing && listing.user_id === user.id;
  const deleteMutation = useDeleteListing();

  const checkConversationAndReview = useCallback(async () => {
    if (!listing || !user) {
      setHasConversation(null);
      setHasReviewed(false);
      return;
    }
    if (listing.user_id === user.id) {
      setHasConversation(null);
      setHasReviewed(false);
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
      setHasConversation(null);
      setHasReviewed(false);
      return;
    }

    // Usar la más reciente para el modal de calificar
    const latestConv = conversations[0];
    const convIds = conversations.map((c: { id: string }) => c.id);

    // Buscar si YA calificó en cualquiera de las conversaciones
    const { data: review } = await supabase
      .from('reviews')
      .select('id')
      .in('conversation_id', convIds)
      .eq('reviewer_id', user.id)
      .maybeSingle();

    // Setear ambos estados juntos — React batch update, un solo render
    setHasConversation(latestConv.id);
    setHasReviewed(!!review);
  }, [listing?.id, user?.id]);

  // Correr al montar y cada vez que la screen recibe foco (vuelta del chat)
  useFocusEffect(() => { checkConversationAndReview(); });

  // Android back button closes image modal instead of navigating back
  useEffect(() => {
    if (!showImageModal) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowImageModal(false);
      return true;
    });
    return () => handler.remove();
  }, [showImageModal]);

  const reviewMutation = useMutation({
    mutationFn: async ({ rating }: { rating: number }) => {
      if (!user || !hasConversation || !listing) throw new Error('No se puede calificar');
      const { error } = await supabase.from('reviews').insert({
        conversation_id: hasConversation,
        listing_id: listing.id,
        reviewer_id: user.id,
        rating,
        comment: null,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Ya calificaste a este vendedor.');
        throw new Error('Error al enviar la calificación. Intentalo de nuevo.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      queryClient.invalidateQueries({ queryKey: ['listing-reviews', id] });
      setHasReviewed(true);
      setShowModal(false);
      showSuccess('Calificación enviada');
    },
  });

  const handleSubmitReview = async (rating: number) => {
    await reviewMutation.mutateAsync({ rating });
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
    if (!listing || user.id === listing.user_id || contacting) return;

    setContacting(true);
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const existingConv = conversations?.[0];
      if (existingConv) {
        await supabase.rpc('reopen_conversation', {
          conv_id: existingConv.id,
          user_id: user.id,
        });
        const name = encodeURIComponent(seller?.full_name || 'Usuario');
        const avatar = seller?.avatar_url ? encodeURIComponent(seller.avatar_url) : '';
        router.push(`/chat/${existingConv.id}?otherName=${name}&otherUserId=${listing.user_id}&otherAvatar=${avatar}`);
      } else {
        const name = encodeURIComponent(seller?.full_name || 'Usuario');
        const avatar = seller?.avatar_url ? encodeURIComponent(seller.avatar_url) : '';
        router.push(`/chat/new?listingId=${listing.id}&otherUserId=${listing.user_id}&otherName=${name}&otherAvatar=${avatar}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar';
      showError('Error', msg);
    } finally {
      setContacting(false);
    }
  };

  if (isLoading || !listing) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={{ marginTop: insets.top }} />
        <SkeletonCard variant="detail" />
      </View>
    );
  }

  const allImages = (listing.images?.length ? listing.images : [listing.category?.image_url || '']).filter(Boolean);

  if (listing.status !== 'active') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={[styles.imageWrap, { width: screenWidth, height: imageHeight, marginTop: insets.top }]}>
          <Image source={{ uri: allImages[0] || '' }} style={[styles.image, { width: screenWidth, height: imageHeight }]} resizeMode="cover" />
          <View style={styles.imageOverlay} />
          <TouchableOpacity style={[styles.backBtn, { top: 8 }]} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.unavailable}>
          <Text style={styles.unavailableTitle}>Aviso no disponible</Text>
          <Text style={styles.unavailableText}>Esta publicacion ya no esta activa</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="dark" />
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.imageWrap, { width: screenWidth, height: imageHeight, marginTop: insets.top }]}>
          <TouchableOpacity activeOpacity={0.95} onPress={() => setShowImageModal(true)}>
            <Image source={{ uri: allImages[0] }} style={[styles.image, { width: screenWidth, height: imageHeight }]} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.backBtn, { top: 8 }]} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} />
          </TouchableOpacity>
          {listing.is_featured && (
            <View style={[styles.featuredBadgeOverlay, { top: 8 }]}>
              <Star size={16} color={Colors.white} fill={Colors.white} />
              <Text style={styles.featuredText}>Destacado</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{listing.title}</Text>

          <Text style={styles.price}>
            {listing.price ? `$${listing.price.toLocaleString('es-AR')}` : 'Consultar'}
          </Text>

          <View style={styles.metaRow}>
            {(listing.city?.name || listing.location) && (
              <View style={styles.metaItem}>
                <MapPin size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{listing.city?.name || listing.location}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Star size={14} color={Colors.star} fill={Colors.star} />
              <Text style={styles.metaText}>{listing.rating}</Text>
              <Text style={styles.metaText}>({listing.reviews_count})</Text>
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
              {sellerLoading ? (
                <View style={styles.sellerRow}>
                  <View style={styles.sellerSkeletonAvatar} />
                  <View style={styles.sellerInfo}>
                    <View style={styles.sellerSkeletonName} />
                    <View style={styles.sellerSkeletonMeta} />
                  </View>
                </View>
              ) : (
                <View style={styles.sellerRow}>
                  <UserAvatar url={seller?.avatar_url} name={seller?.full_name} size={44} />
                  <View style={styles.sellerInfo}>
                    <Text style={styles.sellerName}>{seller?.full_name || 'Usuario'}</Text>
                    <View style={styles.sellerMeta}>
                      <Star size={12} color={Colors.star} fill={Colors.star} />
                      <Text style={styles.sellerMetaText}>{seller?.rating?.toFixed(1) || '5.0'}</Text>
                      <TouchableOpacity
                        style={styles.reviewsLink}
                        onPress={() => setShowReviewsModal(true)}
                      >
                        <Text style={styles.reviewsLinkText}>
                          · Ver {listing.reviews_count || 0} {listing.reviews_count === 1 ? 'calificación' : 'calificaciones'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sellerMemberSince}>
                      Miembro desde {seller?.created_at ? new Date(seller.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'desconocido'}
                    </Text>
                  </View>
                </View>
              )}
          </View>

          {user && listing.user_id !== user.id && hasConversation ? (
            hasReviewed ? (
              <Text style={styles.reviewedText}>Ya calificaste este aviso</Text>
            ) : (
              <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowModal(true)}>
                <Star size={16} color={Colors.white} fill={Colors.white} />
                <Text style={styles.reviewBtnText}>Calificar publicador</Text>
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

      <ReviewsListModal
        visible={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        listingId={listing.id}
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

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Trash2 size={32} color={Colors.error} />
            <Text style={styles.deleteTitle}>Eliminar aviso</Text>
            <Text style={styles.deleteMessage}>
              Se eliminaran las imagenes y el aviso dejara de ser visible. Esta accion no se puede deshacer.
            </Text>
            <TouchableOpacity style={styles.deletePrimaryBtn} onPress={handleDelete}>
              <Text style={styles.deletePrimaryBtnText}>Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={styles.deleteCancelBtn}>
              <Text style={styles.deleteCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image gallery overlay */}
      {showImageModal && (
        <View style={styles.imageModalOverlay}>
          {/* Tap outside the card to close */}
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowImageModal(false)} />
          {/* Card on top */}
          <View style={[styles.modalCard, { width: modalImageSize, height: modalImageSize }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowImageModal(false)}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>

            <GHSscrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={e => {
                const page = Math.round(e.nativeEvent.contentOffset.x / modalImageSize);
                setCurrentImage(page);
              }}
              scrollEventThrottle={16}
            >
              {allImages.map((uri, i) => (
                <ZoomableImage
                  key={`modal-${uri}-${i}`}
                  uri={uri}
                  size={modalImageSize}
                  isActive={i === currentImage}
                />
              ))}
            </GHSscrollView>

            {allImages.length > 1 && (
              <View style={styles.modalDots}>
                {allImages.map((_, i) => (
                  <View key={i} style={[styles.modalDot, i === currentImage && styles.modalDotActive]} />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        {isOwner ? (
          <TouchableOpacity style={styles.ownerMenuBtn} onPress={() => setShowActionSheet(true)}>
            <MoreHorizontal size={20} color={Colors.white} />
            <Text style={styles.contactBtnText}>Opciones</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.contactBtn, contacting && { opacity: 0.6 }]}
            onPress={handleContact}
            disabled={contacting}
          >
            <MessageCircle size={20} color={Colors.white} />
            <Text style={styles.contactBtnText}>{contacting ? 'Conectando...' : 'Contactar'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  backBtn: { position: 'absolute', left: 16, backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 12 },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 22, backgroundColor: Colors.white },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, lineHeight: 28, marginBottom: 8 },
  featuredBadgeOverlay: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  featuredText: { fontSize: 15, color: Colors.white, fontWeight: '900', letterSpacing: 0.5 },
  price: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textMuted },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  sellerSkeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.borderLight },
  sellerSkeletonName: { height: 15, borderRadius: 6, width: '45%', backgroundColor: Colors.borderLight },
  sellerSkeletonMeta: { height: 12, borderRadius: 6, width: '55%', backgroundColor: Colors.borderLight, marginTop: 6 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerMetaText: { fontSize: 12, color: Colors.textMuted },
  sellerMemberSince: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  reviewsLink: { paddingVertical: 2 },
  reviewsLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.secondary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginTop: 12 },
  reviewBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  reviewedText: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 12, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 16, borderRadius: 14 },
  contactBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  ownerMenuBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF7A45', padding: 16, borderRadius: 14 },
  unavailable: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 8 },
  unavailableTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  unavailableText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  deleteCard: { width: '100%', maxWidth: 360, backgroundColor: Colors.white, borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  deleteTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 16, marginBottom: 8 },
  deleteMessage: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  deletePrimaryBtn: { width: '100%', backgroundColor: Colors.error, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  deletePrimaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  deleteCancelBtn: { paddingVertical: 12, marginTop: 4 },
  deleteCancelBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCard: { backgroundColor: Colors.white, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 16 },
  modalImage: { resizeMode: 'cover' },
  imageModalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCloseBtn: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  modalDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  modalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  modalDotActive: { width: 22, backgroundColor: Colors.primary },
});
