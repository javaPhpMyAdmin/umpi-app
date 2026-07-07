import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Star, Settings, Crown, LogOut, User, Plus, ChevronRight, Edit3, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMyListings, useDeleteListing } from '@/hooks/useListings';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import ActionSheet from '@/components/ActionSheet';
import BottomSheetDialog from '@/components/BottomSheetDialog';
import { showError, showSuccess } from '@/lib/toast';
import { useState } from 'react';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { data: myListings = [], isLoading } = useMyListings(user?.id);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteListing();

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

  const getSubscriptionColor = (type: string) => {
    if (type === 'premium') return Colors.premium;
    if (type === 'oro') return Colors.gold;
    if (type === 'plata') return Colors.platinum;
    return Colors.textMuted;
  };

  const getSubscriptionLabel = (type: string) => {
    if (type === 'premium') return 'Premium';
    if (type === 'oro') return 'Oro';
    if (type === 'plata') return 'Plata';
    return 'Sin plan';
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Perfil</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || user?.email || '?')[0].toUpperCase()}</Text>
          </View>
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
            <Text style={[styles.statValue, { color: getSubscriptionColor(profile?.subscription_type || 'none') }]}>
              {getSubscriptionLabel(profile?.subscription_type || 'none')}
            </Text>
            <Text style={styles.statLabel}>Suscripcion</Text>
          </View>
        </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
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
});
