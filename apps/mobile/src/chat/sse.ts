/**
 * Pure SSE parsing for the chat stream (POST /chat/stream). Frames are
 * separated by a blank line; each carries one or more `data:` lines whose
 * concatenation is a JSON payload. Kept pure so it's unit-tested without the
 * network.
 *
 * Event kinds (from the backend): token `{content}` (accumulate), done
 * `{messageId, sessionId}`, moderation `{message, blocked:true}`, error
 * `{message, refunded}`.
 */

export interface ChatEvent {
  kind: 'token' | 'done' | 'error' | 'moderation' | 'unknown';
  content?: string;
  messageId?: string;
  sessionId?: string;
  message?: string;
  refunded?: boolean;
}

/** Split a rolling buffer into complete event blocks + the trailing remainder. */
export function splitSSEEvents(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  return { events: parts.filter((p) => p.trim() !== ''), rest };
}

/** Concatenate the `data:` lines of one event block (SSE allows multi-line data). */
export function parseEventData(block: string): string | null {
  const lines = block.split('\n').filter((l) => l.startsWith('data:'));
  if (lines.length === 0) return null;
  return lines.map((l) => l.slice(5).replace(/^ /, '')).join('\n');
}

/** Classify a decoded JSON payload into a typed chat event. */
export function interpretChatEvent(obj: unknown): ChatEvent {
  if (obj == null || typeof obj !== 'object') return { kind: 'unknown' };
  const o = obj as Record<string, unknown>;
  if (typeof o.content === 'string') return { kind: 'token', content: o.content };
  if (o.blocked === true) return { kind: 'moderation', message: typeof o.message === 'string' ? o.message : '' };
  if (o.messageId != null || o.sessionId != null) {
    return { kind: 'done', messageId: o.messageId as string | undefined, sessionId: o.sessionId as string | undefined };
  }
  if (typeof o.message === 'string') return { kind: 'error', message: o.message, refunded: !!o.refunded };
  return { kind: 'unknown' };
}

/** Parse a full event block → typed event (or null if not JSON / no data). */
export function parseSSEBlock(block: string): ChatEvent | null {
  const data = parseEventData(block);
  if (data == null || data === '[DONE]') return null;
  try {
    return interpretChatEvent(JSON.parse(data));
  } catch {
    return null;
  }
}
