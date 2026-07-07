import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Category, Listing } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SkeletonCard } from '@/components/SkeletonCard';
import { supabase } from '@/lib/supabase';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState((params.q as string) || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'featured'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
    if (data) setCategories(data as Category[]);
  };

  const fetchListings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('listings')
      .select('*, category:category_id(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setListings(data as Listing[]);
    setLoading(false);
  };

  const filtered = listings.filter(item => {
    const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase()) || (item.description?.toLowerCase() || '').includes(query.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'todos' || item.category?.slug === selectedCategory || item.category?.name === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'featured') return (b.listing_priority || 0) - (a.listing_priority || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
    if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
    return 0;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Explorar</Text>
        <Text style={styles.headerSubtitle}>Descubre miles de avisos</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar avisos..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Ordenar</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'recent', label: 'Recientes' },
                { key: 'featured', label: 'Destacados' },
                { key: 'price_asc', label: 'Precio ↓' },
                { key: 'price_desc', label: 'Precio ↑' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, sortBy === (opt.key as any) && { backgroundColor: Colors.primary }]}
                  onPress={() => setSortBy(opt.key as any)}>
                  <Text style={[styles.filterChipText, sortBy === (opt.key as any) && { color: Colors.white }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <View style={styles.categoriesRow}>
            {categories.map(cat => (
              <CategoryBadge
                key={cat.id}
                category={cat}
                isActive={selectedCategory === cat.slug}
                onPress={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.statsBar}>
          <Text style={styles.statsText}>{sorted.length} avisos encontrados</Text>
        </View>

        <View style={styles.grid}>
          {loading ? (
            <View style={styles.listGrid}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} variant="compact" />)}
            </View>
          ) : (
            <>
              <View style={styles.listGrid}>
                {sorted.map(item => (
                  <ListingCard key={item.id} listing={item} variant="compact" />
                ))}
              </View>
              {sorted.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No se encontraron avisos</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterBtn: { backgroundColor: Colors.surface, padding: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filterPanel: { backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 12 },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { backgroundColor: Colors.borderLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  scrollContent: { paddingBottom: 24 },
  categoryScroll: { marginTop: 16, paddingHorizontal: 16 },
  categoriesRow: { flexDirection: 'row', gap: 10, paddingRight: 16 },
  statsBar: { paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  statsText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  grid: { paddingHorizontal: 16, marginTop: 12 },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
