import { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [otherName, setOtherName] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchMessages();
    const sub = supabase
      .channel(`messages-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [id]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(*)')
      .eq('conversation_id', id as string)
      .order('created_at', { ascending: true });
    if (data) {
      const msgs = data as Message[];
      setMessages(msgs);
      const other = msgs.find(m => m.sender_id !== user?.id)?.sender;
      if (other) setOtherName(other.full_name || 'Usuario');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: id as string,
      sender_id: user.id,
      content: input.trim(),
    });
    if (error) return;
    setInput('');
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', id as string);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherName || 'Chat'}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id;
          return (
            <View key={msg.id} style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <Text style={[styles.bubbleText, isMe ? { color: Colors.white } : { color: Colors.text }]}>{msg.content}</Text>
              <Text style={[styles.bubbleTime, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: Colors.textMuted }]}>
                {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Inicia la conversacion</Text>
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  messages: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleLeft: { backgroundColor: Colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.borderLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
