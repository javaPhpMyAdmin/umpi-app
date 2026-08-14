/**
 * LegalDocumentScreen — shared sober shell for the legal document pages
 * (Términos / Política de Privacidad). Keeps the reading layout consistent:
 * header with back button + ScrollView with the document card. Content is
 * the client's literal legal copy — never edited here.
 */
import { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';
import type { LegalSection } from '@/lib/legalContent';

interface LegalDocumentScreenProps {
  /** Short title for the nav header (e.g. 'Términos y Condiciones'). */
  headerTitle: string;
  /** Full document title rendered at the top of the page. */
  title: string;
  /** 'Última actualización: …' line under the document title. */
  updatedAt: string;
  sections: LegalSection[];
}

export default function LegalDocumentScreen({
  headerTitle,
  title,
  updatedAt,
  sections,
}: LegalDocumentScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.pageTitle}>{title}</Text>
            <Text style={styles.updatedAt}>{updatedAt}</Text>
          </View>

          {sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.blocks.map((block, j) =>
                Array.isArray(block) ? (
                  <View key={j} style={styles.bulletList}>
                    {block.map((item, k) => (
                      <View key={k} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text key={j} style={styles.paragraph}>
                    {block}
                  </Text>
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
  },
  updatedAt: {
    fontSize: 13,
    color: c.textMuted,
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 21,
    marginBottom: 10,
  },
  bulletList: {
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: c.primary,
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 21,
  },
});
