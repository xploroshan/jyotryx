"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/v2/Button";
import { Card, CardCaption, CardDescription, CardHeader, CardTitle } from "@/components/ui/v2/Card";
import { Container } from "@/components/ui/v2/Container";
import { Section, SectionHeading } from "@/components/ui/v2/Section";

/**
 * Candidate palettes. Each one overrides the v2 semantic tokens via inline
 * CSS variables on the page root. Pick the one that feels right and tell
 * the team — that becomes the system. Order is intentional: lightest /
 * cleanest first, deepest / warmest last, so the picker reads as a dial.
 */
type Palette = {
  id: string;
  name: string;
  tagline: string;
  body: string;
  vars: Record<string, string>;
};

const PALETTES: Palette[] = [
  {
    id: "linen",
    name: "Warm Linen",
    tagline: "Light with body. Notion-warm.",
    body: "A soft linen background with white cards that pop. Warm undertone keeps the editorial feel without the saturation of cream.",
    vars: {
      "--color-bg": "#ede4d0",
      "--color-bg-subtle": "#e3d9c1",
      "--color-surface": "#fbf7ec",
      "--color-surface-hover": "#f5efde",
      "--color-fg": "#1a1410",
      "--color-fg-muted": "#5a5043",
      "--color-fg-subtle": "#807666",
      "--color-border": "#d4c9ad",
      "--color-border-strong": "#bdaf90",
      "--color-accent": "#c43200",
      "--color-accent-hover": "#a02900",
      "--color-accent-active": "#7a2000",
      "--color-accent-subtle": "#fce4d2",
    },
  },
  {
    id: "paper",
    name: "Cool Paper",
    tagline: "Neutral, structured. Linear-cool.",
    body: "A cool warm-gray with structured borders. Reads as quietly modern — closest to Linear, Vercel, Resend.",
    vars: {
      "--color-bg": "#eceae5",
      "--color-bg-subtle": "#e0ddd6",
      "--color-surface": "#ffffff",
      "--color-surface-hover": "#f7f6f3",
      "--color-fg": "#16161a",
      "--color-fg-muted": "#4f4e54",
      "--color-fg-subtle": "#75747b",
      "--color-border": "#d2d0c9",
      "--color-border-strong": "#b5b3aa",
      "--color-accent": "#ff4d00",
      "--color-accent-hover": "#e63d00",
      "--color-accent-active": "#c43200",
      "--color-accent-subtle": "#fff1ea",
    },
  },
  {
    id: "stone",
    name: "Modern Stone",
    tagline: "Deep earth. Mast / Aesop.",
    body: "A grounded warm stone with creamy cards. More personality than neutral, less saturated than cream. Premium without being precious.",
    vars: {
      "--color-bg": "#d9cfba",
      "--color-bg-subtle": "#ccc1a8",
      "--color-surface": "#f5eed8",
      "--color-surface-hover": "#ede5cb",
      "--color-fg": "#1c160f",
      "--color-fg-muted": "#564c39",
      "--color-fg-subtle": "#7a7058",
      "--color-border": "#b6a785",
      "--color-border-strong": "#998b6c",
      "--color-accent": "#ff4d00",
      "--color-accent-hover": "#e63d00",
      "--color-accent-active": "#c43200",
      "--color-accent-subtle": "#fde3d2",
    },
  },
  {
    id: "ink",
    name: "Soft Charcoal",
    tagline: "Inverted. Light type, dark canvas.",
    body: "An inverted light theme — soft charcoal canvas, cream type, orange accents. The 'contrasting bits' option. Less common, more memorable.",
    vars: {
      "--color-bg": "#1f1c18",
      "--color-bg-subtle": "#2a2620",
      "--color-surface": "#28241e",
      "--color-surface-hover": "#322d26",
      "--color-fg": "#f5eedc",
      "--color-fg-muted": "#b8ac95",
      "--color-fg-subtle": "#857a66",
      "--color-border": "#3d3830",
      "--color-border-strong": "#544d42",
      "--color-accent": "#ff7a40",
      "--color-accent-hover": "#ff924d",
      "--color-accent-active": "#ffa07a",
      "--color-accent-subtle": "rgba(255, 122, 64, 0.12)",
    },
  },
];

