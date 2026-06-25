# Marketing execution playbooks

These are the per-channel execution playbooks that sit under the top-level
[`../marketing-plan.md`](../marketing-plan.md) (the 13-section AARRR plan). The
plan says *what* and *why*; these say *how*, grounded in the actual codebase.

| Area | Playbook | What it covers |
|------|----------|----------------|
| Analytics | [analytics/measurement-plan.md](analytics/measurement-plan.md) | The funnel, the live event tracking plan, GA4-vs-PostHog roles, the dashboards to build, and how to switch it all on in Vercel. |
| AI-SEO | [ai-seo/aeo-playbook.md](ai-seo/aeo-playbook.md) | Answer-engine optimization: target queries, the `/learn` definitional-cluster build spec, FAQ localization, llms.txt upkeep, monthly prompt-tests. |
| Pricing | [pricing/pricing-packaging.md](pricing/pricing-packaging.md) | Annual-default rationale, value-anchor copy bank, the paywall trigger→message map, NRI geo-pricing, the first A/B tests. |
| Social | [social/social-playbook.md](social/social-playbook.md) | The share loop (ShareButton + per-reading OG snapshot build), short-form video plan, content calendar, hooks bank. |
| Community | [community/community-playbook.md](community/community-playbook.md) | Reddit/Quora/FB channel map, value-first rules, weekly cadence + UTM tracking, honest review seeding, 90-day ramp. |
| Ideas | [ideas/idea-backlog.md](ideas/idea-backlog.md) | ICE-scored, AARRR-tagged backlog of 30+ ideas tailored to this stage, acquisition-first, with a "pull the next 5". |

**What shipped alongside these docs (code, on this branch):** GA4+PostHog funnel
instrumentation; pricing annual-default + value anchor + in-product `UpgradePrompt`;
a reusable `ShareButton` on horoscope pages; an enriched `llms.txt`. Each playbook
flags its own follow-on builds (server-truth revenue events, the `/learn` cluster,
per-reading OG snapshots, subscription-management + dunning).

Brand-voice rules apply throughout: no fear-selling, no fabricated proof, shows
its work, warm and honest.
