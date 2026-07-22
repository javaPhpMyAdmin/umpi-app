import {
  StyleSheet,
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useListingReviews, ReviewDisplay } from '@/hooks/useListingReviews';

const starValues = [1, 2, 3, 4, 5];

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {starValues.map((s) => (
        <Star
          key={s}
          size={14}
          color={Colors.star}
          fill={s <= rating ? Colors.star : 'none'}
        />
      ))}
    </View>
  );
}

function ReviewItem({ item }: { item: ReviewDisplay }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.reviewer_avatar ? (
          <Image source={{ uri: item.reviewer_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.reviewer_name || 'U')[0]}
            </Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {item.reviewer_name}
          </Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString('es-AR')}
          </Text>
        </View>
        <StarRating rating={item.rating} />
      </View>

    </View>
  );
}

function EmptyReviews() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Star size={24} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>Sin calificaciones</Text>
      <Text style={styles.emptyDesc}>
        Esta publicación aún no tiene calificaciones
      </Text>
    </View>
  );
}

export default function ReviewsListModal({
  visible,
  onClose,
  listingId,
}: {
  visible: boolean;
  onClose: () => void;
  listingId: string;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const { data: reviews, isLoading } = useListingReviews(
    visible ? listingId : undefined,
  );

  const listHeight = screenHeight * 0.7 - 56;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetOuter}>
          <View style={styles.sheetTouchable}>
            <View
              style={[
                styles.sheet,
                { maxHeight: screenHeight * 0.7 },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleRow}>
                <View style={styles.handle} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  Calificaciones{reviews ? ` (${reviews.length})` : ''}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              {isLoading ? (
                <ActivityIndicator
                  size="large"
                  color={Colors.primary}
                  style={{ marginVertical: 40 }}
                />
              ) : (
                <FlatList
                  data={reviews ?? []}
                  renderItem={({ item }) => <ReviewItem item={item} />}
                  keyExtractor={(r) => r.id}
                  style={{ height: listHeight }}
                  contentContainerStyle={
                    reviews?.length ? styles.list : styles.emptyList
                  }
                  ListEmptyComponent={EmptyReviews}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOuter: {
    width: '88%',
    maxWidth: 420,
  },
  sheetTouchable: {
    width: '100%',
  },
  sheet: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    // Android shadow
    elevation: 12,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  date: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