export default function StyleguidePage() {
  const [paletteId, setPaletteId] = useState<string>("linen");
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];

  // Cascade the chosen palette to <html> so the body bg follows along —
  // matters most for the inverted "Soft Charcoal" option, where the body
  // would otherwise show the default off-white through any overscroll.
  useEffect(() => {
    const root = document.documentElement;
    const previous: Record<string, string> = {};
    for (const [key, value] of Object.entries(palette.vars)) {
      previous[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, value);
    }
    return () => {
      for (const key of Object.keys(palette.vars)) {
        if (previous[key]) root.style.setProperty(key, previous[key]);
        else root.style.removeProperty(key);
      }
    };
  }, [palette]);

  return (
    <div
      className="theme-v2 theme-v2-root min-h-screen transition-colors duration-300"
      style={palette.vars as CSSProperties}
    >
      <Container width="lg" className="py-10">
        {/* ── Top bar ────────────────────────────────────────────── */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] uppercase tracking-[0.14em] font-medium text-[var(--color-fg-subtle)]">
              Design system · v2 preview
            </span>
            <span className="v2-badge v2-badge-accent">Phase 0</span>
          </div>
          <a
            href="/"
            className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← back to live site
          </a>
        </header>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="mb-12">
          <h1 className="text-[42px] sm:text-[56px] leading-[1.05] font-semibold tracking-[-0.025em] text-[var(--color-fg)]">
            Find the <span className="v2-accent-line">right balance.</span>
          </h1>
          <p className="mt-4 text-[16px] sm:text-[18px] leading-[1.6] text-[var(--color-fg-muted)] max-w-2xl">
            Four candidate palettes. Click one to flip the whole page. The one that feels right
            <span className="text-[var(--color-fg)] font-medium"> — neither too light nor too dark — </span>
            becomes the system. Everything else builds on top of it.
          </p>
        </div>

        {/* ── Palette picker ─────────────────────────────────────── */}
        <Section spacing="sm">
          <SectionHeading
            eyebrow="01 · Choose a balance"
            title="Which canvas feels right?"
            description="Each option is a complete palette. Switch between them — the whole page reflows. Currently selected determines the rest of the preview below."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PALETTES.map((p) => {
              const active = p.id === paletteId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaletteId(p.id)}
                  className={`text-left v2-surface p-4 transition-all ${
                    active
                      ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]"
                      : "hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {/* Mini-vignette using THIS palette's colors, regardless of active palette */}
                  <div
                    className="h-20 w-full rounded-[6px] mb-3 relative overflow-hidden border"
                    style={{
                      background: p.vars["--color-bg"],
                      borderColor: p.vars["--color-border"],
                    }}
                  >
                    <div
                      className="absolute top-2 left-2 right-2 h-6 rounded-[4px]"
                      style={{
                        background: p.vars["--color-surface"],
                        border: `1px solid ${p.vars["--color-border"]}`,
                      }}
                    />
                    <div
                      className="absolute bottom-2 left-2 h-3 w-12 rounded-[2px]"
                      style={{ background: p.vars["--color-accent"] }}
                    />
                    <div
                      className="absolute bottom-2 left-16 h-3 w-20 rounded-[2px]"
                      style={{ background: p.vars["--color-fg"], opacity: 0.85 }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[14px] font-semibold text-[var(--color-fg)]">{p.name}</p>
                    {active && (
                      <span className="text-[11px] font-medium text-[var(--color-accent)]">SELECTED</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--color-fg-subtle)] leading-snug">{p.tagline}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-6 v2-surface-subtle p-4">
            <p className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed">
              <span className="font-semibold text-[var(--color-fg)]">{palette.name} — </span>
              {palette.body}
            </p>
          </div>
        </Section>

        {/* ── Tokens ────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="02 · Tokens"
            title="Anatomy of the chosen palette"
            description="Eight semantic tokens. Used everywhere downstream — nothing in the app picks a raw hex."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "bg", swatch: "var(--color-bg)", label: palette.vars["--color-bg"] },
              { name: "bg-subtle", swatch: "var(--color-bg-subtle)", label: palette.vars["--color-bg-subtle"] },
              { name: "surface", swatch: "var(--color-surface)", label: palette.vars["--color-surface"] },
              { name: "border", swatch: "var(--color-border)", label: palette.vars["--color-border"] },
              { name: "fg", swatch: "var(--color-fg)", label: palette.vars["--color-fg"] },
              { name: "fg-muted", swatch: "var(--color-fg-muted)", label: palette.vars["--color-fg-muted"] },
              { name: "fg-subtle", swatch: "var(--color-fg-subtle)", label: palette.vars["--color-fg-subtle"] },
              { name: "accent", swatch: "var(--color-accent)", label: palette.vars["--color-accent"] },
            ].map((token) => (
              <div key={token.name} className="v2-surface p-3">
                <div
                  className="h-12 w-full rounded-[6px] border border-[var(--color-border)] mb-2"
                  style={{ background: token.swatch }}
                />
                <p className="text-[13px] font-medium text-[var(--color-fg)]">{token.name}</p>
                <p className="text-[11px] font-mono text-[var(--color-fg-subtle)] truncate">{token.label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Typography ───────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="03 · Typography"
            title="One typeface, clear size jumps"
            description="Inter at six steps. No display serif on product surfaces — reserve it for one or two marketing accents."
          />
          <div className="v2-surface p-6 space-y-5">
            {[
              { tag: "h1", size: "48 / 52 / -0.02em", className: "text-[48px] leading-[52px] tracking-[-0.02em] font-semibold" },
              { tag: "h2", size: "32 / 38 / -0.01em", className: "text-[32px] leading-[38px] tracking-[-0.01em] font-semibold" },
              { tag: "h3", size: "22 / 28", className: "text-[22px] leading-[28px] font-semibold" },
              { tag: "body-lg", size: "16 / 24", className: "text-[16px] leading-[24px]" },
              { tag: "body", size: "14 / 20", className: "text-[14px] leading-[20px]" },
              { tag: "caption", size: "12 / 16 · 0.14em", className: "text-[12px] leading-[16px] uppercase tracking-[0.14em] font-medium text-[var(--color-fg-subtle)]" },
            ].map((step) => (
              <div key={step.tag} className="flex items-baseline gap-6 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
                <span className="w-20 shrink-0 text-[11px] font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]">{step.tag}</span>
                <span className="w-44 shrink-0 text-[11px] font-mono text-[var(--color-fg-subtle)]">{step.size}</span>
                <span className={`${step.className} text-[var(--color-fg)]`}>The quick brown fox</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ──────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="04 · Buttons"
            title="Three variants, three sizes"
            description="Primary for one decisive action per view. Secondary for everything else. Ghost for tertiary."
          />
          <div className="v2-surface p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Primary sm</Button>
              <Button size="md">Primary md</Button>
              <Button size="lg">Primary lg</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm">Secondary sm</Button>
              <Button variant="secondary" size="md">Secondary md</Button>
              <Button variant="secondary" size="lg">Secondary lg</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm">Ghost sm</Button>
              <Button variant="ghost" size="md">Ghost md</Button>
              <Button variant="ghost" size="lg">Ghost lg</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        {/* ── Cards ────────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="05 · Cards"
            title="Surface, subtle, accent"
            description="Borders carry the hierarchy, not shadows. No glassmorphism, no gradient washes."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardCaption>Default surface</CardCaption>
                <CardTitle>Today&apos;s reading</CardTitle>
              </CardHeader>
              <CardDescription>
                Clean card with a hairline border. Used for primary content tiles across every product page.
              </CardDescription>
            </Card>
            <Card tone="subtle">
              <CardHeader>
                <CardCaption>Subtle</CardCaption>
                <CardTitle>Quick facts</CardTitle>
              </CardHeader>
              <CardDescription>
                Off-canvas background. Used for secondary content, helper wells, or grouped data.
              </CardDescription>
            </Card>
            <Card tone="accent">
              <CardHeader>
                <CardCaption>Accent</CardCaption>
                <CardTitle>Important note</CardTitle>
              </CardHeader>
              <CardDescription>
                Left-edge accent bar. Used sparingly — one per section at most.
              </CardDescription>
            </Card>
          </div>
        </Section>

        {/* ── Forms ──────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="06 · Forms & badges"
            title="Sharp inputs, single-color focus"
            description="One color picks up state. No fancy backgrounds or insets."
          />
          <div className="v2-surface p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-fg)] mb-1.5">
                Email
              </label>
              <input type="email" placeholder="you@example.com" className="v2-input" />
              <p className="mt-1.5 text-[12px] text-[var(--color-fg-subtle)]">We&apos;ll never share your address.</p>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-fg)] mb-1.5">
                Date of birth
              </label>
              <input type="date" className="v2-input" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="v2-badge">Vedic</span>
            <span className="v2-badge">Premium</span>
            <span className="v2-badge v2-badge-accent">Live now</span>
          </div>
        </Section>

        {/* ── In practice ────────────────────────────────────────── */}
        <Section spacing="md" divided>
          <SectionHeading
            eyebrow="07 · In practice"
            title="The 'Lucky Today' block, recomposed"
            description="What today's hero tile would look like rebuilt against this system. Open the live site in a new tab and compare."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardCaption>Favorable today</CardCaption>
                  <CardTitle className="mt-1 text-[20px]">Excellent day</CardTitle>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-[48px] leading-none font-semibold text-[var(--color-fg)] tabular-nums tracking-[-0.02em]">5</span>
                  <span className="text-[14px] text-[var(--color-fg-subtle)]">/5</span>
                </div>
              </div>
              <CardDescription className="mt-4">
                Stars align beautifully today — seize opportunities with confidence. Somvar ruled by Moon. Shravana Nakshatra brings learning and listening energy. Peak day for coding, documentation, and discovery work.
              </CardDescription>
              <div className="mt-5 flex items-center gap-2">
                <Button size="sm">Open full reading</Button>
                <Button variant="ghost" size="sm">Save</Button>
              </div>
            </Card>
            <div className="space-y-3">
              <Card padding="sm">
                <CardCaption>Color</CardCaption>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border border-[var(--color-border)]" style={{ background: "#f4f1ea" }} />
                  <span className="text-[14px] font-medium text-[var(--color-fg)]">Pearl White</span>
                </div>
              </Card>
              <Card padding="sm">
                <CardCaption>Current hora</CardCaption>
                <p className="mt-2 text-[14px] font-medium text-[var(--color-fg)]">Mercury</p>
                <p className="text-[12px] text-[var(--color-fg-subtle)] tabular-nums">7:00 PM – 8:00 PM</p>
              </Card>
              <Card padding="sm" tone="accent">
                <CardCaption>Today&apos;s mantra</CardCaption>
                <p className="mt-2 text-[14px] font-medium text-[var(--color-fg)]">Om Chandraya Namaha</p>
              </Card>
            </div>
          </div>
        </Section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="mt-12 pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-[12px] text-[var(--color-fg-subtle)]">
              Currently previewing:
            </p>
            <span className="v2-badge v2-badge-accent">{palette.name}</span>
          </div>
          <p className="text-[12px] text-[var(--color-fg-subtle)]">
            Tell me which palette wins and I&apos;ll lock it in for Phase 1.
          </p>
        </footer>
      </Container>
    </div>
  );
}
