/**
 * Shared mock factories for Jyotryx test suite.
 */

export const mockKnowledgeService = () => ({
  search: jest.fn().mockResolvedValue([]),
  getByTopic: jest.fn().mockResolvedValue([]),
  getByCategory: jest.fn().mockResolvedValue([]),
  assembleContext: jest.fn().mockReturnValue(''),
  addDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
  addDocuments: jest.fn().mockResolvedValue(10),
  getDocumentCount: jest.fn().mockResolvedValue(100),
});

export const mockOpenAIService = () => ({
  chat: jest.fn().mockResolvedValue(null),
  chatCompletion: jest.fn().mockResolvedValue(null),
  chatWithImage: jest.fn().mockResolvedValue(null),
  getClient: jest.fn().mockReturnValue(null),
  getModel: jest.fn().mockReturnValue('gpt-4o'),
  getModelForFeature: jest.fn().mockReturnValue('gpt-4o'),
  recordUsage: jest.fn().mockResolvedValue(undefined),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
  computeCost: jest.fn().mockReturnValue(0),
});

export const mockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  kundliChart: {
    create: jest.fn().mockResolvedValue({ id: 'kundli-1', createdAt: new Date() }),
    findFirst: jest.fn(),
  },
  matchingResult: {
    create: jest.fn().mockResolvedValue({ id: 'match-1', createdAt: new Date() }),
  },
  chatSession: {
    create: jest.fn().mockResolvedValue({ id: 'session-1', createdAt: new Date(), updatedAt: new Date() }),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  chatMessage: {
    create: jest.fn().mockResolvedValue({ id: 'msg-1', createdAt: new Date() }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  palmistryReading: {
    create: jest.fn().mockResolvedValue({ id: 'palm-1', createdAt: new Date() }),
  },
  report: {
    create: jest.fn().mockResolvedValue({ id: 'report-1', createdAt: new Date(), type: 'LIFE', status: 'READY', fileUrl: null, price: 5, userId: 'test-uuid' }),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: 'report-1', status: 'COMPLETED' }),
  },
  knowledgeDocument: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 10 }),
    count: jest.fn().mockResolvedValue(100),
  },
  llmUsage: {
    create: jest.fn().mockResolvedValue({ id: 'llm-usage-1', createdAt: new Date() }),
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: 0, totalTokens: 0 }, _count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  },
  siteSetting: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  },
  notification: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  creditTransaction: {
    create: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -5 } }),
  },
  $transaction: jest.fn((fn: any) => fn({
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'test-uuid', credits: 20 }), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    creditTransaction: { create: jest.fn() },
  })),
  $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(1) }]),
  $queryRaw: jest.fn().mockResolvedValue([]),
});

export const mockCacheService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
});

/**
 * In-memory mock of the ioredis client. Supports the ops the app uses:
 * get, set (with EX/PX), del, ping, incr, expire, ttl, quit, on.
 * Honors TTLs so tests that depend on expiry behavior still work.
 */
export const createMockRedis = () => {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  const isExpired = (entry: { expiresAt: number | null }): boolean =>
    entry.expiresAt !== null && entry.expiresAt <= Date.now();

  const getRaw = (key: string): string | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry.value;
  };

  return {
    get: jest.fn(async (key: string) => getRaw(key)),
    set: jest.fn(async (key: string, value: string, ...args: any[]) => {
      let expiresAt: number | null = null;
      for (let i = 0; i < args.length; i += 2) {
        const mode = String(args[i]).toUpperCase();
        const amount = Number(args[i + 1]);
        if (mode === 'EX') expiresAt = Date.now() + amount * 1000;
        else if (mode === 'PX') expiresAt = Date.now() + amount;
      }
      store.set(key, { value: String(value), expiresAt });
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let removed = 0;
      for (const k of keys) {
        if (store.delete(k)) removed++;
      }
      return removed;
    }),
    ping: jest.fn(async () => 'PONG'),
    incr: jest.fn(async (key: string) => {
      const raw = getRaw(key);
      const next = (raw ? parseInt(raw, 10) : 0) + 1;
      const existing = store.get(key);
      store.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
      return next;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),
    quit: jest.fn(async () => 'OK'),
    on: jest.fn(),
    // Expose for test assertions / setup
    __store: store,
    __clear: () => store.clear(),
  };
};

export const mockUserService = () => ({
  deductCredits: jest.fn().mockResolvedValue(true),
  addCredits: jest.fn().mockResolvedValue(true),
  findById: jest.fn(),
  getProfile: jest.fn(),
  getCredits: jest.fn(),
});

export const mockConfigService = (overrides: Record<string, any> = {}) => ({
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      'openai.model': 'gpt-4o',
      'credits.freeMonthly': 10,
      'credits.chatCost': 1,
      'credits.kundliCost': 2,
      'credits.reportCost': 5,
      'credits.palmistryCost': 3,
      'jwt.secret': 'test-secret',
      'jwt.expiresIn': '7d',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.refreshExpiresIn': '30d',
      'otp.length': 6,
      'otp.expiresInMinutes': 5,
      'razorpay.keyId': 'test-key',
      'razorpay.keySecret': 'test-secret',
      'razorpay.webhookSecret': 'test-webhook-secret',
      ...overrides,
    };
    return config[key] ?? defaultValue;
  }),
});

