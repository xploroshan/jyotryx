import { parsePricing, planForSku, reportSku, allProductSkus, PALMISTRY_SKU } from './products';

describe('SKU catalog', () => {
  it('maps subscription SKUs to plans', () => {
    expect(planForSku('premium_monthly')).toBe('MONTHLY');
    expect(planForSku('premium_annual')).toBe('ANNUAL');
    expect(planForSku('premium_weekly')).toBeNull();
  });

  it('builds report SKUs from report types', () => {
    expect(reportSku('LIFE')).toBe('report_life');
    expect(reportSku('CAREER')).toBe('report_career');
  });

  it('lists the full product catalog with the web productIds', () => {
    const skus = allProductSkus();
    expect(skus).toContain('credits_starter');
    expect(skus).toContain('credits_popular');
    expect(skus).toContain('credits_pro');
    expect(skus).toContain('report_palm');
    expect(skus).toContain(PALMISTRY_SKU);
    expect(skus).not.toContain('credits_10'); // legacy ids are not sold
  });
});

describe('parsePricing', () => {
  it('applies web-verified defaults on an empty map', () => {
    const p = parsePricing({});
    expect(p.packs.map((x) => [x.sku, x.credits, x.priceINR])).toEqual([
      ['credits_starter', 50, 99],
      ['credits_popular', 150, 249],
      ['credits_pro', 500, 699],
    ]);
    expect(p.monthlyPrice).toBe(499);
    expect(p.annualPrice).toBe(4999);
    expect(p.recommended).toBe('annual');
    expect(p.reportPrice).toBe(199);
    expect(p.palmistryPrice).toBe(250);
    expect(p.subscriptionsEnabled).toBe(false);
    expect(p.pricingEnabled).toBe(false);
    expect(p.freeMode).toBe(false);
  });

  it('reads SiteSettings overrides and strict-true booleans', () => {
    const p = parsePricing({
      'pricing.credits.popular.credits': '200',
      'pricing.credits.popular.price': '299',
      'pricing.monthly.price': '599',
      'pricing.recommended': 'monthly',
      'feature.subscriptions_enabled': 'true',
      'feature.free_mode': 'TRUE', // not strict-true → false (web parity)
    });
    const popular = p.packs.find((x) => x.packId === 'popular')!;
    expect(popular.credits).toBe(200);
    expect(popular.priceINR).toBe(299);
    expect(p.monthlyPrice).toBe(599);
    expect(p.recommended).toBe('monthly');
    expect(p.subscriptionsEnabled).toBe(true);
    expect(p.freeMode).toBe(false);
  });

  it('rejects non-positive/garbage numbers back to fallbacks (web parity)', () => {
    const p = parsePricing({
      'pricing.report.price': '0',
      'pricing.palmistry.price': 'abc',
    });
    expect(p.reportPrice).toBe(199);
    expect(p.palmistryPrice).toBe(250);
  });

  it('store policy is fail-closed: link hidden unless exactly true', () => {
    expect(parsePricing({}).storePolicy).toEqual({ region: 'IN', allowWebCheckoutLink: false });
    expect(parsePricing({ 'storePolicy.allowWebCheckoutLink': 'True' }).storePolicy.allowWebCheckoutLink).toBe(false);
    const open = parsePricing({ 'storePolicy.region': 'US', 'storePolicy.allowWebCheckoutLink': 'true' });
    expect(open.storePolicy).toEqual({ region: 'US', allowWebCheckoutLink: true });
  });
});
