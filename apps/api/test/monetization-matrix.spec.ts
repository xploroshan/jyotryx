/**
 * MONETIZATION MATRIX — the admin-panel contract, tested end-to-end.
 *
 * The admin's Pricing Management panel promises specific behavior per toggle
 * ("Make app completely free … overrides the per-feature pricing below";
 * "Subscriptions enabled: Off = whole app free except Chat, Palmistry &
 * Reports (pay-per-use)"). A dead or partially-applied toggle is an operator
 * disaster, and change-scoped reviews can't catch cross-feature contract
 * drift — so this suite walks the mode matrix against the REAL gate code:
 *
 *   settings store → REAL FeatureAccessService → REAL feature gates
 *   (resolveChatAccess / resolvePalmAccess / generateReport's gate)
 *
 * Nothing about the access decision is mocked. If any gate stops honoring a
 * toggle the way the admin UI promises, a cell of this matrix fails.
 */
import { PaymentRequiredException } from '../src/common/exceptions/payment-required.exception';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { ReportService } from '../src/modules/report/report.service';

/**
 * In-memory world the REAL FeatureAccessService runs against: a settings map
 * plus the user's subscription / entitlement / usage state.
 */
function makeWorld() {
  const settings = new Map<string, string>();
  const state = {
    activeSubscriptions: 0,
    unusedEntitlements: 0,
    usedUnits: 0,
    bonus: 0,
  };
  const prisma: any = {
    siteSetting: {
      findUnique: async ({ where }: any) =>
        settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null,
      findMany: async () => [...settings].map(([key, value]) => ({ key, value })),
    },
    subscription: { count: async () => state.activeSubscriptions },
    entitlement: { count: async () => state.unusedEntitlements },
    usageCounter: {
      findUnique: async () => ({ used: state.usedUnits, bonus: state.bonus }),
      upsert: async () => ({}),
    },
    // tryConsumeUsage's atomic guarded UPDATE: emulate the ceiling check.
    $queryRawUnsafe: async (sql: string, ...params: any[]) => {
      if (sql.includes('UPDATE usage_counters')) {
        const limit = Number(params[3]);
        if (state.usedUnits < limit + state.bonus) {
          state.usedUnits += 1;
          return [{ used: state.usedUnits, bonus: state.bonus }];
        }
        return [];
      }
      if (sql.includes('UPDATE entitlements')) {
        if (state.unusedEntitlements > 0) {
          state.unusedEntitlements -= 1;
          return [{ id: 'ent-1' }];
        }
        return [];
      }
      return [];
    },
  };
  const featureAccess = new FeatureAccessService(prisma);
  return {
    settings,
    state,
    featureAccess,
    /** Admin toggle helpers (the exact keys the admin panel writes). */
    set: (key: string, value: string) => settings.set(key, value),
  };
}

type World = ReturnType<typeof makeWorld>;

/** Run the REAL chat gate (private method) against the world. */
function chatAccess(world: World, userId = 'u1') {
  return (ChatService.prototype as any).resolveChatAccess.call(
    { featureAccess: world.featureAccess },
    userId,
  );
}

/** Run the REAL palmistry gate (private method) against the world. */
function palmAccess(world: World, userId = 'u1') {
  return (PalmistryService.prototype as any).resolvePalmAccess.call(
    { featureAccess: world.featureAccess },
    userId,
  );
}

/**
 * Run the REAL report gate: generateReport up to the access decision. The
 * generation itself is stubbed via a `this` whose runReportGeneration records
 * the resolved mode.
 */
async function reportAccess(world: World, userId = 'u1') {
  let resolved: { mode: string } | null = null;
  const self = {
    featureAccess: world.featureAccess,
    logger: { log() {}, warn() {}, error() {} },
    runReportGeneration: async (_u: string, _d: any, _t: string, mode: string) => {
      resolved = { mode };
      return { id: 'r1' };
    },
  };
  await (ReportService.prototype as any).generateReport.call(self, userId, { type: 'CAREER' });
  return resolved!;
}

