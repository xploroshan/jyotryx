import { memo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ApiError } from '@myastro360/shared';
import { useI18nStore } from '@/store/i18n';
import { Screen, Muted } from '@/components/ui';
import { streamChat, sendMessage, type ChatRequestBody } from './api';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CATEGORIES = ['general', 'kundli', 'career', 'relationship', 'remedy', 'wealth', 'health', 'numerology'];

let counter = 0;
const nextId = () => `m${++counter}`;

/** Memoized bubble — FlashList row (§6: no inline components in list rows). */
const MessageBubble = memo(function MessageBubble({ item, sending }: { item: Msg; sending: boolean }) {
  const isUser = item.role === 'user';
  return (
    <View
      testID={isUser ? 'chat-user' : 'chat-assistant'}
      className={`max-w-[85%] mb-2 rounded-2xl px-4 py-2.5 ${
        isUser ? 'self-end bg-accent' : 'self-start bg-surface border border-border'
      }`}
    >
      <Text className={isUser ? 'text-fg-onaccent' : 'text-fg'}>{item.content || (sending ? '…' : '')}</Text>
    </View>
  );
});

/**
 * Chat with the astrologer. Streams the reply via POST /chat/stream (expo/fetch)
 * and falls back to POST /chat/message on any stream failure. Persists the
 * session id across turns; a "credit" error surfaces an inline upgrade note.
 * (An astrologer-persona roster is deferred; the category selector covers v1.)
 */
export function ChatScreen() {
  const router = useRouter();
  const locale = useI18nStore((s) => s.locale);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [creditNote, setCreditNote] = useState(false);
  const sessionId = useRef<string | null>(null);
  const listRef = useRef<FlashList<Msg>>(null);

  const patch = (id: string, fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  const finishError = (id: string, message: string) => {
    // Show the tap-to-pricing note for any paywall message. Matching only
    // 'credit' missed the subscription-model limit copy ("Subscribe…", "…this
    // cycle"), so meter-mode users never saw the CTA.
    if (/credit|subscribe|cycle/.test(message.toLowerCase())) setCreditNote(true);
    patch(id, (m) => ({ ...m, content: m.content || message || 'Something went wrong.' }));
    setSending(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setCreditNote(false);
    setInput('');
    const userMsg: Msg = { id: nextId(), role: 'user', content: text };
    const asstId = nextId();
    setMessages((prev) => [...prev, userMsg, { id: asstId, role: 'assistant', content: '' }]);
    setSending(true);

    const body: ChatRequestBody = { message: text, sessionId: sessionId.current, category, locale };

    let sawAnyToken = false;
    try {
      await streamChat(body, {
        onToken: (chunk) => {
          sawAnyToken = true;
          patch(asstId, (m) => ({ ...m, content: m.content + chunk }));
        },
        onDone: ({ sessionId: sid }) => {
          if (sid) sessionId.current = sid;
          setSending(false);
        },
        onError: (msg) => finishError(asstId, msg),
      });
    } catch {
      // Streaming transport failed. Only fall back to the non-streaming endpoint
      // if NOTHING streamed yet — if tokens already arrived, the server has
      // already processed (and charged for) this message, so re-sending would
      // double-charge and duplicate the turn.
      if (sawAnyToken) {
        finishError(asstId, 'The connection dropped mid-reply. Please check the response before retrying.');
      } else {
        try {
          const res = await sendMessage(body);
          sessionId.current = res.session.id;
          patch(asstId, (m) => ({ ...m, content: res.reply.content }));
          setSending(false);
        } catch (e) {
          finishError(asstId, e instanceof ApiError ? e.message : 'Unable to reach the astrologer.');
        }
      }
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="py-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  testID={`chat-category-${c}`}
                  onPress={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full border ${category === c ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'}`}
                >
                  <Text className={`text-xs capitalize ${category === c ? 'text-accent' : 'text-fg-muted'}`}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="flex-1">
          {messages.length === 0 ? (
            <View className="items-center mt-10">
              <Text className="text-3xl mb-2">💬</Text>
              <Muted>Ask your astrologer anything.</Muted>
            </View>
          ) : (
            <FlashList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <MessageBubble item={item} sending={sending} />}
              estimatedItemSize={56}
              contentContainerStyle={{ paddingVertical: 12 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListFooterComponent={
                creditNote ? (
                  <Pressable
                    testID="chat-credit-note"
                    onPress={() => router.push('/pricing')}
                    className="self-start bg-warning-subtle border border-warning/30 rounded-lg px-3 py-2 mt-1"
                  >
                    <Text className="text-xs text-warning">You're out of credits — tap to get more.</Text>
                  </Pressable>
                ) : null
              }
            />
          )}
        </View>

        <View className="flex-row items-end gap-2 py-2">
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Type your question…"
            placeholderTextColor="#807666"
            multiline
            className="flex-1 max-h-28 min-h-11 rounded-2xl border border-border bg-bg px-4 py-2.5 text-fg"
          />
          <Pressable
            testID="chat-send"
            onPress={send}
            disabled={sending || !input.trim()}
            className={`h-11 w-11 rounded-full items-center justify-center bg-accent ${sending || !input.trim() ? 'opacity-50' : ''}`}
          >
            <Text className="text-fg-onaccent text-lg">↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
