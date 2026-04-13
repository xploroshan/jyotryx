// ─── Enums ──────────────────────────────────────────────────────────────────

export enum ZodiacSign {
  ARIES = "ARIES",
  TAURUS = "TAURUS",
  GEMINI = "GEMINI",
  CANCER = "CANCER",
  LEO = "LEO",
  VIRGO = "VIRGO",
  LIBRA = "LIBRA",
  SCORPIO = "SCORPIO",
  SAGITTARIUS = "SAGITTARIUS",
  CAPRICORN = "CAPRICORN",
  AQUARIUS = "AQUARIUS",
  PISCES = "PISCES",
}

export enum ConsultationCategory {
  GENERAL = "GENERAL",
  CAREER = "CAREER",
  RELATIONSHIP = "RELATIONSHIP",
  HEALTH = "HEALTH",
  FINANCE = "FINANCE",
  KUNDLI = "KUNDLI",
  MATCHING = "MATCHING",
  PALMISTRY = "PALMISTRY",
  REMEDY = "REMEDY",
}

export enum PlanType {
  FREE = "FREE",
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum Role {
  USER = "USER",
  PREMIUM = "PREMIUM",
  ADMIN = "ADMIN",
}

export enum AuthProvider {
  LOCAL = "LOCAL",
  GOOGLE = "GOOGLE",
  APPLE = "APPLE",
}

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum PaymentType {
  CREDITS = "CREDITS",
  SUBSCRIPTION = "SUBSCRIPTION",
  REPORT = "REPORT",
}

export enum ReportType {
  LIFE = "LIFE",
  CAREER = "CAREER",
  MARRIAGE = "MARRIAGE",
  WEALTH = "WEALTH",
  PALM = "PALM",
  ANNUAL = "ANNUAL",
}

export enum ReportStatus {
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum CreditTransactionType {
  PURCHASE = "PURCHASE",
  DAILY_FREE = "DAILY_FREE",
  CHAT_DEDUCTION = "CHAT_DEDUCTION",
  REPORT_PURCHASE = "REPORT_PURCHASE",
}

export enum AstrologyTradition {
  VEDIC = "VEDIC",
  WESTERN = "WESTERN",
  CHINESE = "CHINESE",
  HELLENISTIC = "HELLENISTIC",
  HORARY = "HORARY",
  MEDICAL = "MEDICAL",
}

// ─── Common Types ───────────────────────────────────────────────────────────

export interface PlaceOfBirth {
  lat: number;
  lng: number;
  name: string;
}

// ─── Domain Models ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: PlaceOfBirth | null;
  gender?: string | null;
  profilePhoto?: string | null;
  preferredLanguage: string;
  astrologyTraditions: AstrologyTradition[];
  role: Role;
  credits: number;
  provider: AuthProvider;
  providerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  razorpaySubscriptionId?: string | null;
  startDate: string;
  endDate?: string | null;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  category: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface KundliChart {
  id: string;
  userId: string;
  name: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: PlaceOfBirth;
  chartData: Record<string, unknown>;
  createdAt: string;
}

export interface MatchingResult {
  id: string;
  userId: string;
  personAName: string;
  personADob: string;
  personATime: string;
  personAPlace: PlaceOfBirth;
  personBName: string;
  personBDob: string;
  personBTime: string;
  personBPlace: PlaceOfBirth;
  gunaScore: number;
  manglikA: boolean;
  manglikB: boolean;
  resultData: Record<string, unknown>;
  createdAt: string;
}

export interface PalmistryReading {
  id: string;
  userId: string;
  imageUrl: string;
  analysisData: Record<string, unknown>;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  type: PaymentType;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Report {
  id: string;
  userId: string;
  type: ReportType;
  status: ReportStatus;
  fileUrl?: string | null;
  price: number;
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description?: string | null;
  createdAt: string;
}

// ─── API Request Types ──────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SocialLoginRequest {
  provider: AuthProvider;
  token: string;
}

export interface UpdateProfileRequest {
  name?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: PlaceOfBirth;
  gender?: string;
  preferredLanguage?: string;
  astrologyTraditions?: AstrologyTradition[];
}

export interface SendChatMessageRequest {
  sessionId?: string;
  category: ConsultationCategory;
  message: string;
}

export interface CreateKundliRequest {
  name: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: PlaceOfBirth;
}

export interface MatchingRequest {
  personA: {
    name: string;
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: PlaceOfBirth;
  };
  personB: {
    name: string;
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: PlaceOfBirth;
  };
}

export interface PalmistryUploadRequest {
  imageUrl: string;
  message?: string;
}

export interface CreatePaymentOrderRequest {
  type: PaymentType;
  planType?: PlanType;
  credits?: number;
  reportId?: string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface GenerateReportRequest {
  type: ReportType;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKey: string;
}

export interface CreditBalanceResponse {
  credits: number;
  transactions: CreditTransaction[];
}
