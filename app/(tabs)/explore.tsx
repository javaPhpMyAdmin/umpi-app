import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search, SlidersHorizontal, X, Compass } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Listing } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useListingsInfinite } from '@/hooks/useListingsInfinite';
import { useCategories } from '@/hooks/useCategories';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { data: categories = [] } = useCategories();

  const [inputValue, setInputValue] = useState((params.q as string) || '');
  const [debouncedQuery, setDebouncedQuery] = useState(inputValue);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'featured' | 'recent'
  >((params.filter as 'all' | 'featured' | 'recent') || 'all');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>(
    'recent',
  );
  const [showFilters, setShowFilters] = useState(false);

  // Debounce del input de búsqueda (500ms, mínimo 2 caracteres)
  useEffect(() => {
    if (inputValue.length === 0) {
      setDebouncedQuery('');
      return;
    }
    if (inputValue.length < 2) return; // no buscar con 1 sola letra
    const timer = setTimeout(() => setDebouncedQuery(inputValue), 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Sincronizar category param cuando se navega desde Inicio
  const categoryParam = params.category as string | undefined;
  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  // Mapear slug → ID para el filtro server-side
  const selectedCategoryId = useMemo(() => {
    if (!selectedCategory) return undefined;
    return categories.find((c) => c.slug === selectedCategory)?.id;
  }, [selectedCategory, categories]);

  // Filtrar categorías que no se muestran como badges
  const visibleCategories = useMemo(
    () => categories.filter((cat) => cat.slug !== 'todos'),
    [categories],
  );

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
    refetch: refetchExplore,
  } = useListingsInfinite({
    query: debouncedQuery || undefined,
    categoryId: selectedCategoryId,
    filter: activeFilter,
    sortBy,
  });

  useFocusEffect(
    useCallback(() => {
      refetchExplore();
    }, [refetchExplore]),
  );

  const listings = useMemo(
    () => data?.pages.flatMap((p) => (p as { data: Listing[] }).data) ?? [],
    [data],
  );

  const renderItem = ({ item, index }: { item: Listing; index: number }) => (
    <View style={styles.gridColumn}>
      <View style={[
        styles.gridItem,
        index % 2 === 0
          ? { marginLeft: 16, marginRight: 6 }
          : { marginLeft: 6, marginRight: 16 },
      ]}>
        <ListingCard listing={item} variant="compact" style={styles.cardFill} />
      </View>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.statsBar}>
      <View style={styles.statsRow}>
        {isFetching && !isLoading ? (
          <>
            <ActivityIndicator size={12} color={Colors.primary} />
            <Text style={styles.statsSearching}>Buscando...</Text>
          </>
        ) : (
          <Text style={styles.statsText}>
            {listings.length} aviso{listings.length !== 1 ? 's' : ''} encontrado
            {listings.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </View>
  );

  const ListFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerText}>Cargando más avisos...</Text>
        </View>
      );
    }
    if (!hasNextPage && listings.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerText}>Todos los avisos cargados</Text>
        </View>
      );
    }
    return null;
  };

  const ListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} variant="compact" />
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Error al cargar los avisos. Tira de nuevo.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No se encontraron avisos</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
        <View style={styles.headerRow}>
          <Compass size={32} color={Colors.white} />
          <Text style={styles.headerTitle}>Explorar</Text>
        </View>
        <Text style={styles.headerSubtitle}>Descubre miles de avisos</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar avisos..."
            placeholderTextColor={Colors.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            returnKeyType="search"
          />
          {isFetching && !isLoading && inputValue.length >= 2 && (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
          )}
          {inputValue.length > 0 && (
            <TouchableOpacity onPress={() => setInputValue('')}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Tipo</Text>
            <View style={styles.filterOptions}>
              {([
                { key: 'all', label: 'Todos' },
                { key: 'featured', label: 'Destacados' },
                { key: 'recent', label: 'Recientes' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    activeFilter === opt.key && {
                      backgroundColor: Colors.primary,
                    },
                  ]}
                  onPress={() => setActiveFilter(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeFilter === opt.key && { color: Colors.white },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterDivider} />

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Ordenar</Text>
            <View style={styles.filterOptions}>
              {([
                { key: 'recent', label: 'Más nuevos' },
                { key: 'price_asc', label: 'Precio ↓' },
                { key: 'price_desc', label: 'Precio ↑' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    sortBy === opt.key && {
                      backgroundColor: Colors.primary,
                    },
                  ]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === opt.key && { color: Colors.white },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {selectedCategory && (
        <View style={styles.clearBar}>
          <TouchableOpacity
            style={styles.clearCatBtn}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <X size={14} color={Colors.textSecondary} />
            <Text style={styles.clearCatText}>Limpiar filtro</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          <View style={styles.categoriesRow}>
            {visibleCategories.map((cat) => (
              <CategoryBadge
                key={cat.id}
                category={cat}
                isActive={selectedCategory === cat.slug}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === cat.slug ? null : cat.slug,
                  )
                }
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <FlatList
        key={selectedCategory || 'all'}
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        style={styles.list}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterBtn: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanel: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
  },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  filterChip: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  list: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  categoriesSection: { marginTop: 16, marginBottom: 16, paddingHorizontal: 16 },
  categoryScroll: {},
  categoriesRow: { flexDirection: 'row', gap: 10, paddingRight: 16 },
  clearBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  clearCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  clearCatText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statsBar: { paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsSearching: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  statsText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  gridRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  gridColumn: { width: '50%' },
  gridItem: { marginBottom: 12 },
  cardFill: { width: '100%' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  errorText: { fontSize: 15, color: Colors.error },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  footerText: { fontSize: 13, color: Colors.textMuted },
  footerEnd: { paddingVertical: 20, alignItems: 'center' },
});