describe('Monetization matrix (admin contract, real gates)', () => {
  // ───────────────────────────────────────────────────────────────────────
  // Row 1: "Make app completely free" ON — overrides EVERYTHING.
  // Chat, Palmistry, Reports must be free in every mode combination and
  // never consume anything.
  // ───────────────────────────────────────────────────────────────────────
  describe.each([
    ['credits ON', 'true'],
    ['credits OFF', 'false'],
  ])('free_mode ON × %s', (_label, creditsValue) => {
    let world: World;
    beforeEach(() => {
      world = makeWorld();
      world.set('feature.free_mode', 'true');
      world.set('feature.credits_enabled', creditsValue);
      world.set('feature.subscriptions_enabled', 'false');
      world.state.usedUnits = 999; // even an exhausted meter must not block
      world.state.unusedEntitlements = 0; // and no purchase is required
    });

    it('chat is free', async () => {
      await expect(chatAccess(world)).resolves.toEqual({ mode: 'free' });
    });

    it('palmistry is free (subscriber-equivalent, nothing consumed)', async () => {
      await expect(palmAccess(world)).resolves.toEqual({ kind: 'subscriber' });
    });

    it('reports are free', async () => {
      await expect(reportAccess(world)).resolves.toEqual({ mode: 'subscriber' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Row 2: free_mode OFF + credits ON (legacy pay-to-unlock).
  // ───────────────────────────────────────────────────────────────────────
  describe('free_mode OFF × credits ON', () => {
    let world: World;
    beforeEach(() => {
      world = makeWorld();
      world.set('feature.free_mode', 'false');
      world.set('feature.credits_enabled', 'true');
    });

    it('palmistry/report 402 for a user with no unlock and no subscription', async () => {
      world.set('feature.subscriptions_enabled', 'false');
      await expect(palmAccess(world)).rejects.toThrow(PaymentRequiredException);
      await expect(reportAccess(world)).rejects.toThrow(PaymentRequiredException);
    });

    it('an unused one-time entitlement unlocks palmistry/report', async () => {
      world.set('feature.subscriptions_enabled', 'false');
      world.state.unusedEntitlements = 1;
      await expect(palmAccess(world)).resolves.toEqual({ kind: 'entitlement' });
      await expect(reportAccess(world)).resolves.toEqual({ mode: 'entitlement' });
    });

    it('an active subscriber gets palmistry/report free — but ONLY when subscriptions are enabled', async () => {
      world.state.activeSubscriptions = 1;
      world.set('feature.subscriptions_enabled', 'true');
      await expect(palmAccess(world)).resolves.toEqual({ kind: 'subscriber' });

      // Admin turns subscriptions off → the subscription no longer grants
      // access; without an entitlement the user is back to 402.
      world.set('feature.subscriptions_enabled', 'false');
      await expect(palmAccess(world)).rejects.toThrow(PaymentRequiredException);
    });

    it('chat charges a credit for non-subscribers (legacy mode)', async () => {
      world.set('feature.subscriptions_enabled', 'false');
      await expect(chatAccess(world)).resolves.toEqual({ mode: 'legacy' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Row 3: free_mode OFF + credits OFF (metered subscription model).
  // ───────────────────────────────────────────────────────────────────────
  describe('free_mode OFF × credits OFF (metered)', () => {
    let world: World;
    beforeEach(() => {
      world = makeWorld();
      world.set('feature.free_mode', 'false');
      world.set('feature.credits_enabled', 'false');
      world.set('feature.subscriptions_enabled', 'false');
    });

    it('a free user under the limit is metered in', async () => {
      world.state.usedUnits = 0;
      await expect(palmAccess(world)).resolves.toMatchObject({ kind: 'metered' });
      await expect(chatAccess(world)).resolves.toMatchObject({ mode: 'meter' });
    });

    it('a free user over the lifetime limit gets 402', async () => {
      world.state.usedUnits = 999;
      await expect(palmAccess(world)).rejects.toThrow(PaymentRequiredException);
      await expect(chatAccess(world)).rejects.toThrow(PaymentRequiredException);
    });

    it('admin-tuned limits are honoured (limits.palmistry.free)', async () => {
      world.set('limits.palmistry.free', '10');
      world.state.usedUnits = 9;
      await expect(palmAccess(world)).resolves.toMatchObject({ kind: 'metered' });
      world.state.usedUnits = 10;
      await expect(palmAccess(world)).rejects.toThrow(PaymentRequiredException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Row 4: setting-absence defaults must match what a fresh install shows.
  // creditsEnabled defaults ON; free_mode and subscriptions default OFF.
  // ───────────────────────────────────────────────────────────────────────
  describe('fresh install (no settings rows at all)', () => {
    it('defaults: credits ON, free_mode OFF, subscriptions OFF → palmistry is pay-to-unlock', async () => {
      const world = makeWorld();
      await expect(world.featureAccess.creditsEnabled()).resolves.toBe(true);
      await expect(world.featureAccess.paidFeaturesFree()).resolves.toBe(false);
      await expect(world.featureAccess.subscriptionsEnabled()).resolves.toBe(false);
      await expect(palmAccess(world)).rejects.toThrow(PaymentRequiredException);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// EFFECTIVE-ACCESS READOUT ⇔ REAL GATES.
// GET /admin/access-matrix renders getEffectiveAccess() as "what each
// feature costs right now". Every cell it can produce is verified here
// against the REAL gate outcome for a user in that tier — if the readout
// ever says "free" while a gate 402s (or shows a limit the meter doesn't
// enforce), a test fails. This is the drift-proofing promised in the
// getEffectiveAccess doc comment.
// ─────────────────────────────────────────────────────────────────────────
describe('Effective-access readout matches real gate outcomes (cross-check)', () => {
  type Combo = { freeMode: boolean; credits: boolean; subs: boolean };
  const COMBOS: Combo[] = [];
  for (const freeMode of [true, false]) {
    for (const credits of [true, false]) {
      for (const subs of [true, false]) COMBOS.push({ freeMode, credits, subs });
    }
  }

  /** A world with the combo's flags, an optional tier, and admin-tuned extras. */
  function worldFor(combo: Combo, tier?: 'free' | 'subscriber', extra?: Record<string, string>) {
    const world = makeWorld();
    world.set('feature.free_mode', String(combo.freeMode));
    world.set('feature.credits_enabled', String(combo.credits));
    world.set('feature.subscriptions_enabled', String(combo.subs));
    for (const [k, v] of Object.entries(extra ?? {})) world.set(k, v);
    if (tier === 'subscriber') world.state.activeSubscriptions = 1;
    return world;
  }

  type Feature = 'chat' | 'palmistry' | 'report';
  const GATE: Record<Feature, (w: World) => Promise<any>> = {
    chat: chatAccess,
    palmistry: palmAccess,
    report: reportAccess,
  };
  /** What each gate returns when access is free (unmetered, nothing consumed). */
  const FREE_GRANT: Record<Feature, object> = {
    chat: { mode: 'free' },
    palmistry: { kind: 'subscriber' },
    report: { mode: 'subscriber' },
  };
  /** What each gate returns when a metered slot is granted. */
  const METERED_GRANT: Record<Feature, object> = {
    chat: { mode: 'meter' },
    palmistry: { kind: 'metered' },
    report: { mode: 'subscriber' }, // metered reports generate in subscriber mode
  };

  /** Prove one readout cell against the real gate for a user in that tier. */
  async function verifyCell(
    combo: Combo,
    feature: Feature,
    tier: 'free' | 'subscriber',
    cell: import('../src/common/feature-access/feature-access.service').EffectiveAccessCell,
    extra?: Record<string, string>,
  ) {
    const fresh = () => worldFor(combo, tier, extra);
    const gate = GATE[feature];
    switch (cell.mode) {
      case 'free': {
        // "Free" must mean free even with an exhausted meter and no purchases.
        const world = fresh();
        world.state.usedUnits = 999;
        world.state.unusedEntitlements = 0;
        await expect(gate(world)).resolves.toMatchObject(FREE_GRANT[feature]);
        return;
      }
      case 'credits': {
        // Chat legacy mode: gate resolves 'legacy' (a credit charged per
        // message) and the displayed cost is the live admin-tuned setting.
        const world = fresh();
        await expect(gate(world)).resolves.toEqual({ mode: 'legacy' });
        expect(cell.costCredits).toBe(await world.featureAccess.getCreditCost('chat', 1));
        return;
      }
      case 'one_time_unlock': {
        const locked = fresh();
        await expect(gate(locked)).rejects.toThrow(PaymentRequiredException);
        const unlocked = fresh();
        unlocked.state.unusedEntitlements = 1;
        await expect(gate(unlocked)).resolves.toMatchObject(
          feature === 'palmistry' ? { kind: 'entitlement' } : { mode: 'entitlement' },
        );
        return;
      }
      case 'metered': {
        // The displayed limit must be the EXACT enforcement ceiling: one
        // under passes, at the limit the gate 402s.
        const under = fresh();
        under.state.usedUnits = cell.limit - 1;
        await expect(gate(under)).resolves.toMatchObject(METERED_GRANT[feature]);
        const over = fresh();
        over.state.usedUnits = cell.limit;
        await expect(gate(over)).rejects.toThrow(PaymentRequiredException);
        return;
      }
      case 'not_applicable': {
        // Subscriptions disabled: an "active" subscription row grants
        // nothing — the gates see this user as a plain free user.
        const world = fresh();
        await expect(world.featureAccess.isActiveSubscriber('u1')).resolves.toBe(false);
        return;
      }
    }
  }

  it.each(
    COMBOS.map((c) => [
      `free_mode ${c.freeMode ? 'ON' : 'off'} × credits ${c.credits ? 'ON' : 'off'} × subs ${c.subs ? 'ON' : 'off'}`,
      c,
    ] as const),
  )('%s: every cell matches its real gate', async (_label, combo) => {
    const readout = await worldFor(combo).featureAccess.getEffectiveAccess();
    expect(readout.flags).toEqual({
      freeMode: combo.freeMode,
      creditsEnabled: combo.credits,
      subscriptionsEnabled: combo.subs,
    });
    expect(readout.features.map((f) => f.feature)).toEqual(['chat', 'palmistry', 'report']);
    for (const row of readout.features) {
      await verifyCell(combo, row.feature, 'free', row.freeUser);
      await verifyCell(combo, row.feature, 'subscriber', row.subscriber);
    }
  });

  it('admin-tuned values flow into the readout AND the gates (chat cost, palm limit)', async () => {
    // Legacy mode: a tuned chat credit cost shows up in the cell.
    const legacy: Combo = { freeMode: false, credits: true, subs: false };
    const tuned = { 'pricing.credits.chat_cost': '7' };
    const legacyReadout = await worldFor(legacy, undefined, tuned).featureAccess.getEffectiveAccess();
    const chatCell = legacyReadout.features.find((f) => f.feature === 'chat')!.freeUser;
    expect(chatCell).toEqual({ mode: 'credits', costCredits: 7 });
    await verifyCell(legacy, 'chat', 'free', chatCell, tuned);

    // Metered mode: a tuned palmistry limit shows up AND is what the meter
    // actually enforces (verifyCell proves 402 at exactly that ceiling).
    const metered: Combo = { freeMode: false, credits: false, subs: false };
    const limits = { 'limits.palmistry.free': '10' };
    const meteredReadout = await worldFor(metered, undefined, limits).featureAccess.getEffectiveAccess();
    const palmCell = meteredReadout.features.find((f) => f.feature === 'palmistry')!.freeUser;
    expect(palmCell).toEqual({ mode: 'metered', limit: 10, period: 'lifetime' });
    await verifyCell(metered, 'palmistry', 'free', palmCell, limits);
  });
});
