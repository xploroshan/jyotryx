"use client";

import Link from "next/link";
import { Button } from "@/components/ui/v2/Button";
import { Card, CardCaption, CardDescription, CardHeader, CardTitle } from "@/components/ui/v2/Card";
import { Container } from "@/components/ui/v2/Container";
import { Section, SectionHeading } from "@/components/ui/v2/Section";

const TOKENS: Array<{ name: string; cssVar: string; hex: string; note: string }> = [
  { name: "bg",            cssVar: "var(--color-bg)",            hex: "#ede4d0", note: "Page canvas — warm linen" },
  { name: "bg-subtle",     cssVar: "var(--color-bg-subtle)",     hex: "#e3d9c1", note: "Wells, striped rows" },
  { name: "surface",       cssVar: "var(--color-surface)",       hex: "#fbf7ec", note: "Card surface" },
  { name: "border",        cssVar: "var(--color-border)",        hex: "#d4c9ad", note: "Hairline" },
  { name: "fg",            cssVar: "var(--color-fg)",            hex: "#1a1410", note: "Primary text" },
  { name: "fg-muted",      cssVar: "var(--color-fg-muted)",      hex: "#5a5043", note: "Secondary text" },
  { name: "fg-subtle",     cssVar: "var(--color-fg-subtle)",     hex: "#807666", note: "Captions" },
  { name: "accent",        cssVar: "var(--color-accent)",        hex: "#c43200", note: "Primary action" },
];

export default function StyleguidePage() {
  return (
    <div className="theme-v2 theme-v2-root min-h-screen">
      <Container width="lg" className="py-10">
        {/* ── Top bar ────────────────────────────────────────────── */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] uppercase tracking-[0.14em] font-medium text-[var(--color-fg-subtle)]">
              Design system · v2 · Warm Linen
            </span>
            <span className="v2-badge v2-badge-accent">Locked</span>
          </div>
          <Link
            href="/"
            className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← back to live site
          </Link>
        </header>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="mb-12">
          <h1 className="text-[42px] sm:text-[56px] leading-[1.05] font-semibold tracking-[-0.025em] text-[var(--color-fg)]">
            The system, <span className="v2-accent-line">locked.</span>
          </h1>
          <p className="mt-4 text-[16px] sm:text-[18px] leading-[1.6] text-[var(--color-fg-muted)] max-w-2xl">
            Warm Linen is the canonical palette. Every page below builds against these tokens
            — change one variable, the whole product reflows.
          </p>
        </div>

        {/* ── Tokens ────────────────────────────────────────────── */}
        <Section spacing="sm">
          <SectionHeading
            eyebrow="01 · Tokens"
            title="Eight semantic colors"
            description="Nothing in the app picks a raw hex. These tokens carry every surface, every state."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOKENS.map((t) => (
              <div key={t.name} className="v2-surface p-3">
                <div
                  className="h-14 w-full rounded-[6px] border border-[var(--color-border)] mb-2"
                  style={{ background: t.cssVar }}
                />
                <p className="text-[13px] font-medium text-[var(--color-fg)]">{t.name}</p>
                <p className="text-[11px] font-mono text-[var(--color-fg-subtle)]">{t.hex}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">{t.note}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Typography ───────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="02 · Typography"
            title="One typeface, clear size jumps"
            description="Inter at six steps. Display serif (Fraunces) reserved for one marketing accent per page."
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
            eyebrow="03 · Buttons"
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
            eyebrow="04 · Cards"
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
                Cream card with a hairline border. Used for primary content tiles across every product page.
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
            eyebrow="05 · Forms & badges"
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
            eyebrow="06 · In practice"
            title="The 'Lucky Today' block, recomposed"
            description="What today's hero tile would look like rebuilt against this system."
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
          <p className="text-[12px] text-[var(--color-fg-subtle)]">
            Warm Linen · locked · Phase 1 (top chrome) next
          </p>
        </footer>
      </Container>
    </div>
  );
}
