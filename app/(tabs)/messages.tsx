import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, Pressable, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MessageCircle, ArrowRight, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, useArchiveConversation } from '@/hooks/useConversations';
import { SkeletonCard } from '@/components/SkeletonCard';
import { UserAvatar } from '@/components/UserAvatar';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data: conversations, isLoading, refetch } = useConversations(user?.id);
  const archiveMutation = useArchiveConversation();
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const confirmArchive = () => {
    if (!archiveTarget || !user) return;
    archiveMutation.mutate({
      conversationId: archiveTarget.id,
      userId: user.id,
    });
    setArchiveTarget(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Refrescar en background cada vez que se enfoca el tab,
  // pero TanStack Query devuelve caché si aún está fresh
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
          <View style={styles.headerRow}>
            <MessageCircle size={32} color={Colors.white} />
            <Text style={styles.headerTitle}>Mensajes</Text>
          </View>
          <Text style={styles.headerSubtitle}>De la charla al trato</Text>
        </View>
        <View style={styles.emptyAuth}>
          <MessageCircle size={48} color={Colors.textMuted} />
          <Text style={styles.emptyAuthTitle}>Inicia sesion para ver tus mensajes</Text>
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
        <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
          <View style={styles.headerRow}>
            <MessageCircle size={32} color={Colors.white} />
            <Text style={styles.headerTitle}>Mensajes</Text>
          </View>
          <Text style={styles.headerSubtitle}>De la charla al trato</Text>
        </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}>
        {isLoading ? (
          [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} variant="conversation" />)
        ) : !conversations || conversations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tenes conversaciones aun</Text>
            <Text style={styles.emptySubtext}>Contacta a un vendedor desde cualquier aviso</Text>
          </View>
        ) : (
          conversations.map(conv => {
            const otherUserId = conv.user1_id === user?.id ? conv.user2_id : conv.user1_id;
            return (
            <TouchableOpacity key={conv.id} style={styles.conversation} onPress={() => router.push(`/chat/${conv.id}?otherName=${encodeURIComponent(conv.other_user?.full_name || 'Usuario')}&otherUserId=${otherUserId}&otherAvatar=${conv.other_user?.avatar_url ? encodeURIComponent(conv.other_user.avatar_url) : ''}`)} onLongPress={() => setArchiveTarget({ id: conv.id, name: conv.other_user?.full_name || 'Usuario' })} activeOpacity={0.7}>
            <UserAvatar url={conv.other_user?.avatar_url} name={conv.other_user?.full_name} size={44} />
            <View style={styles.convInfo}>
              <View style={styles.convTop}>
                <Text style={styles.convName}>{conv.other_user?.full_name || 'Usuario'}</Text>
                {(conv.unread_count ?? 0) > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{conv.unread_count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.convListing} numberOfLines={1}>{conv.listing?.title || 'Sin titulo'}</Text>
              {conv.last_message?.content && (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {conv.last_message.content}
                </Text>
              )}
            </View>
            <ArrowRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de confirmación para eliminar conversación */}
      <Modal visible={!!archiveTarget} transparent animationType="fade" onRequestClose={() => setArchiveTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setArchiveTarget(null)}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Trash2 size={24} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>Eliminar conversación</Text>
            <Text style={styles.modalText}>
              ¿Eliminar la conversación con{' '}
              <Text style={styles.modalBold}>{archiveTarget?.name}</Text>?
              Solo la vas a eliminar de tu lista, la otra persona no pierde nada.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setArchiveTarget(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmArchive}>
                <Text style={styles.modalDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  scroll: { padding: 16, gap: 8 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyAuthBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  conversation: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: 16, gap: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convName: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  convListing: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  lastMessage: { fontSize: 13, color: Colors.textMuted },
  unreadBadge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontSize: 11, fontWeight: '800', color: Colors.white },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: Colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBold: { fontWeight: '700', color: Colors.text },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.borderLight, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  modalDelete: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.error, alignItems: 'center' },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
