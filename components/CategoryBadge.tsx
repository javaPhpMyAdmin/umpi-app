import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { Colors, CategoryColors } from '@/constants/colors';
import { Category } from '@/types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryBadgeProps {
  category: Category;
  isActive?: boolean;
  onPress?: () => void;
  showCount?: boolean;
  variant?: 'badge' | 'card';
}

export function CategoryBadge({ category, isActive, onPress, showCount, variant = 'badge' }: CategoryBadgeProps) {
  const color = (CategoryColors as any)[category.slug] || Colors.primary;

  if (variant === 'card') {
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: `${color}20` }]} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.cardIcon, { backgroundColor: color }]}>
          <CategoryIcon icon={category.icon} size={22} color={Colors.white} />
        </View>
        <Text style={styles.cardName}>{category.name}</Text>
        <Text style={[styles.cardCount, { color }]}>{category.total_count?.toLocaleString() || 0} avisos</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.badge, isActive ? { backgroundColor: color } : { backgroundColor: `${color}20` }]}
      onPress={onPress}
      activeOpacity={0.7}>
      <CategoryIcon icon={category.icon} size={16} color={isActive ? Colors.white : color} />
      <Text style={[styles.badgeText, { color: isActive ? Colors.white : color }]}>{category.name}</Text>
      {showCount && !isActive && (
        <Text style={[styles.badgeCount, { color }]}>({category.total_count || 0})</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 110,
    flex: 1,
    maxWidth: 140,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  cardCount: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
