import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Star, Settings, Crown, LogOut, User, Plus, ChevronRight, Edit3, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMyListings, useDeleteListing } from '@/hooks/useListings';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { UserAvatar } from '@/components/UserAvatar';
import ActionSheet from '@/components/ActionSheet';
import BottomSheetDialog from '@/components/BottomSheetDialog';
import { showError, showSuccess } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { data: myListings = [], isLoading } = useMyListings(user?.id);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteListing();
  const [syncing, setSyncing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Refresh profile every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) refreshProfile();
    }, [user]),
  );

  const handleCardAction = (id: string) => {
    setSelectedListingId(id);
    setShowActionSheet(true);
  };

  const handleEditFromProfile = () => {
    setShowActionSheet(false);
    if (selectedListingId) {
      router.push(`/publish?edit=${selectedListingId}`);
    }
  };

  const handleDeleteFromProfile = () => {
    setShowActionSheet(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedListingId) return;
    setShowDeleteConfirm(false);
    const listing = myListings.find((l) => l.id === selectedListingId);
    deleteMutation.mutate(
      { id: selectedListingId, images: listing?.images || [] },
      {
        onSuccess: () => {
          showSuccess('Eliminado', 'Aviso eliminado');
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Error al eliminar el aviso';
          showError('Error', msg);
        },
      },
    );
    setSelectedListingId(null);
  };

  const handleSyncSubscription = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-subscription',
        { method: 'POST' },
      );
      if (error) throw error;
      if (data?.synced) {
        showSuccess('Suscripción actualizada', 'Los datos se sincronizaron con MercadoPago');
      } else if (data?.reason) {
        showError('Sin cambios', data.reason);
      } else {
        showSuccess('Verificada', 'Tu suscripción está al día');
      }
      await refreshProfile();
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };
  const handleCancelSubscription = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    setIsCancelling(true);
    try {
      const { data: cancelData, error: cancelError } = await supabase.functions.invoke(
        'cancel-subscription',
        { method: 'POST' },
      );
      if (cancelError) {
        let msg = 'Error al cancelar en MercadoPago';
        try {
          const ctx = (cancelError as Record<string, unknown>)?.context;
          if (ctx && typeof (ctx as Record<string, unknown>).json === 'function') {
            const errorBody = await (ctx as Response).json();
            msg = errorBody?.error || msg;
            console.log('[cancel-subscription] full response:', JSON.stringify(errorBody));
          }
        } catch (_) { /* ignore parse errors */ }
        throw new Error(msg);
      }
      setShowCancelModal(false);
      showSuccess('Suscripción cancelada', 'Tu suscripción ha sido cancelada correctamente');
      await refreshProfile();
    } catch (err) {
      setShowCancelModal(false);
      showError('Error', err instanceof Error ? err.message : 'Error al cancelar en MercadoPago');
    } finally {
      setIsCancelling(false);
    }
  };

  const subscriptionLabels: Record<string, string> = {
    plata: 'Plata',
    oro: 'Oro',
    premium: 'Premium',
    profesional: 'Profesional',
    basico: 'B\u00e1sico',
    pending: 'Pendiente',
  };

  const getSubscriptionLabel = (type: string) => subscriptionLabels[type] || 'Sin plan';

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={[styles.header, { marginTop: insets.top, paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <User size={24} color={Colors.white} />
            <Text style={styles.headerTitle}>Perfil</Text>
          </View>
          <Text style={styles.headerSubtitle}>Todo sobre vos</Text>
        </View>
        <View style={styles.emptyAuth}>
          <User size={48} color={Colors.textMuted} />
          <Text style={styles.emptyAuthTitle}>Inicia sesion para ver tu perfil</Text>
          <TouchableOpacity style={styles.emptyAuthBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyAuthBtnText}>Iniciar sesion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { marginTop: insets.top, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <User size={24} color={Colors.white} />
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>
        <Text style={styles.headerSubtitle}>Todo sobre vos</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={56} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuario'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.ratingRow}>
              <Star size={16} color={Colors.star} fill={Colors.star} />
              <Text style={styles.ratingText}>{profile?.rating?.toFixed(1) || '5.0'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{myListings.length}</Text>
            <Text style={styles.statLabel}>Avisos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.reviews_count || 0}</Text>
            <Text style={styles.statLabel}>Calificaciones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {getSubscriptionLabel(profile?.subscription_type || 'none')}
            </Text>
            <Text style={styles.statLabel}>Suscripcion</Text>
          </View>
        </View>

        {profile?.subscription_type && profile?.subscription_type !== 'none' && (() => {
          const type = profile?.subscription_type;

          if (type === 'pending') {
            return (
              <View style={styles.subscriptionInfo}>
                <Text style={[styles.subscriptionLabel, { color: Colors.warning }]}>
                  Pendiente — Pago en proceso
                </Text>
              </View>
            );
          }

          const expiresAt = profile?.subscription_expires_at;
          const expDate = expiresAt ? new Date(expiresAt) : null;
          const now = Date.now();
          const isExpired = expDate && expDate.getTime() < now;
          const diffDays = expDate ? Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24)) : null;
          const isExpiringSoon = !isExpired && diffDays !== null && diffDays <= 7;
          const formattedDate = expDate?.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          return (
            <>
              <View style={styles.subscriptionInfo}>
                {expDate ? (
                  <View style={styles.subscriptionRow}>
                    <Text style={[styles.subscriptionLabel, isExpired && { color: Colors.error }]}>
                      {isExpired ? `Vencida el ${formattedDate}` : `Vence: ${formattedDate}`}
                    </Text>
                    {isExpiringSoon && <Text style={styles.warningBadge}>Vence pronto</Text>}
                    {isExpired && <Text style={styles.expiredBadge}>Vencida</Text>}
                  </View>
                ) : (
                  <Text style={styles.subscriptionLabel}>Sin fecha de vencimiento</Text>
                )}
              </View>

              {!isExpired && (
                <>
                  <TouchableOpacity
                    style={styles.syncBtn}
                    onPress={handleSyncSubscription}
                    disabled={syncing}>
                    <RefreshCw size={14} color={Colors.primary} />
                    <Text style={styles.syncBtnText}>
                      {syncing ? 'Verificando...' : 'Verificar suscripción'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription}>
                    <Text style={styles.cancelBtnText}>Cancelar suscripción</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          );
        })()}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/plans')}>
            <Crown size={20} color={Colors.gold} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Ver planes</Text>
              <Text style={styles.actionSub}>Mejora tu visibilidad</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/settings')}>
            <Settings size={20} color={Colors.textSecondary} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Configuracion</Text>
              <Text style={styles.actionSub}>Cuenta y preferencias</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis publicaciones</Text>
            <TouchableOpacity onPress={() => router.push('/publish')}>
              <View style={styles.addBtn}>
                <Plus size={14} color={Colors.primary} />
                <Text style={styles.addBtnText}>Nuevo</Text>
              </View>
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <View style={styles.listingsGrid}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} variant="compact" />)}
            </View>
          ) : myListings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyListingsText}>No tenes publicaciones activas</Text>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {myListings.map(item => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  variant="compact"
                  onEdit={() => handleCardAction(item.id)}
                  onDelete={() => handleCardAction(item.id)}
                />
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </ScrollView>

      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        options={[
          { label: 'Editar', icon: <Edit3 size={20} color={Colors.text} />, action: handleEditFromProfile },
          { label: 'Eliminar', icon: <Trash2 size={20} color={Colors.error} />, destructive: true, action: handleDeleteFromProfile },
        ]}
      />

      <BottomSheetDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        icon={<Trash2 size={28} color={Colors.error} />}
        title="Eliminar aviso"
        message="Se eliminaran las imagenes y el aviso dejara de ser visible. Esta accion no se puede deshacer."
        primaryLabel="Eliminar"
        primaryAction={handleConfirmDelete}
        secondaryLabel="Cancelar"
        destructiveSecondary
      />

      <Modal visible={showCancelModal} transparent animationType="fade">
        <Pressable style={styles.cancelModalOverlay} onPress={() => !isCancelling && setShowCancelModal(false)}>
          <Pressable style={styles.cancelModalContent} onPress={() => {}}>
            {isCancelling ? (
              <>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.cancelModalLoadingText}>Cancelando suscripción...</Text>
              </>
            ) : (
              <>
                <Text style={styles.cancelModalTitle}>Cancelar suscripción</Text>
                <Text style={styles.cancelModalMessage}>
                  ¿Estás seguro? Tu suscripción se cancelará y perderás los beneficios de visibilidad.
                </Text>
                <TouchableOpacity style={styles.cancelModalConfirmBtn} onPress={confirmCancel}>
                  <Text style={styles.cancelModalConfirmText}>Cancelar suscripción</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelModalBackBtn} onPress={() => setShowCancelModal(false)}>
                  <Text style={styles.cancelModalBackText}>Volver</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, padding: 16, borderRadius: 16, marginTop: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.white },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  profileEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: Colors.star },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  actions: { gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: 16, gap: 12 },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  actionSub: { fontSize: 12, color: Colors.textMuted },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  listingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emptyListings: { padding: 20, alignItems: 'center' },
  emptyListingsText: { fontSize: 14, color: Colors.textMuted },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyAuthBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.error },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  subscriptionInfo: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  subscriptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subscriptionLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  warningBadge: { fontSize: 12, fontWeight: '700', color: Colors.warning, marginLeft: 8 },
  expiredBadge: { fontSize: 12, fontWeight: '700', color: Colors.error, marginLeft: 8 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary },
  syncBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.error },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  cancelModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  cancelModalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  cancelModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  cancelModalMessage: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  cancelModalConfirmBtn: { backgroundColor: Colors.error, paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%', marginBottom: 10 },
  cancelModalConfirmText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  cancelModalBackBtn: { backgroundColor: Colors.borderLight, paddingVertical: 12, borderRadius: 14, alignItems: 'center', width: '100%' },
  cancelModalBackText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  cancelModalLoadingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16, textAlign: 'center' },
});
