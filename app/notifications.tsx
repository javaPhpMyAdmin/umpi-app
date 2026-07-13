import { memo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Star, Clock, MessageCircle, ArrowLeft, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications';
import type { Notification } from '@/types';

// --- Helpers ---

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'review':
      return <Star size={20} color={Colors.star} />;
    case 'message':
      return <MessageCircle size={20} color={Colors.primary} />;
    default:
      return <Clock size={20} color={Colors.secondary} />;
  }
}

// --- Memoized list item ---

type NotificationItemProps = {
  id: string;
  type: Notification['type'];
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  onTap: (id: string, isRead: boolean, data: Record<string, any>) => void;
  onDelete: (id: string, title: string) => void;
  data: Record<string, any>;
};

const NotificationItem = memo(function NotificationItem({
  id,
  type,
  title,
  body,
  is_read,
  created_at,
  onTap,
  onDelete,
  data,
}: NotificationItemProps) {
  return (
    <TouchableOpacity
      style={[styles.notifItem, !is_read && styles.notifUnread]}
      onPress={() => onTap(id, is_read, data)}
      onLongPress={() => onDelete(id, title)}
    >
      <View style={styles.notifIcon}>
        <NotificationIcon type={type} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text
            style={[styles.notifTitle, !is_read && styles.notifTitleUnread]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={styles.notifTime}>{timeAgo(created_at)}</Text>
        </View>
        <Text style={styles.notifBody} numberOfLines={2}>
          {body}
        </Text>
      </View>
      {!is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

// --- Screen ---

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications(user?.id);

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const notifications = data?.pages.flat() ?? [];

  function handleTap(id: string, isRead: boolean, itemData: Record<string, any>) {
    if (!isRead) {
      markAsRead.mutate(id);
    }

    const { listing_id, conversation_id } = itemData ?? {};
    if (conversation_id) {
      router.push(`/chat/${conversation_id}`);
    } else if (listing_id) {
      router.push(`/listing/${listing_id}`);
    }
  }

  function handleDelete(id: string, title: string) {
    setDeleteTarget({ id, title });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteNotification.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleMarkAllAsRead() {
    if (user?.id) {
      markAllAsRead.mutate(user.id);
    }
  }

  function renderItem({ item }: { item: Notification }) {
    return (
      <NotificationItem
        id={item.id}
        type={item.type}
        title={item.title}
        body={item.body}
        is_read={item.is_read}
        created_at={item.created_at}
        data={item.data}
        onTap={handleTap}
        onDelete={handleDelete}
      />
    );
  }

  function renderEmpty() {
    if (isLoading) return <ActivityIndicator style={styles.loader} />;
    return (
      <View style={styles.emptyState}>
        <Bell size={48} color={Colors.border} />
        <Text style={styles.emptyTitle}>Sin notificaciones</Text>
        <Text style={styles.emptySubtitle}>
          Cuando alguien te califique o tu suscripción esté por vencer, te
          avisamos acá
        </Text>
      </View>
    );
  }

  function renderFooter() {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>Todo leído</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteTarget(null)}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Trash2 size={24} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>Eliminar notificación</Text>
            <Text style={styles.modalText}>
              ¿Estás seguro de que querés eliminar{'\n'}
              <Text style={styles.modalBold}>"{deleteTarget?.title}"</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    flexGrow: 1,
  },
  loader: {
    marginTop: 60,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  notifUnread: {
    backgroundColor: '#FFF8F5',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalDelete: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