export const mockUser = {
  id: 'test-uuid',
  name: 'Test User',
  email: 'test@example.com',
  phone: '+919876543210',
  credits: 20,
  role: 'USER',
  preferredLanguage: 'en',
  gender: 'Male',
  profession: 'SOFTWARE',
  dateOfBirth: new Date('1990-05-15'),
  timeOfBirth: '14:30',
  placeOfBirth: { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  provider: 'LOCAL',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBirthDetails = {
  dateOfBirth: '1990-05-15',
  timeOfBirth: '14:30',
  placeOfBirth: 'Mumbai',
  latitude: 19.076,
  longitude: 72.8777,
};

export const mockLlmService = () => ({
  chatCompletion: jest.fn().mockResolvedValue({ content: 'LLM response', model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }),
  chatCompletionStream: jest.fn().mockReturnValue((async function* () { yield 'chunk'; })()),
  getModel: jest.fn().mockReturnValue('gpt-4o'),
  computeCost: jest.fn().mockReturnValue(0.001),
});

export const mockEphemerisService = () => ({
  computeChart: jest.fn().mockResolvedValue({
    julianDay: 2448000.0,
    ayanamsa: 23.7,
    planets: [
      { id: 0, name: 'Sun', longitude: 54.5, latitude: 0, speed: 0.95, sign: 'Taurus', signIndex: 1, degree: 24.5, nakshatra: 'Mrigashira', nakshatraIndex: 5, nakshatraPada: 3, isRetrograde: false, house: 1 },
      { id: 1, name: 'Moon', longitude: 120.3, latitude: 2.1, speed: 12.5, sign: 'Cancer', signIndex: 3, degree: 0.3, nakshatra: 'Pushya', nakshatraIndex: 7, nakshatraPada: 1, isRetrograde: false, house: 4 },
      { id: 2, name: 'Mars', longitude: 180.0, latitude: 0.5, speed: 0.6, sign: 'Libra', signIndex: 6, degree: 0.0, nakshatra: 'Chitra', nakshatraIndex: 13, nakshatraPada: 3, isRetrograde: false, house: 7 },
      { id: 3, name: 'Mercury', longitude: 45.0, latitude: 0.1, speed: 1.2, sign: 'Taurus', signIndex: 1, degree: 15.0, nakshatra: 'Rohini', nakshatraIndex: 3, nakshatraPada: 4, isRetrograde: false, house: 1 },
      { id: 4, name: 'Jupiter', longitude: 90.0, latitude: -0.2, speed: 0.08, sign: 'Cancer', signIndex: 3, degree: 0.0, nakshatra: 'Punarvasu', nakshatraIndex: 6, nakshatraPada: 4, isRetrograde: false, house: 4 },
      { id: 5, name: 'Venus', longitude: 30.0, latitude: 0.3, speed: 1.1, sign: 'Taurus', signIndex: 1, degree: 0.0, nakshatra: 'Krittika', nakshatraIndex: 2, nakshatraPada: 3, isRetrograde: false, house: 1 },
      { id: 6, name: 'Saturn', longitude: 300.0, latitude: 0.0, speed: 0.03, sign: 'Aquarius', signIndex: 10, degree: 0.0, nakshatra: 'Dhanishta', nakshatraIndex: 22, nakshatraPada: 3, isRetrograde: false, house: 10 },
      { id: 7, name: 'Rahu', longitude: 210.0, latitude: 0.0, speed: -0.05, sign: 'Scorpio', signIndex: 7, degree: 0.0, nakshatra: 'Anuradha', nakshatraIndex: 16, nakshatraPada: 2, isRetrograde: true, house: 7 },
      { id: 8, name: 'Ketu', longitude: 30.0, latitude: 0.0, speed: -0.05, sign: 'Taurus', signIndex: 1, degree: 0.0, nakshatra: 'Krittika', nakshatraIndex: 2, nakshatraPada: 3, isRetrograde: true, house: 1 },
    ],
    houses: Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30, sign: ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'][i], degree: 0 })),
    ascendant: { longitude: 0, sign: 'Aries', degree: 0, nakshatra: 'Ashwini', nakshatraPada: 1 },
  }),
  computePanchang: jest.fn().mockResolvedValue({
    tithi: { name: 'Shukla Panchami', number: 5, paksha: 'Shukla' },
    nakshatra: { name: 'Rohini', lord: 'Moon' },
    yoga: { name: 'Shobhana' },
    karana: { name: 'Balava' },
    vara: 'Sunday',
  }),
});

export const mockStorageService = () => ({
  uploadBuffer: jest.fn().mockResolvedValue('palmistry/test-uuid/image.jpeg'),
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://cdn.example.com/image.jpeg?sig=abc'),
  getPresignedUploadUrl: jest.fn().mockResolvedValue('https://cdn.example.com/upload?sig=abc'),
  isAvailable: jest.fn().mockReturnValue(true),
});

export const mockVectorSearchService = () => ({
  searchByVector: jest.fn().mockResolvedValue([]),
  isAvailable: jest.fn().mockReturnValue(false),
});

export const mockEmbeddingService = () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null),
  generateBatchEmbeddings: jest.fn().mockResolvedValue([]),
});
