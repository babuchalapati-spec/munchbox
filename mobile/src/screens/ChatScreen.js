import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { listMessages, sendMessage } from '../api/messages';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function ChatScreen({ route }) {
  const { orderId, channel = 'customer' } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    const data = await listMessages(orderId, channel);
    setMessages(data);
    return data;
  }, [orderId, channel]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    pollRef.current = setInterval(() => {
      load().catch(() => {});
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setText('');
    try {
      const msg = await sendMessage(orderId, trimmed, channel);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(m) => m._id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.sender?._id === user?.id;
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!isMine && <Text style={styles.senderName}>{item.sender?.name}</Text>}
                <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet. Send delivery instructions here.</Text>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { padding: 12, flexGrow: 1 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 2 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 2 },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
