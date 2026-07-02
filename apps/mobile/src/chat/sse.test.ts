import { splitSSEEvents, parseEventData, interpretChatEvent, parseSSEBlock } from './sse';

describe('splitSSEEvents', () => {
  it('yields complete events and keeps the trailing partial in rest', () => {
    const { events, rest } = splitSSEEvents('data: {"content":"He"}\n\ndata: {"content":"llo"}\n\ndata: {"conte');
    expect(events).toEqual(['data: {"content":"He"}', 'data: {"content":"llo"}']);
    expect(rest).toBe('data: {"conte');
  });
});

describe('parseEventData', () => {
  it('strips the data: prefix and joins multi-line data', () => {
    expect(parseEventData('data: {"a":1}')).toBe('{"a":1}');
    expect(parseEventData('data: line1\ndata: line2')).toBe('line1\nline2');
    expect(parseEventData('event: ping')).toBeNull();
  });
});

describe('interpretChatEvent', () => {
  it('classifies token / done / moderation / error', () => {
    expect(interpretChatEvent({ content: 'hi' })).toEqual({ kind: 'token', content: 'hi' });
    expect(interpretChatEvent({ messageId: 'm1', sessionId: 's1' })).toEqual({ kind: 'done', messageId: 'm1', sessionId: 's1' });
    expect(interpretChatEvent({ message: 'blocked', blocked: true })).toEqual({ kind: 'moderation', message: 'blocked' });
    expect(interpretChatEvent({ message: 'Insufficient credits', refunded: false })).toEqual({
      kind: 'error',
      message: 'Insufficient credits',
      refunded: false,
    });
    expect(interpretChatEvent('nope')).toEqual({ kind: 'unknown' });
  });
});

describe('parseSSEBlock', () => {
  it('parses a data block into a typed event', () => {
    expect(parseSSEBlock('data: {"content":"x"}')).toEqual({ kind: 'token', content: 'x' });
  });
  it('ignores [DONE] sentinel and malformed JSON', () => {
    expect(parseSSEBlock('data: [DONE]')).toBeNull();
    expect(parseSSEBlock('data: {oops')).toBeNull();
  });
});
