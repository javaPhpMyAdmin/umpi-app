import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Clock, ArrowRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Conversation } from '@/types';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  const fetchConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, listing:listing_id(*), user1:user1_id(*), user2:user2_id(*)')
      .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
      .order('last_message_at', { ascending: false });
    if (data) {
      const convs = (data as any[]).map(c => {
        const other = c.user1_id === user?.id ? c.user2 : c.user1;
        return { ...c, other_user: other } as Conversation;
      });
      setConversations(convs);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mensajes</Text>
        </View>
        <View style={styles.emptyAuth}>
          <MessageCircle size={48} color={Colors.textMuted} />
          <Text style={styles.emptyAuthTitle}>Inicia sesion para ver tus mensajes</Text>
          <TouchableOpacity style={styles.emptyAuthBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyAuthBtnText}>Iniciar sesion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajes</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {conversations.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tenes conversaciones aun</Text>
            <Text style={styles.emptySubtext}>Contacta a un vendedor desde cualquier aviso</Text>
          </View>
        )}
        {conversations.map(conv => (
          <TouchableOpacity key={conv.id} style={styles.conversation} onPress={() => router.push(`/chat/${conv.id}`)} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(conv.other_user?.full_name || '?')[0]}</Text>
            </View>
            <View style={styles.convInfo}>
              <Text style={styles.convName}>{conv.other_user?.full_name || 'Usuario'}</Text>
              <Text style={styles.convListing} numberOfLines={1}>{conv.listing?.title || 'Sin titulo'}</Text>
            </View>
            <ArrowRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  scroll: { padding: 16, gap: 8 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  emptyAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyAuthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyAuthBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyAuthBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  conversation: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: 16, gap: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  convInfo: { flex: 1 },
  convName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  convListing: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
});
