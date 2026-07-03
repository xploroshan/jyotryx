import { fetch as expoFetch } from 'expo/fetch';
import Constants from 'expo-constants';
import { endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import type { ChatSendResponse } from '@/features/results/responses.p4';
import { splitSSEEvents, parseSSEBlock } from './sse';

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'https://api.myastro360.com/api';

export interface ChatRequestBody {
  message: string;
  sessionId?: string | null;
  category?: string;
  locale: string;
  astrologerId?: string;
}

export interface StreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (info: { messageId?: string; sessionId?: string }) => void;
  onError: (message: string) => void;
}

/**
 * Stream a chat reply via POST /chat/stream using expo/fetch's streaming body.
 * Accumulates token frames; resolves on the done frame; surfaces error/
 * moderation frames via onError. Throws on transport failure so the caller can
 * fall back to the non-streaming endpoint.
 */
export async function streamChat(body: ChatRequestBody, handlers: StreamHandlers): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const res = await expoFetch(`${apiUrl}${endpoints.chat.stream}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`chat stream failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = splitSSEEvents(buffer);
    buffer = rest;
    for (const block of events) {
      const ev = parseSSEBlock(block);
      if (!ev) continue;
      if (ev.kind === 'token' && ev.content) handlers.onToken(ev.content);
      else if (ev.kind === 'done') return handlers.onDone({ messageId: ev.messageId, sessionId: ev.sessionId });
      else if (ev.kind === 'error' || ev.kind === 'moderation') return handlers.onError(ev.message ?? 'Chat error');
    }
  }
  const tail = parseSSEBlock(buffer);
  if (tail?.kind === 'done') handlers.onDone({ messageId: tail.messageId, sessionId: tail.sessionId });
}

/** Non-streaming fallback (what the web currently uses). */
export function sendMessage(body: ChatRequestBody) {
  return api.post<ChatSendResponse>(endpoints.chat.message, body);
}
