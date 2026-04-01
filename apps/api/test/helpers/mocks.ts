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
  creditTransaction: {
    create: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -5 } }),
  },
  $transaction: jest.fn((fn: any) => fn({
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'test-uuid', credits: 20 }), update: jest.fn() },
    creditTransaction: { create: jest.fn() },
  })),
});

export const mockCacheService = () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
});

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
