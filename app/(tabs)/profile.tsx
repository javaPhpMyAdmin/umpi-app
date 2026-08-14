import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Settings, Crown, LogOut, User, Plus, ChevronRight, Edit3, Trash2, Camera, BadgeCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMyListings, useDeleteListing } from '@/hooks/useListings';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { UserAvatar } from '@/components/UserAvatar';
import ActionSheet from '@/components/ActionSheet';
import BottomSheetDialog from '@/components/BottomSheetDialog';
import { showError, showSuccess } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/upload';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { hasActiveBenefits, isInTrial, hasPaidPlan } from '@/lib/subscription';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { data: myListings = [], isLoading, refetch: refetchMyListings } = useMyListings(user?.id);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteListing();
  const [totalViews, setTotalViews] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Fetch total views (fire-and-forget: errores de red no deben romper nada)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await supabase.rpc('get_user_views', { p_user_id: user.id });
        if (data != null) setTotalViews(data as number);
      } catch {
        // offline / RPC caido: dejar el contador en 0
      }
    })();
  }, [user?.id]);

  // Refresh profile and listings every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshProfile();
        refetchMyListings();
      }
    }, [user, refetchMyListings]),
  );

  // Avatar upload — paridad web (AccountSettingsPage): picker → uploadAvatar
  // (path fijo {userId}/avatar.webp en bucket `avatars`) → update profile.
  const handleAvatarPress = async () => {
    if (!user || uploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('Permiso requerido', 'Necesitamos acceso a tu galeria para seleccionar una foto');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(result.assets[0].uri, user.id);
      // Cache-buster: el path fijo {userId}/avatar.webp produce la MISMA URL
      // en cada re-upload y React Native cachea por URL — sin el ?v= el Image
      // seguiria mostrando la foto vieja hasta evictar cache.
      const avatarUrl = `${publicUrl}?v=${Date.now()}`;
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess('Exito', 'Foto de perfil actualizada');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir la foto';
      showError('Error', msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

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

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
          <View style={styles.headerRow}>
            <User size={32} color={c.white} />
            <Text style={styles.headerTitle}>Perfil</Text>
          </View>
          <Text style={styles.headerSubtitle}>Todo sobre vos</Text>
        </View>
        <View style={styles.emptyAuth}>
          <User size={48} color={c.textMuted} />
          <Text style={styles.emptyAuthTitle}>Inicia sesion para ver tu perfil</Text>
          <TouchableOpacity style={styles.emptyAuthBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyAuthBtnText}>Iniciar sesion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isVerified = hasPaidPlan(profile) || isInTrial(profile);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
          <View style={styles.headerRow}>
            <User size={32} color={c.white} />
            <Text style={styles.headerTitle}>Perfil</Text>
          </View>
          <Text style={styles.headerSubtitle}>Todo sobre vos</Text>
        </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={56} />
            {/* Camera badge — affordance para cambiar la foto */}
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={c.white} />
              ) : (
                <Camera size={12} color={c.white} />
              )}
            </View>
            {/* Badge Vendedor Verificado — paridad web (subscription_type === 'premium') */}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={14} color={c.white} fill={c.white} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuario'}</Text>
            {/* Premium Trial Badge */}
            {profile?.subscription_status === 'trial' && profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date() && (
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>🔬 Premium Trial</Text>
              </View>
            )}
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.ratingRow}>
              {profile?.rating != null ? (
                <>
                  <Star size={16} color={c.star} fill={c.star} />
                  <Text style={styles.ratingText}>{profile.rating.toFixed(1)}</Text>
                </>
              ) : (
                <Text style={[styles.ratingText, { color: c.textMuted }]}>Sin calificaciones aún</Text>
              )}
            </View>
            {/* Miembro desde — paridad web (mismo formato es-AR) */}
            <Text style={styles.memberSince}>
              Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Reciente'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalViews.toLocaleString('es-AR')}</Text>
            <Text style={styles.statLabel}>Vistas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{myListings.length}</Text>
            <Text style={styles.statLabel}>Avisos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.reviews_count || 0}</Text>
            <Text style={styles.statLabel}>Calificaciones</Text>
          </View>
        </View>

        {hasActiveBenefits(profile) && (() => {
          const isPaidPlan = hasPaidPlan(profile);
          const isTrialActive = isInTrial(profile);

          if (isTrialActive) {
            return (
              <View style={styles.subscriptionInfo}>
                <View style={styles.subscriptionRow}>
                  <Text style={[styles.subscriptionLabel, { color: c.success }]}>
                    Premium Trial activo
                  </Text>
                </View>
              </View>
            );
          }

          if (!isPaidPlan) return null;

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
            <View style={styles.subscriptionInfo}>
              {expDate ? (
                <View style={styles.subscriptionRow}>
                  <Text style={[styles.subscriptionLabel, isExpired && { color: c.error }]}>
                    {isExpired ? `Vencida el ${formattedDate}` : `Vence: ${formattedDate}`}
                  </Text>
                  {isExpiringSoon && <Text style={styles.warningBadge}>Vence pronto</Text>}
                  {isExpired && <Text style={styles.expiredBadge}>Vencida</Text>}
                </View>
              ) : (
                <Text style={styles.subscriptionLabel}>Sin fecha de vencimiento</Text>
              )}
            </View>
          );
        })()}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/plans')}>
            <Crown size={20} color={c.gold} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Ver planes</Text>
              <Text style={styles.actionSub}>Mejora tu visibilidad</Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/settings')}>
            <Settings size={20} color={c.textSecondary} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Configuracion</Text>
              <Text style={styles.actionSub}>Cuenta y preferencias</Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis publicaciones</Text>
            <TouchableOpacity onPress={() => router.push('/publish')}>
              <View style={styles.addBtn}>
                <Plus size={14} color={c.primary} />
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
          <LogOut size={18} color={c.error} />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </ScrollView>

      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        options={[
          { label: 'Editar', icon: <Edit3 size={20} color={c.text} />, action: handleEditFromProfile },
          { label: 'Eliminar', icon: <Trash2 size={20} color={c.error} />, destructive: true, action: handleDeleteFromProfile },
        ]}
      />

      <BottomSheetDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        icon={<Trash2 size={28} color={c.error} />}
        title="Eliminar aviso"
        message="Se eliminaran las imagenes y el aviso dejara de ser visible. Esta accion no se puede deshacer."
        primaryLabel="Eliminar"
        primaryAction={handleConfirmDelete}
        secondaryLabel="Cancelar"
        destructiveSecondary
      />
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { backgroundColor: c.primary, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: c.white },
  headerSubtitle: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  scroll: { padding: 16, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.surface, padding: 16, borderRadius: 16, marginTop: 8 },
  avatarWrap: { position: 'relative' },
  cameraBadge: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: c.secondary, borderWidth: 2, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: c.text },
  trialBadge: { backgroundColor: c.success + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginTop: 4 },
  trialBadgeText: { fontSize: 12, fontWeight: '700', color: c.success },
  profileEmail: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: c.star },
  memberSince: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: c.text },
  statLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: c.border },
  actions: { gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, padding: 14, borderRadius: 16, gap: 12 },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  actionSub: { fontSize: 12, color: c.textMuted },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, color: c.primary, fontWeight: '600' },
  listingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emptyListings: { padding: 20, alignItems: 'center' },
  emptyListingsText: { fontSize: 14, color: c.textMuted },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: c.text },
  emptyAuthBtn: { backgroundColor: c.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: c.white, fontWeight: '700', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.error },
  logoutText: { fontSize: 15, fontWeight: '700', color: c.error },
  subscriptionInfo: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  subscriptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subscriptionLabel: { fontSize: 13, color: c.textSecondary, flex: 1 },
  warningBadge: { fontSize: 12, fontWeight: '700', color: c.warning, marginLeft: 8 },
  expiredBadge: { fontSize: 12, fontWeight: '700', color: c.error, marginLeft: 8 },
});
