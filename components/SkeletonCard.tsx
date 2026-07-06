import { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonCardProps {
  variant?: 'featured' | 'compact' | 'conversation' | 'detail';
  style?: ViewStyle;
}

export function SkeletonCard({ variant = 'featured', style }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const SkeletonBlock = ({ style: blockStyle }: { style: ViewStyle }) => (
    <Animated.View style={[blockStyle, { opacity, backgroundColor: Colors.border }]} />
  );

  if (variant === 'conversation') {
    return (
      <View style={[styles.conversation, style]}>
        <SkeletonBlock style={styles.convAvatar} />
        <View style={styles.convContent}>
          <SkeletonBlock style={styles.convName} />
          <SkeletonBlock style={styles.convSubtitle} />
        </View>
      </View>
    );
  }

  if (variant === 'detail') {
    return (
      <View style={[styles.detailContainer, style]}>
        {/* Image header */}
        <SkeletonBlock style={styles.detailImage} />
        {/* Content area */}
        <View style={styles.detailContent}>
          <SkeletonBlock style={styles.detailTitle} />
          <SkeletonBlock style={styles.detailPrice} />
          <View style={styles.detailMetaRow}>
            <SkeletonBlock style={styles.detailMetaSmall} />
            <SkeletonBlock style={styles.detailMetaSmall} />
            <SkeletonBlock style={styles.detailMetaSmall} />
          </View>
          <View style={styles.detailSectionDivider} />
          <SkeletonBlock style={styles.detailSectionTitle} />
          <SkeletonBlock style={styles.detailLine} />
          <SkeletonBlock style={styles.detailLineMedium} />
          <SkeletonBlock style={styles.detailLineShort} />
          <View style={styles.detailSectionDivider} />
          <SkeletonBlock style={styles.detailSectionTitle} />
          <View style={styles.detailSellerRow}>
            <SkeletonBlock style={styles.detailSellerAvatar} />
            <View style={styles.detailSellerInfo}>
              <SkeletonBlock style={styles.detailSellerName} />
              <SkeletonBlock style={styles.detailSellerMeta} />
            </View>
          </View>
        </View>
        {/* Bottom bar placeholder */}
        <View style={styles.detailBottomBar}>
          <SkeletonBlock style={styles.detailContactBtn} />
        </View>
      </View>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={[styles.compact, style]}>
        <SkeletonBlock style={styles.compactImage} />
        <View style={styles.compactContent}>
          <SkeletonBlock style={styles.compactTitle} />
          <SkeletonBlock style={styles.compactPrice} />
          <SkeletonBlock style={styles.compactMeta} />
        </View>
      </View>
    );
  }

  // featured (default)
  return (
    <View style={[styles.featured, style]}>
      <SkeletonBlock style={styles.featuredImage} />
      <View style={styles.featuredContent}>
        <SkeletonBlock style={styles.featuredTitle} />
        <SkeletonBlock style={styles.price} />
        <SkeletonBlock style={styles.meta} />
      </View>
    </View>
  );
}

const skeletonBase = {
  backgroundColor: Colors.border,
};

const styles = StyleSheet.create({
  // Featured variant
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
    ...skeletonBase,
  },
  featuredContent: {
    padding: 12,
    gap: 8,
  },
  featuredTitle: {
    height: 14,
    width: '85%',
    borderRadius: 6,
    ...skeletonBase,
  },
  price: {
    height: 16,
    width: '50%',
    borderRadius: 6,
    ...skeletonBase,
  },
  meta: {
    height: 12,
    width: '65%',
    borderRadius: 6,
    ...skeletonBase,
  },

  // Compact variant
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
    ...skeletonBase,
  },
  compactContent: {
    padding: 10,
    gap: 6,
  },
  compactTitle: {
    height: 13,
    width: '90%',
    borderRadius: 6,
    ...skeletonBase,
  },
  compactPrice: {
    height: 15,
    width: '45%',
    borderRadius: 6,
    ...skeletonBase,
  },
  compactMeta: {
    height: 11,
    width: '60%',
    borderRadius: 6,
    ...skeletonBase,
  },

  // Detail variant (full-page listing detail skeleton)
  detailContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  detailImage: {
    width: '100%',
    height: 280,
    ...skeletonBase,
  },
  detailContent: {
    padding: 20,
    gap: 10,
    paddingBottom: 120,
  },
  detailTitle: {
    height: 24,
    borderRadius: 6,
    width: '80%',
    ...skeletonBase,
  },
  detailPrice: {
    height: 26,
    borderRadius: 6,
    width: '35%',
    ...skeletonBase,
  },
  detailMetaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  detailMetaSmall: {
    height: 14,
    borderRadius: 6,
    width: 70,
    ...skeletonBase,
  },
  detailSectionDivider: {
    height: 2,
    marginVertical: 8,
  },
  detailSectionTitle: {
    height: 16,
    borderRadius: 6,
    width: '40%',
    ...skeletonBase,
  },
  detailLine: {
    height: 14,
    borderRadius: 4,
    width: '100%',
    ...skeletonBase,
  },
  detailLineMedium: {
    height: 14,
    borderRadius: 4,
    width: '70%',
    ...skeletonBase,
  },
  detailLineShort: {
    height: 14,
    borderRadius: 4,
    width: '50%',
    ...skeletonBase,
  },
  detailSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  detailSellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    ...skeletonBase,
  },
  detailSellerInfo: {
    flex: 1,
    gap: 6,
  },
  detailSellerName: {
    height: 15,
    borderRadius: 6,
    width: '45%',
    ...skeletonBase,
  },
  detailSellerMeta: {
    height: 12,
    borderRadius: 6,
    width: '55%',
    ...skeletonBase,
  },
  detailBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailContactBtn: {
    height: 52,
    borderRadius: 14,
    width: '100%',
    ...skeletonBase,
  },

  // Conversation variant
  conversation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 16,
    gap: 12,
    marginBottom: 8,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    ...skeletonBase,
  },
  convContent: {
    flex: 1,
    gap: 8,
  },
  convName: {
    height: 15,
    width: '40%',
    borderRadius: 6,
    ...skeletonBase,
  },
  convSubtitle: {
    height: 12,
    width: '65%',
    borderRadius: 6,
    ...skeletonBase,
  },
});
