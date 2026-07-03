/**
 * Response shapes for the P4 rich features (Reports, Chat, Memory, Palmistry,
 * Match-share), transcribed from the web clients + controllers.
 */

// ── Reports ──
export type ReportType = 'LIFE' | 'CAREER' | 'MARRIAGE' | 'WEALTH' | 'PALM' | 'ANNUAL';
export interface ReportSection {
  title: string;
  content: string;
  order: number;
}
export interface ReportResponse {
  id: string;
  userId?: string;
  type: ReportType;
  title: string;
  status: string; // generating | ready | completed | failed (lowercased)
  summary: string;
  sections: ReportSection[];
  pdfUrl?: string | null;
  creditsCharged?: number;
  createdAt: string;
  completedAt?: string;
}
export type ReportListItem = Omit<ReportResponse, 'sections'>;
export interface ReportStatusResponse {
  id: string;
  status: string;
  completedAt?: string;
}

// ── Chat + Memory ──
export type ChatCategory =
  | 'general'
  | 'kundli'
  | 'career'
  | 'relationship'
  | 'remedy'
  | 'wealth'
  | 'health'
  | 'numerology';
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  category: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
export type ChatSessionSummary = Omit<ChatSession, 'messages'>;
export interface ChatSendResponse {
  session: ChatSession;
  reply: ChatMessage;
}

export type MemoryKind = 'fact' | 'preference' | 'goal' | 'event';
export interface Memory {
  id: string;
  userId: string;
  kind: MemoryKind;
  content: string;
  source: 'user' | 'system';
  pinned: boolean;
  createdAt: string;
}

// ── Palmistry ──
export interface PalmLine {
  name: string;
  subtitle?: string;
  description: string;
  observations?: string[];
  strength: string; // strong | moderate | weak (+ synonyms)
  interpretation: string;
}
export interface PalmMount {
  name: string;
  prominence: string; // elevated | normal | flat
  interpretation: string;
}
export interface PalmFinger {
  finger: string;
  length: string; // long | average | short
  interpretation: string;
}
export interface PalmMarking {
  name: string;
  location: string;
  interpretation: string;
}
export interface PalmTiming {
  ageRange: string;
  area: string;
  description: string;
}
export interface PalmistryAnalysis {
  id: string;
  userId?: string;
  imageUrl?: string;
  status: string;
  createdAt?: string;
  atAGlance?: { strengths?: string; lifePath?: string; love?: string; bestSuitedFor?: string };
  handOverview?: { handType?: string; palmShape?: string; fingers?: string; thumb?: string; dominantHand?: string };
  handShape?: { type?: string; description?: string };
  lines?: PalmLine[];
  mounts?: PalmMount[];
  fingerAnalysis?: PalmFinger[];
  specialMarkings?: PalmMarking[];
  timingInsights?: PalmTiming[];
  overallReading?: string;
  healthInsights?: string;
  careerInsights?: string;
  relationshipInsights?: string;
  spiritualInsights?: string;
  cautions?: string;
  closingAffirmation?: string;
}
export interface PalmistryStatusResponse {
  id: string;
  status: string;
  analysis?: PalmistryAnalysis;
}

// ── Match-share ──
export interface ShareGuna {
  guna: string;
  description: string;
  maxPoints: number;
  obtainedPoints: number;
}
export interface CreateSharePayload {
  partner1Name: string;
  partner2Name: string;
  totalScore: number;
  maxScore: number;
  compatibility: string;
  recommendation: string;
  manglikA: boolean;
  manglikB: boolean;
  gunaDetails: ShareGuna[];
  locale: string;
}
export interface SharedMatchPayload {
  token: string;
  personAName: string;
  personBName: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  compatibility: string;
  recommendation: string;
  manglikA: boolean;
  manglikB: boolean;
  gunaDetails: ShareGuna[];
  locale?: string | null;
  createdAt: string;
}
