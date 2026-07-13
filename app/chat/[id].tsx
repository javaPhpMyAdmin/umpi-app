import { useEffect, useRef, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated, Image, Keyboard, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMessages, useSendMessage } from '@/hooks/useMessages';
import { useListing } from '@/hooks/useListing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types';
import { showError } from '@/lib/toast';
import { UserAvatar } from '@/components/UserAvatar';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, listingId, otherUserId, otherName: otherNameParam, otherAvatar: otherAvatarParam } = useLocalSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const markedReadRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Android: manejar el teclado manualmente (KeyboardAvoidingView es buggy al cerrar)
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const isNew = id === 'new';
  const conversationId = isNew ? undefined : (id as string);
  const { data: messages, isLoading, refetch } = useMessages(conversationId);
  const sendMutation = useSendMessage();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Obtener el listing_id para conversaciones existentes (con caché de TanStack Query)
  const { data: convListingId } = useQuery({
    queryKey: ['conversation-listing', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data } = await supabase
        .from('conversations')
        .select('listing_id')
        .eq('id', conversationId)
        .maybeSingle();
      return data?.listing_id ?? null;
    },
    enabled: !!conversationId,
    staleTime: 120_000,
  });

  const activeListingId = isNew ? (listingId as string) : convListingId;
  const { data: listing, isLoading: listingLoading } = useListing(activeListingId);

  // Nombre y avatar del otro usuario
  const otherProfile = useMemo(() => {
    if (isNew) return null;
    if (!messages || !user) return null;
    return messages.find(m => m.sender_id !== user.id)?.sender || null;
  }, [isNew, messages, user]);

  const headerName = otherProfile?.full_name
    || decodeURIComponent((otherNameParam as string) || 'Chat');

  // Avatar: usar el perfil de los mensajes si existe, o el pasado por URL para chats nuevos
  const headerAvatarUrl = otherProfile?.avatar_url
    || (otherAvatarParam as string) || null;

  // Marcar como leído al entrar a la conversación (una sola vez)
  useEffect(() => {
    if (!conversationId || !user || markedReadRef.current) return;
    markedReadRef.current = true;
    supabase.rpc('mark_conversation_read', {
      conv_id: conversationId,
      p_user_id: user.id,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    });
  }, [conversationId, user, queryClient]);

  // Realtime subscription — solo para conversaciones existentes
  useEffect(() => {
    if (!conversationId) return;
    // Nombre único por montada para evitar race conditions al salir/volver del mismo chat
    const channelName = `messages-${conversationId}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
          if (!old) return [newMsg];
          const exists = old.some(
            m => m.id === newMsg.id ||
              (m.sender_id === newMsg.sender_id &&
               m.content === newMsg.content &&
               m.id.startsWith('temp-'))
          );
          return exists ? old : [...old, newMsg];
        });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [conversationId, queryClient]);

  const sendMessage = async () => {
    if (!input.trim() || !user || creating) return;
    const content = input.trim();
    setInput('');

    if (isNew) {
      // Crear conversación + primer mensaje atómicamente
      setCreating(true);
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          listing_id: listingId as string,
          user1_id: user.id,
          user2_id: otherUserId as string,
        })
        .select('id')
        .single();

      if (convError || !conv) {
        showError('Error', 'No se pudo iniciar la conversación');
        setCreating(false);
        return;
      }

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content,
      });

      if (msgError) {
        showError('Error', 'No se pudo enviar el mensaje');
        setCreating(false);
        return;
      }

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conv.id);

      router.replace(`/chat/${conv.id}?otherName=${encodeURIComponent(otherNameParam as string || 'Usuario')}&otherUserId=${otherUserId}&otherAvatar=${otherAvatarParam ? encodeURIComponent(otherAvatarParam as string) : ''}`);
    } else if (conversationId) {
      sendMutation.mutate({ conversationId, content, senderId: user.id });
    }
  };

  const messagesContent = (
    <>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}>
        {isNew || !conversationId ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Inicia la conversacion</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.skeletonContainer}>
            <SkeletonBubble align="left" />
            <SkeletonBubble align="right" />
            <SkeletonBubble align="left" />
            <SkeletonBubble align="left" />
          </View>
        ) : !messages || messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Inicia la conversacion</Text>
          </View>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <View key={msg.id} style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
                <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                  <Text style={[styles.bubbleText, isMe ? { color: Colors.white } : { color: Colors.text }]}>{msg.content}</Text>
                  <Text style={[styles.bubbleTime, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: Colors.textMuted }]}>
                    {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        <TextInput style={styles.input} placeholder="Escribe un mensaje..." placeholderTextColor={Colors.textMuted} value={input} onChangeText={setInput} multiline />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Send size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Header fuera del KeyboardAvoidingView — siempre estático */}
      <View style={[styles.header, { marginTop: insets.top, paddingTop: insets.top + 12, paddingBottom: 28, paddingHorizontal: 20 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {isLoading && !otherProfile ? (
            <SkeletonHeader />
          ) : (
            <>
              <UserAvatar
                url={headerAvatarUrl}
                name={headerName}
                size={32}
                backgroundColor="rgba(255,255,255,0.25)"
              />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isNew ? headerName : (isLoading && !headerName ? 'Cargando usuario...' : headerName)}
              </Text>
            </>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      {listingLoading ? (
        <View style={styles.listingHeader}>
          <View style={[styles.listingImage, styles.skeletonBlock]} />
          <View style={styles.listingInfo}>
            <View style={[styles.skelTitle, styles.skeletonBlock]} />
            <View style={[styles.skelPrice, styles.skeletonBlock]} />
          </View>
        </View>
      ) : listing ? (
        <TouchableOpacity style={styles.listingHeader} onPress={() => router.push(`/listing/${listing.id}`)} activeOpacity={0.7}>
          <Image source={{ uri: listing.images?.[0] || '' }} style={styles.listingImage} />
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.listingPrice}>
              {listing.price ? `$${listing.price.toLocaleString('es-AR')}` : 'Consultar'}
            </Text>
          </View>
          {listing.status !== 'active' && (
            <View style={styles.deletedBadge}>
              <Text style={styles.deletedBadgeText}>Eliminado</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {/* Area de mensajes + input — plataforma-especifico para el teclado */}
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding" keyboardVerticalOffset={0}>
          {messagesContent}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.keyboardArea}>
          {messagesContent}
          <View style={{ height: keyboardHeight }} />
        </View>
      )}
    </View>
  );
}

function SkeletonBubble({ align }: { align: 'left' | 'right' }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBubble,
        align === 'right' ? styles.skeletonRight : styles.skeletonLeft,
        { opacity },
      ]}
    />
  );
}

function SkeletonHeader() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonHeaderRow}>
      <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
      <Animated.View style={[styles.skeletonHeaderTitle, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, flexShrink: 1 },
  skeletonHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skeletonAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)' },
  skeletonHeaderTitle: { width: 120, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)' },
  listingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  listingImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.borderLight },
  listingInfo: { flex: 1, gap: 4 },
  listingTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  listingPrice: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 1 },
  skeletonBlock: { backgroundColor: Colors.borderLight },
  skelTitle: { width: '70%', height: 14, borderRadius: 6 },
  skelPrice: { width: '40%', height: 12, borderRadius: 6 },
  deletedBadge: { backgroundColor: Colors.error + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  deletedBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.error },
  messages: { padding: 16, gap: 8, flexGrow: 1 },
  messageRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', maxWidth: '80%' },
  messageRowLeft: { alignSelf: 'flex-start' },
  messageRowRight: { alignSelf: 'flex-end' },
  bubble: { maxWidth: '100%', padding: 12, borderRadius: 16 },
  bubbleLeft: { backgroundColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  skeletonContainer: { gap: 12, paddingTop: 8 },
  skeletonBubble: { width: '55%', height: 48, borderRadius: 16 },
  skeletonLeft: { backgroundColor: Colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  skeletonRight: { backgroundColor: Colors.border, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.borderLight, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.text, maxHeight: 120, lineHeight: 20 },
  sendBtn: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
