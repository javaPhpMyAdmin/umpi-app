import { StyleSheet, TouchableOpacity, View, Text, Image, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Star, MessageCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Listing } from '@/types';

interface ListingCardProps {
  listing: Listing;
  variant?: 'featured' | 'compact';
  style?: ViewStyle;
}

export function ListingCard({ listing, variant = 'featured', style }: ListingCardProps) {
  const router = useRouter();
  const isCompact = variant === 'compact';
  const image = listing.images?.[0] || listing.category?.image_url || '';

  const formatPrice = (price: number | null) => {
    if (!price) return 'Consultar';
    return `$${price.toLocaleString('es-AR')}`;
  };

  return (
    <TouchableOpacity
      style={[isCompact ? styles.compact : styles.featured, style]}
      onPress={() => router.push(`/listing/${listing.id}`)}
      activeOpacity={0.8}>
      <Image source={{ uri: image }} style={isCompact ? styles.compactImage : styles.featuredImage} />
      {listing.is_featured && (
        <View style={styles.featuredBadge}>
          <Star size={12} color={Colors.gold} fill={Colors.gold} />
          <Text style={styles.featuredBadgeText}>Destacado</Text>
        </View>
      )}
      <View style={isCompact ? styles.compactContent : styles.featuredContent}>
        <Text style={isCompact ? styles.compactTitle : styles.featuredTitle} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatPrice(listing.price)}</Text>
        <View style={styles.metaRow}>
          {listing.location && (
            <View style={styles.metaItem}>
              <MapPin size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{listing.location}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Star size={12} color={Colors.star} fill={Colors.star} />
            <Text style={styles.metaText}>{listing.rating}</Text>
          </View>
        </View>
        {listing.user && (
          <View style={styles.userRow}>
            <Text style={styles.userName}>{listing.user.full_name || 'Usuario'}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  featured: {
    width: 220,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  featuredImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  featuredContent: {
    padding: 12,
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 18,
  },
  compact: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  compactImage: {
    width: '100%',
    height: 110,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  compactContent: {
    padding: 10,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 16,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  userRow: {
    marginTop: 6,
  },
  userName: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  featuredBadgeText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '600',
  },
});
