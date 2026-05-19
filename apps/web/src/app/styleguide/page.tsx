"use client";

import { Button } from "@/components/ui/v2/Button";
import { Card, CardCaption, CardDescription, CardHeader, CardTitle } from "@/components/ui/v2/Card";
import { Container } from "@/components/ui/v2/Container";
import { Section, SectionHeading } from "@/components/ui/v2/Section";

export default function StyleguidePage() {
  return (
    <div className="theme-v2 min-h-screen">
      <Container width="lg" className="py-12">
        <header className="mb-12 flex items-end justify-between border-b border-[var(--color-border)] pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium mb-2">
              Design system · v2 (preview)
            </p>
            <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
              myastro360 <span className="v2-accent-line">redesigned</span>
            </h1>
            <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] max-w-xl">
              Phase 0 of the overhaul. New tokens, new primitives. Approve the system here and the rest of the site rebuilds on top of it.
            </p>
          </div>
          <a href="/" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
            ← back to live site
          </a>
        </header>

        {/* ── Color tokens ─────────────────────────────────────────── */}
        <Section spacing="sm">
          <SectionHeading
            eyebrow="01 · Tokens"
            title="A quieter palette, one sharp accent"
            description="Off-white canvas, pure-white surfaces, charcoal text. Orange used only on primary actions and a single editorial underline per page."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "bg", value: "#faf9f7", swatch: "var(--color-bg)" },
              { name: "surface", value: "#ffffff", swatch: "var(--color-surface)" },
              { name: "bg-subtle", value: "#f4f3f0", swatch: "var(--color-bg-subtle)" },
              { name: "border", value: "#e7e5e1", swatch: "var(--color-border)" },
              { name: "fg", value: "#0a0a0a", swatch: "var(--color-fg)" },
              { name: "fg-muted", value: "#525252", swatch: "var(--color-fg-muted)" },
              { name: "fg-subtle", value: "#737373", swatch: "var(--color-fg-subtle)" },
              { name: "accent", value: "#ff4d00", swatch: "var(--color-accent)" },
            ].map((token) => (
              <div key={token.name} className="v2-surface p-3">
                <div
                  className="h-12 w-full rounded-[6px] border border-[var(--color-border)] mb-2"
                  style={{ background: token.swatch }}
                />
                <p className="text-[13px] font-medium text-[var(--color-fg)]">{token.name}</p>
                <p className="text-[11px] font-mono text-[var(--color-fg-subtle)]">{token.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Typography ───────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="02 · Typography"
            title="One typeface, clear size jumps"
            description="Inter at six steps. No display serif on product surfaces — reserve it for marketing accents only."
          />
          <div className="space-y-5">
            {[
              { tag: "h1", size: "48px / 52px / -0.02em", className: "text-[48px] leading-[52px] tracking-[-0.02em] font-semibold" },
              { tag: "h2", size: "32px / 38px / -0.01em", className: "text-[32px] leading-[38px] tracking-[-0.01em] font-semibold" },
              { tag: "h3", size: "22px / 28px", className: "text-[22px] leading-[28px] font-semibold" },
              { tag: "body-lg", size: "16px / 24px", className: "text-[16px] leading-[24px]" },
              { tag: "body", size: "14px / 20px", className: "text-[14px] leading-[20px]" },
              { tag: "caption", size: "12px / 16px · uppercase 0.14em", className: "text-[12px] leading-[16px] uppercase tracking-[0.14em] font-medium text-[var(--color-fg-subtle)]" },
            ].map((step) => (
              <div key={step.tag} className="flex items-baseline gap-6 border-b border-[var(--color-border)] pb-4">
                <span className="w-24 shrink-0 text-[11px] font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]">{step.tag}</span>
                <span className="w-56 shrink-0 text-[12px] font-mono text-[var(--color-fg-subtle)]">{step.size}</span>
                <span className={step.className}>The quick brown fox</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ──────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="03 · Buttons"
            title="Three variants, three sizes"
            description="Primary for one decisive action. Secondary for everything else. Ghost for tertiary nav."
          />
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button size="sm">Primary sm</Button>
              <Button size="md">Primary md</Button>
              <Button size="lg">Primary lg</Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm">Secondary sm</Button>
              <Button variant="secondary" size="md">Secondary md</Button>
              <Button variant="secondary" size="lg">Secondary lg</Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">Ghost sm</Button>
              <Button variant="ghost" size="md">Ghost md</Button>
              <Button variant="ghost" size="lg">Ghost lg</Button>
            </div>
            <div className="flex items-center gap-3">
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
            description="Borders carry the hierarchy, not shadows. No glassmorphism, no gradients."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardCaption>Default surface</CardCaption>
                <CardTitle>Today&apos;s reading</CardTitle>
              </CardHeader>
              <CardDescription>
                A clean white card with a hairline border. Use for primary content.
              </CardDescription>
            </Card>
            <Card tone="subtle">
              <CardHeader>
                <CardCaption>Subtle</CardCaption>
                <CardTitle>Quick facts</CardTitle>
              </CardHeader>
              <CardDescription>
                Off-white background. Use for secondary content or grouped wells.
              </CardDescription>
            </Card>
            <Card tone="accent">
              <CardHeader>
                <CardCaption>Accent</CardCaption>
                <CardTitle>Important note</CardTitle>
              </CardHeader>
              <CardDescription>
                Left-edge accent bar. Use sparingly — one per section at most.
              </CardDescription>
            </Card>
          </div>
        </Section>

        {/* ── Inputs ──────────────────────────────────────────────── */}
        <Section spacing="sm" divided>
          <SectionHeading
            eyebrow="05 · Forms"
            title="Inputs, badges, helpers"
            description="Sharp borders, single-color focus ring, no fancy backgrounds."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
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
          <div className="mt-8 flex items-center gap-2">
            <span className="v2-badge">Vedic</span>
            <span className="v2-badge">Premium</span>
            <span className="v2-badge v2-badge-accent">Live now</span>
          </div>
        </Section>

        {/* ── Composition example ─────────────────────────────────── */}
        <Section spacing="md" divided>
          <SectionHeading
            eyebrow="06 · In practice"
            title="A sample bento, recomposed"
            description="What the “Lucky Today” block would look like rebuilt against this system."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardCaption>Favorable today</CardCaption>
                  <CardTitle className="mt-1">Excellent day</CardTitle>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[40px] leading-none font-semibold text-[var(--color-fg)] tabular-nums">5</span>
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
            <div className="space-y-4">
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

        <footer className="mt-16 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
          <p className="text-[12px] text-[var(--color-fg-subtle)]">
            v2 preview · approve here before the rest of the site migrates
          </p>
          <Button variant="secondary" size="sm">Approve & continue to Phase 1</Button>
        </footer>
      </Container>
    </div>
  );
}
