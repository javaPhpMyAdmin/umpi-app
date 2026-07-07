import { useEffect, useRef, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMessages, useSendMessage } from '@/hooks/useMessages';
import { useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types';
import { showError } from '@/lib/toast';

export default function ChatScreen() {
  const router = useRouter();
  const { id, listingId, otherUserId, otherName: otherNameParam } = useLocalSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [creating, setCreating] = useState(false);

  const isNew = id === 'new';
  const conversationId = isNew ? undefined : (id as string);
  const { data: messages, isLoading } = useMessages(conversationId);
  const sendMutation = useSendMessage();

  // Nombre del otro usuario
  const headerName = useMemo(() => {
    if (isNew) return decodeURIComponent((otherNameParam as string) || 'Usuario');
    if (!messages || !user) return '';
    const other = messages.find(m => m.sender_id !== user.id)?.sender;
    return other?.full_name || 'Chat';
  }, [isNew, otherNameParam, messages, user]);

  // Realtime subscription — solo para conversaciones existentes
  useEffect(() => {
    if (!conversationId) return;
    const sub = supabase
      .channel(`messages-${conversationId}`)
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

      router.replace(`/chat/${conv.id}`);
    } else if (conversationId) {
      sendMutation.mutate({ conversationId, content, senderId: user.id });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isNew ? headerName : (isLoading && !headerName ? 'Cargando usuario...' : headerName)}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
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
          messages.map(msg => {
            const isMe = msg.sender_id === user?.id;
            return (
              <View key={msg.id} style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <Text style={[styles.bubbleText, isMe ? { color: Colors.white } : { color: Colors.text }]}>{msg.content}</Text>
                <Text style={[styles.bubbleTime, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: Colors.textMuted }]}>
                  {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={styles.inputBar}>
        <TextInput style={styles.input} placeholder="Escribe un mensaje..." placeholderTextColor={Colors.textMuted} value={input} onChangeText={setInput} multiline />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Send size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  messages: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '50%', padding: 12, borderRadius: 16 },
  bubbleLeft: { backgroundColor: Colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  skeletonContainer: { gap: 12, paddingTop: 8 },
  skeletonBubble: { width: '55%', height: 48, borderRadius: 16 },
  skeletonLeft: { backgroundColor: Colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  skeletonRight: { backgroundColor: Colors.border, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.borderLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
