import { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Listing } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useListingsInfinite } from '@/hooks/useListingsInfinite';

export default function FeaturedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
    refetch,
  } = useListingsInfinite({
    filter: 'featured',
    sortBy: 'recent',
  });

  const listings = useMemo(
    () => data?.pages.flatMap((p) => (p as { data: Listing[] }).data) ?? [],
    [data],
  );

  const renderItem = ({ item, index }: { item: Listing; index: number }) => (
    <View style={styles.gridColumn}>
      <View
        style={[
          styles.gridItem,
          index % 2 === 0
            ? { marginLeft: 16, marginRight: 6 }
            : { marginLeft: 6, marginRight: 16 },
        ]}
      >
        <ListingCard listing={item} variant="compact" style={styles.cardFill} />
      </View>
    </View>
  );

  const ListHeader = () => (
    <>
      {error && listings.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            Error al actualizar. Tira pull-to-refresh para reintentar.
          </Text>
        </View>
      ) : null}
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
    </>
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
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonColumn}>
              <View
                style={[
                  styles.skeletonItem,
                  i % 2 === 0
                    ? { marginRight: 6 }
                    : { marginLeft: 6 },
                ]}
              >
                <SkeletonCard variant="compact" />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Error al cargar los avisos. Tira de pull-to-refresh.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Star size={48} color={Colors.textMuted} style={{ marginBottom: 16 }} />
        <Text style={styles.emptyTitle}>No hay avisos destacados</Text>
        <Text style={styles.emptySubtitle}>
          Los avisos destacados aparecen acá cuando los usuarios suscriben un plan.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/plans')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Ver planes</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Destacados</Text>
      </View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        style={styles.list}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isFetching) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  list: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
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
  gridColumn: { width: '50%' },
  gridItem: { marginBottom: 12 },
  cardFill: { width: '100%' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  skeletonColumn: { width: '50%' },
  skeletonItem: { marginBottom: 12 },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyText: { fontSize: 15, color: Colors.textMuted },
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
