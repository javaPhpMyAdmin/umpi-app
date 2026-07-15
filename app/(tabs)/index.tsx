import { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Star,
  Clock,
  ChevronRight,
  Store,
  Bell,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/colors';
import { useListings } from '@/hooks/useListings';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationCount } from '@/hooks/useNotifications';
import { ListingCard } from '@/components/ListingCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SkeletonCard } from '@/components/SkeletonCard';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useNotificationCount(user?.id);

  const { data: listings = [], isLoading: loadingListings, refetch: refetchListings } = useListings();
  const { data: categories = [] } = useCategories();

  useFocusEffect(
    useCallback(() => {
      refetchListings();
    }, [refetchListings]),
  );

  const featured = useMemo(
    () =>
      listings
        .filter((l) => l.is_featured && (l.listing_priority ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.listing_priority ?? 0) - (a.listing_priority ?? 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 6),
    [listings],
  );
  const recent = useMemo(() => {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    return listings
      .filter((l) => new Date(l.created_at) >= fifteenDaysAgo)
      .slice(0, 8);
  }, [listings]);

  const quickCategories = useMemo(
    () => categories.filter(cat => cat.slug !== 'todos' && cat.slug !== 'destacados'),
    [categories]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* marginTop desplaza el header debajo de la status bar; paddingTop mantiene el área naranja igual que antes */}
      <View style={[styles.header, { marginTop: insets.top, paddingTop: 40, paddingBottom: 40 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.logoRow}>
            <Store size={32} color={Colors.white} style={styles.storeIcon} />
            <Text style={styles.logo}>Umpiii</Text>
          </View>
          {user && (
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
            >
              <Bell size={26} color={Colors.white} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.tagline}>
          Todo lo que buscas<Text style={styles.taglineDot}> · </Text>cerca tuyo
        </Text>
      </View>

      <View style={styles.quickSearch}>
        <Text style={styles.quickSearchLabel}>¿Qué estás buscando?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quickCategories.map(cat => (
            <CategoryBadge
              key={cat.id}
              category={cat}
              onPress={() => router.push({ pathname: '/explore', params: { category: cat.slug } })}
            />
          ))}
        </ScrollView>
      </View>

      {loadingListings && listings.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.quickSearchSkeleton}>
            <View style={{ width: 140, height: 14, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 10 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={{ width: 100, height: 32, backgroundColor: Colors.border, borderRadius: 16, marginRight: 8 }} />
              ))}
            </ScrollView>
          </View>
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
        {featured.length === 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Star size={20} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Suscripciones destacadas</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.planBanner} onPress={() => router.push('/plans')}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg' }}
                style={styles.planBannerImage}
              />
              <View style={styles.planBannerOverlay}>
                <Text style={styles.planBannerTitle}>Llega a mas personas</Text>
                <Text style={styles.planBannerSubtitle}>Planes desde $7.000 ARS/mes</Text>
                <View style={styles.planBannerButton}>
                  <Text style={styles.planBannerButtonText}>Ver planes</Text>
                  <ChevronRight size={16} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {featured.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Star size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Destacados</Text>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/featured' })}>
                <Text style={styles.sectionLink}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
              <View style={styles.featuredRow}>
                {featured.map((item) => (
                  <ListingCard key={item.id} listing={item} variant="featured" />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Clock size={20} color={Colors.secondary} />
              <Text style={styles.sectionTitle}>Publicaciones recientes</Text>
            </View>
          </View>
          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <ListingCard key={item.id} listing={item} variant="compact" />
            ))}
          </View>
        </View>

        {featured.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Star size={20} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Suscripciones destacadas</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.planBanner} onPress={() => router.push('/plans')}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg' }}
                style={styles.planBannerImage}
              />
              <View style={styles.planBannerOverlay}>
                <Text style={styles.planBannerTitle}>Llega a mas personas</Text>
                <Text style={styles.planBannerSubtitle}>Planes desde $7.000 ARS/mes</Text>
                <View style={styles.planBannerButton}>
                  <Text style={styles.planBannerButtonText}>Ver planes</Text>
                  <ChevronRight size={16} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  storeIcon: {
    marginRight: 10,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    marginLeft: 0,
  },
  taglineDot: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  quickSearch: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  quickSearchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  quickSearchSkeleton: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  scrollContent: {
    paddingBottom: 24,
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
