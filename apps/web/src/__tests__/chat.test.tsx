/**
 * Chat ("Talk to an Astrologer") Page Tests
 *
 * Validates the astrologer picker, then — after choosing an astrologer —
 * the persona greeting, input/send elements, auth guard, and assistant
 * response rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock store state ───────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test User', email: 'test@test.com', credits: 10, role: 'user' },
  accessToken: 'valid-token',
  refreshToken: 'valid-refresh',
  isAuthenticated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: any) => selector ? selector(mockStoreState) : mockStoreState),
    { getState: () => mockStoreState },
  ),
  useAuthHydrated: () => true,
}));

// ─── Mock API ───────────────────────────────────────────────────────────────
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

// ─── Mock chat response ────────────────────────────────────────────────────
const mockChatResponse = {
  session: { id: 'sess1' },
  reply: { content: 'Based on your birth chart, career prospects look positive.' },
};

// ─── Mock scrollIntoView (not available in jsdom) ──────────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ─── Import component AFTER mocks ──────────────────────────────────────────
import ChatPage from '@/app/chat/page';

/** Render the page and pick the first astrologer to enter the chat view. */
function renderAndConsult() {
  const utils = render(<ChatPage />);
  fireEvent.click(screen.getByText('Acharya Vikram Shastri'));
  return utils;
}

describe('Chat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render the astrologer picker first', () => {
    render(<ChatPage />);
    expect(screen.getByText('Talk to an Astrologer')).toBeDefined();
    expect(screen.getByText('Acharya Vikram Shastri')).toBeDefined();
    expect(screen.getByText('Pandita Meera Joshi')).toBeDefined();
    expect(screen.getByText('Guru Anand Nath')).toBeDefined();
    expect(screen.getByText('Jyotishi Kavya Reddy')).toBeDefined();
  });

  it('should greet in the chosen astrologer voice after selection', () => {
    renderAndConsult();
    expect(screen.getByText(/I'm Acharya Vikram Shastri/)).toBeDefined();
  });

  it('should show input field and send button after selecting an astrologer', () => {
    renderAndConsult();
    expect(screen.getByPlaceholderText('Ask your question...')).toBeDefined();
    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    expect(sendButton).toBeDefined();
  });

  it('should redirect to /auth when not authenticated and trying to send', async () => {
    mockStoreState.isAuthenticated = false;
    renderAndConsult();

    const input = screen.getByPlaceholderText('Ask your question...');
    fireEvent.change(input, { target: { value: 'What is my future?' } });

    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    fireEvent.click(sendButton!);

    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('should render assistant response after sending message', async () => {
    mockApiPost.mockResolvedValueOnce(mockChatResponse);
    renderAndConsult();

    const input = screen.getByPlaceholderText('Ask your question...');
    fireEvent.change(input, { target: { value: 'Tell me about my career' } });

    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    fireEvent.click(sendButton!);

    expect(await screen.findByText('Based on your birth chart, career prospects look positive.')).toBeDefined();
  });

  it('should send the selected astrologerId with the message', async () => {
    mockApiPost.mockResolvedValueOnce(mockChatResponse);
    renderAndConsult();

    const input = screen.getByPlaceholderText('Ask your question...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    fireEvent.click(sendButton!);

    await screen.findByText('Based on your birth chart, career prospects look positive.');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/chat/message',
      expect.objectContaining({ astrologerId: 'acharya-vikram' }),
      expect.anything(),
    );
  });
});
