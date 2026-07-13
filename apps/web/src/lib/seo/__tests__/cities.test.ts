import { describe, it, expect } from "vitest";
import { SEO_CITIES, nearbyCities, contrastCities } from "../cities";
import { kundliCityEntries } from "../sitemap-entries";
import { todayIST } from "../dates";

/**
 * Guards for the kundli city-page enrichment (SEO phase 2).
 */

describe("nearbyCities", () => {
  it("never includes the city itself and returns the requested count", () => {
    for (const c of SEO_CITIES) {
      const near = nearbyCities(c.slug, 4);
      expect(near.length, c.slug).toBe(4);
      expect(near.map((n) => n.slug), c.slug).not.toContain(c.slug);
    }
  });

  it("prefers same-state cities when they exist", () => {
    const withStateSiblings = SEO_CITIES.find(
      (c) => SEO_CITIES.filter((o) => o.state === c.state).length > 2,
    );
    expect(withStateSiblings).toBeTruthy();
    const near = nearbyCities(withStateSiblings!.slug, 2);
    for (const n of near) expect(n.state).toBe(withStateSiblings!.state);
  });

  it("returns [] for an unknown slug", () => {
    expect(nearbyCities("atlantis")).toEqual([]);
  });
});

describe("contrastCities", () => {
  it("NEVER returns the city itself (the Mumbai-vs-Mumbai template bug)", () => {
    for (const c of SEO_CITIES) {
      const [a, b] = contrastCities(c.slug);
      expect(a.slug, c.slug).not.toBe(c.slug);
      expect(b.slug, c.slug).not.toBe(c.slug);
      expect(a.slug).not.toBe(b.slug);
    }
  });

  it("returns two well-known metros for a non-metro city", () => {
    const [a, b] = contrastCities("varanasi");
    expect(a.slug).toBe("mumbai");
    expect(b.slug).toBe("kolkata");
  });

  it("shifts the pair when the city IS one of the metros", () => {
    const [a, b] = contrastCities("mumbai");
    expect([a.slug, b.slug]).toEqual(["kolkata", "delhi"]);
  });
});

describe("kundli city sitemap entries", () => {
  it("are daily with IST-midnight lastModified (pages embed live panchang)", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    const entries = kundliCityEntries(now);
    expect(entries.length).toBe(SEO_CITIES.length);
    for (const e of entries) {
      expect(e.changeFrequency, e.url).toBe("daily");
      expect(new Date(e.lastModified as Date).getTime(), e.url).toBe(todayIST(now).getTime());
    }
  });
});
