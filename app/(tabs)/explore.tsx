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
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search, SlidersHorizontal, X, Compass, MapPin } from 'lucide-react-native';
import { useTheme, useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import { Listing } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useListingsInfinite } from '@/hooks/useListingsInfinite';
import { useCategories } from '@/hooks/useCategories';

// Sanitiza el input de precio: vacío/NaN/negativo/Infinity → undefined.
// Tolera coma decimal ("1,5" → 1.5). El filtro solo se aplica con números finitos.
function parsePriceInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const result = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(result) || result < 0) return undefined;
  return result;
}

// Bloquea paste basura en los inputs de precio: solo dígitos, coma y punto
function sanitizePriceInput(raw: string): string {
  return raw.replace(/[^\d.,]/g, '');
}

// Estabilizado fuera del componente — evita que FlatList recreé items en cada render
function renderExploreItem({ item, index }: { item: Listing; index: number }) {
  return (
    <View style={staticStyles.gridColumn}>
      <View
        style={[
          staticStyles.gridItem,
          index % 2 === 0
            ? { marginLeft: 16, marginRight: 6 }
            : { marginLeft: 6, marginRight: 16 },
        ]}
      >
        <ListingCard listing={item} variant="compact" style={staticStyles.cardFill} />
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { data: categories = [] } = useCategories();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { isDark } = useTheme();

  const [inputValue, setInputValue] = useState((params.q as string) || '');
  const [debouncedQuery, setDebouncedQuery] = useState(inputValue);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'featured' | 'recent'
  >((params.filter as 'all' | 'featured' | 'recent') || 'all');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>(
    'recent',
  );
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [location, setLocation] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');

  // Debounce de ubicación: espera 400ms tras la última tecla antes de consultar
  // (mismo mecanismo que la web en ExplorePage)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLocation(location), 400);
    return () => clearTimeout(timer);
  }, [location]);

  // Search only on explicit submit (keyboard "search" button or tap)
  const handleSubmit = useCallback(() => {
    if (inputValue.trim().length < 2) {
      setDebouncedQuery('');
      return;
    }
    setDebouncedQuery(inputValue.trim());
    // Dismiss keyboard
    Keyboard.dismiss();
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

  // Precios saneados: el estado del filtro nunca contiene NaN (parsePriceInput
  // devuelve undefined para entradas inválidas, así el filtro se omite)
  const parsedPriceMin = useMemo(() => parsePriceInput(priceMin), [priceMin]);
  const parsedPriceMax = useMemo(() => parsePriceInput(priceMax), [priceMax]);

  // Mín > Máx con ambos válidos: feedback visible en vez de lista vacía muda
  const priceRangeInvalid = useMemo(
    () =>
      parsedPriceMin !== undefined &&
      parsedPriceMax !== undefined &&
      parsedPriceMin > parsedPriceMax,
    [parsedPriceMin, parsedPriceMax],
  );

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isError,
    refetch: refetchExplore,
  } = useListingsInfinite({
    query: debouncedQuery || undefined,
    categoryId: selectedCategoryId,
    priceMin: parsedPriceMin,
    priceMax: parsedPriceMax,
    location: debouncedLocation || undefined,
    filter: typeFilter,
    sortBy,
  });

  useFocusEffect(
    useCallback(() => {
      refetchExplore();
    }, [refetchExplore]),
  );

  // Chips de filtros activos (mismo patrón que ExplorePage en la web)
  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (selectedCategory) {
      const cat = categories.find((c) => c.slug === selectedCategory);
      if (cat) {
        list.push({
          key: 'category',
          label: cat.name,
          onRemove: () => setSelectedCategory(null),
        });
      }
    }
    if (priceMin || priceMax) {
      list.push({
        key: 'price',
        label: `Precio: ${priceMin || '0'} - ${priceMax || '∞'}`,
        onRemove: () => {
          setPriceMin('');
          setPriceMax('');
        },
      });
    }
    if (location) {
      list.push({
        key: 'location',
        label: `Ubicación: ${location}`,
        onRemove: () => {
          setLocation('');
          setDebouncedLocation('');
        },
      });
    }
    return list;
  }, [selectedCategory, categories, priceMin, priceMax, location]);

  const clearAllFilters = useCallback(() => {
    setSelectedCategory(null);
    setPriceMin('');
    setPriceMax('');
    setLocation('');
    setDebouncedLocation('');
    setInputValue('');
    setDebouncedQuery('');
    setTypeFilter('all');
    setSortBy('recent');
  }, []);

  const listings = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const ListHeader = () => (
    <View style={styles.statsBar}>
      <View style={styles.statsRow}>
        {isFetching && !isLoading ? (
          <>
            <ActivityIndicator size={12} color={c.primary} />
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
          <ActivityIndicator size="small" color={c.primary} />
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
    // Error inicial (sin datos previos): estado de error completo con retry
    if (isError && data === undefined) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No se pudieron cargar los avisos</Text>
          <Text style={styles.emptyText}>
            Revisá tu conexión e intentá de nuevo.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => refetchExplore()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
        <View style={styles.headerRow}>
          <Compass size={32} color={c.white} />
          <Text style={styles.headerTitle}>Explorar</Text>
        </View>
        <Text style={styles.headerSubtitle}>Descubre miles de avisos</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar avisos..."
            placeholderTextColor={c.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
          />
          {isFetching && !isLoading && inputValue.length >= 2 && (
            <ActivityIndicator size="small" color={c.primary} style={{ marginRight: 4 }} />
          )}
          {inputValue.length > 0 && (
            <TouchableOpacity onPress={() => { setInputValue(''); setDebouncedQuery(''); }}>
              <X size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={20} color={c.primary} />
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
                    typeFilter === opt.key && {
                      backgroundColor: c.primary,
                    },
                  ]}
                  onPress={() => setTypeFilter(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      typeFilter === opt.key && { color: c.white },
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
                      backgroundColor: c.primary,
                    },
                  ]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === opt.key && { color: c.white },
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
            <Text style={styles.filterLabel}>Precio</Text>
            <View style={styles.priceRangeRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Mín"
                  placeholderTextColor={c.textMuted}
                  value={priceMin}
                  onChangeText={(raw) => setPriceMin(sanitizePriceInput(raw))}
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.priceDash}>-</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Máx"
                  placeholderTextColor={c.textMuted}
                  value={priceMax}
                  onChangeText={(raw) => setPriceMax(sanitizePriceInput(raw))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            {priceRangeInvalid && (
              <Text style={styles.priceErrorText}>
                El precio mínimo no puede ser mayor que el máximo
              </Text>
            )}
          </View>

          <View style={styles.filterDivider} />

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Ubicación</Text>
            <View style={styles.locationRow}>
              <MapPin size={16} color={c.textMuted} />
              <TextInput
                style={styles.locationInput}
                placeholder="Barrio o ciudad"
                placeholderTextColor={c.textMuted}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="words"
              />
              {location.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setLocation('');
                    setDebouncedLocation('');
                  }}
                >
                  <X size={16} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {activeFilters.length > 0 && (
        <View style={styles.activeFiltersBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.activeFiltersRow}>
              {activeFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={styles.activeFilterChip}
                  onPress={filter.onRemove}
                  activeOpacity={0.7}
                >
                  <Text style={styles.activeFilterText}>{filter.label}</Text>
                  <X size={12} color={c.textSecondary} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={clearAllFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.clearAllText}>Limpiar filtros</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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

      {isError && data !== undefined && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            No se pudieron actualizar los resultados.
          </Text>
          <TouchableOpacity
            onPress={() => refetchExplore()}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Text style={styles.errorBannerBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        key={selectedCategory || 'all'}
        data={listings}
        renderItem={renderExploreItem}
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

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    backgroundColor: c.primary,
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
    color: c.white,
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
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text },
  filterBtn: {
    backgroundColor: c.surface,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanel: {
    backgroundColor: c.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
  },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterDivider: {
    height: 1,
    backgroundColor: c.borderLight,
    marginVertical: 10,
  },
  filterChip: {
    backgroundColor: c.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: c.text },
  list: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  categoriesSection: { marginTop: 16, marginBottom: 16, paddingHorizontal: 16 },
  categoryScroll: {},
  categoriesRow: { flexDirection: 'row', gap: 10, paddingRight: 16 },
  priceRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  pricePrefix: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
    marginRight: 2,
  },
  priceInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: c.text },
  priceErrorText: { fontSize: 13, color: c.error, marginTop: 6 },
  priceDash: { fontSize: 13, color: c.textMuted },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  locationInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: c.text },
  activeFiltersBar: { marginHorizontal: 16, marginTop: 12 },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  activeFilterText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  clearAllText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  statsBar: { paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsSearching: {
    fontSize: 13,
    fontWeight: '600',
    color: c.primary,
  },
  statsText: {
    fontSize: 14,
    color: c.textSecondary,
    fontWeight: '600',
  },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 6 },
  emptyText: { fontSize: 15, color: c.textMuted },
  retryBtn: {
    marginTop: 16,
    backgroundColor: c.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: c.white },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: c.error,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: c.white },
  errorBannerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.white,
    textDecorationLine: 'underline',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  footerText: { fontSize: 13, color: c.textMuted },
  footerEnd: { paddingVertical: 20, alignItems: 'center' },
});

// Estilos estáticos sin color usados por renderExploreItem (módulo-level)
const staticStyles = StyleSheet.create({
  gridColumn: { width: '50%' },
  gridItem: { marginBottom: 12 },
  cardFill: { width: '100%' },
});
