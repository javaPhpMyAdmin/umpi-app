import { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  Star,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useListings } from '@/hooks/useListings';
import { useCategories } from '@/hooks/useCategories';
import { ListingCard } from '@/components/ListingCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SkeletonCard } from '@/components/SkeletonCard';

export default function HomeScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: listings = [], isLoading: loadingListings } = useListings();
  const { data: categories = [] } = useCategories();

  const featured = useMemo(
    () =>
      [...listings]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 6),
    [listings]
  );
  const recent = useMemo(() => listings.slice(0, 8), [listings]);

  const filteredFeatured = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'todos') return featured;
    return [...listings]
      .filter(
        (l) =>
          l.category?.slug === selectedCategory ||
          l.category?.name === selectedCategory
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  }, [listings, selectedCategory, featured]);

  const filteredRecent = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'todos') return recent;
    return listings
      .filter(
        (l) =>
          l.category?.slug === selectedCategory ||
          l.category?.name === selectedCategory
      )
      .slice(0, 8);
  }, [listings, selectedCategory, recent]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/explore', params: { q: searchQuery } });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Umpi</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar servicios, autos, propiedades..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {loadingListings && listings.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.searchContainer}>
            <SkeletonCard variant="compact" style={{ width: '100%', height: 44, borderRadius: 14, marginTop: -18 }} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
          >
            <View style={styles.categoriesRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={{ width: 80, height: 32, backgroundColor: Colors.border, borderRadius: 16 }} />
              ))}
            </View>
          </ScrollView>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 140, height: 18, backgroundColor: Colors.border, borderRadius: 4 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
              <View style={styles.featuredRow}>
                {[1, 2, 3].map(i => <SkeletonCard key={i} variant="featured" />)}
              </View>
            </ScrollView>
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 160, height: 18, backgroundColor: Colors.border, borderRadius: 4 }} />
            </View>
            <View style={styles.recentGrid}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} variant="compact" />)}
            </View>
          </View>
        </ScrollView>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          <View style={styles.categoriesRow}>
            {categories.map((cat) => (
              <CategoryBadge
                key={cat.id}
                category={cat}
                isActive={selectedCategory === cat.slug}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === cat.slug ? null : cat.slug
                  )
                }
              />
            ))}
          </View>
        </ScrollView>

        {selectedCategory && (
          <View style={styles.filterInfo}>
            <Text style={styles.filterText}>
              Filtrando por:{' '}
              {categories.find((c) => c.slug === selectedCategory)?.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedCategory(null)}>
              <Text style={styles.filterClear}>Limpiar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <TrendingUp size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Mas populares</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/explore',
                  params: { featured: 'true' },
                })
              }
            >
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.featuredScroll}
          >
            <View style={styles.featuredRow}>
              {filteredFeatured.map((item) => (
                <ListingCard key={item.id} listing={item} variant="featured" />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Clock size={20} color={Colors.secondary} />
              <Text style={styles.sectionTitle}>Publicaciones recientes</Text>
            </View>
          </View>
          <View style={styles.recentGrid}>
            {filteredRecent.map((item) => (
              <ListingCard key={item.id} listing={item} variant="compact" />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Star size={20} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Suscripciones destacadas</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.planBanner}
            onPress={() => router.push('/plans')}
          >
            <Image
              source={{
                uri: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg',
              }}
              style={styles.planBannerImage}
            />
            <View style={styles.planBannerOverlay}>
              <Text style={styles.planBannerTitle}>Llega a mas personas</Text>
              <Text style={styles.planBannerSubtitle}>
                Planes desde $7.000 ARS/mes
              </Text>
              <View style={styles.planBannerButton}>
                <Text style={styles.planBannerButtonText}>Ver planes</Text>
                <ChevronRight size={16} color={Colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: -18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  categoriesScroll: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 16,
  },
  filterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
  },
  filterText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  filterClear: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionLink: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  featuredScroll: {
    marginHorizontal: -16,
  },
  featuredRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
    position: 'relative',
  },
  planBannerImage: {
    width: '100%',
    height: '100%',
  },
  planBannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  planBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  planBannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  planBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  planBannerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

});
