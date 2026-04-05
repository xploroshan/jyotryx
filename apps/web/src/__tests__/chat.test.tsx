/**
 * Chat Page Tests
 *
 * Validates initial greeting, category sidebar, suggested questions,
 * input/send elements, auth guard, and assistant response rendering.
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

describe('Chat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessToken = 'valid-token';
  });

  it('should render initial greeting message', () => {
    render(<ChatPage />);
    expect(screen.getByText(/Namaste! I am your Vedic Astrologer/)).toBeDefined();
  });

  it('should render category sidebar buttons', () => {
    render(<ChatPage />);
    // "Career" appears in both the sidebar button and the chat area header, so use getAllByText
    expect(screen.getAllByText('Career').length).toBeGreaterThanOrEqual(1);
    const otherCategories = ['Relationships', 'General', 'Kundli', 'Remedies', 'Wealth', 'Health', 'Numerology'];
    for (const cat of otherCategories) {
      expect(screen.getByText(cat)).toBeDefined();
    }
  });

  it('should render suggested questions', () => {
    render(<ChatPage />);
    expect(screen.getByText('What does my career look like in 2026?')).toBeDefined();
    expect(screen.getByText('Is this a good time for investment?')).toBeDefined();
    expect(screen.getByText('When will I find my life partner?')).toBeDefined();
    expect(screen.getByText('What remedies can improve my health?')).toBeDefined();
  });

  it('should show input field and send button', () => {
    render(<ChatPage />);
    expect(screen.getByPlaceholderText('Ask your question...')).toBeDefined();
    // Send button is an SVG icon button
    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    expect(sendButton).toBeDefined();
  });

  it('should redirect to /auth when not authenticated and trying to send', async () => {
    mockStoreState.isAuthenticated = false;
    render(<ChatPage />);

    const input = screen.getByPlaceholderText('Ask your question...');
    fireEvent.change(input, { target: { value: 'What is my future?' } });

    // Find the send button (button with SVG arrow icon)
    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    fireEvent.click(sendButton!);

    expect(mockPush).toHaveBeenCalledWith('/auth');
  });

  it('should render assistant response after sending message', async () => {
    mockApiPost.mockResolvedValueOnce(mockChatResponse);
    render(<ChatPage />);

    const input = screen.getByPlaceholderText('Ask your question...');
    fireEvent.change(input, { target: { value: 'Tell me about my career' } });

    const buttons = document.querySelectorAll('button');
    const sendButton = Array.from(buttons).find((btn) => btn.querySelector('svg path[d*="M6 12"]'));
    fireEvent.click(sendButton!);

    expect(await screen.findByText('Based on your birth chart, career prospects look positive.')).toBeDefined();
  });
});
