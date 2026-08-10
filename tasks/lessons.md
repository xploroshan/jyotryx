# Lessons (self-improvement loop)

Rules derived from real corrections in this project. Review before starting
any related work.

## 1. A control that looks live must BE live (admin switch trap)
**Incident:** "Make app completely free" rendered as a switch that turned
green instantly but only staged local state; the real write was a "Save"
button five screens below. The admin flipped it, left, and the app kept
charging — weeks of "the admin panel is broken" reports.
**Rules:**
- Any toggle/switch UI element must persist on interaction (optimistic +
  revert-on-error), or be visually part of an explicit unsaved-form area.
- Never let two surfaces write the same setting from staged copies — a stale
  tab silently reverts live values. Save each control's own keys only.
- When a user reports "toggle X does nothing", FIRST verify the value
  actually stored (DB/settings endpoint) before assuming the reading side is
  broken. The reading side was never broken here.

## 2. Verify effects, not writes (decorative-controls audit)
**Incident:** The LLM admin tab had provider toggles, API-key rotation,
budgets, and per-feature modes whose settings NOTHING read — writes
succeeded, toasts lied.
**Rules:**
- For every admin-written settings key, there must be a traced consumer in
  the API (test it: settings key → runtime behavior change).
- Removing a decorative control is better than shipping it "for later".
- Effective-state readouts (what the system enforces RIGHT NOW) beat
  documentation of intent; pin them to the real gates with tests.

## 3. Synthetic fixtures can't catch perception bugs (dorsal capture)
**Incident:** Guided camera approved the BACK of a hand — all gates green.
Unit tests used hand-authored landmarks that encoded our own wrong
assumptions (that MediaPipe's handedness label is anatomical; it follows the
2D winding, and an opposite-hand dorsal view is geometrically identical to
the expected palm). The "real MediaPipe" E2E only ever ran on a blank canvas.
**Follow-up correction (owner-supplied palm + dorsal photos):** my first
diagnostic (n=1) concluded "the label follows the winding" — WRONG. With all
quadrants measured (n=4): the label is ANATOMICAL (the classifier sees
nails), the winding encodes the SIDE, and the shipped formula was simply
inverted — it rejected real palms and approved dorsals. The inverted formula
had "passing tests" because the synthetic fixture was authored with the same
backwards anatomy assumption.
**Rules:**
- Any gate built on an ML model's output must be validated against REAL
  inputs through the REAL model at least once (e2e/fixtures/ + the
  palmistry-real-pipeline.spec.ts harness) — measure, don't assume
  conventions from docs.
- One measured sample is not semantics: cover every quadrant of the decision
  table (palm/dorsal × left/right) with LABELED ground truth before deriving
  a formula. A theory fitted to n=1 encoded a second wrong model.
- Never author a synthetic fixture from the same assumption the code makes —
  derive fixtures from measured real-input values.
- VIDEO-mode tracking state is not evidence about the captured STILL —
  re-verify the exact artifact you ship (post-capture IMAGE-mode confirm).
- User-reported failures make the best regression fixtures (the incident
  photo is committed and pinned in E2E).

## 4. Failure messages must point at the actual cause
**Incident:** The dorsal photo failed with "try a clearer, well-lit photo" —
true but misleading; the problem was which SIDE of the hand faced the camera.
**Rule:** Every honest-failure path should carry a machine-readable code end
to end (pipeline → 422 body / poll failCode → localized client copy) so the
user's next attempt actually fixes the problem.

## 5. An LLM feature with no injected "now" answers from its training cutoff
**Incident:** "When will I find a job" in Chat with Astrologer returned "mid
2024" — a window already in the past. The chat system prompt carried the
user's DOB but no current date, no computed chart and no dasha timeline, even
though `kundli_charts.chartData` already held a per-user Vimshottari tree with
real ISO dates and `GocharService` could compute today's transits from the
exact fields chat was already fetching. Every timing answer was invented; this
one was just visibly wrong.
**Rules:**
- Any prompt whose answers can be time-relative MUST carry `TODAY'S DATE:
  <ISO>` plus an explicit "never name a window that has already passed"
  clause. The date alone is not enough — models still echo a memorised year.
- Before adding LLM reasoning, grep for a DETERMINISTIC source of the same
  fact. This codebase computes charts, dashas and transits from Swiss
  Ephemeris; a feature that asks the model to guess them is strictly worse and
  usually already has the data one query away.
- Read-only grounding must use the PERSISTED artifact when the compute path
  charges credits (`generateKundli` bills 2) — grounding must never bill.
- Absence of data must be stated, not omitted. A prompt that drops the profile
  block but keeps "use the user's actual birth details for accurate chart
  reading" produces a confidently fabricated ascendant. Emit an explicit
  MISSING-DATA block and make chart instructions conditional on the tier.

## 6. The open-ended surface needs the strictest guardrails, not the loosest
**Incident:** `palmistry.service.ts` has carried "Never claim to predict death,
exact dates, or medical diagnoses" since launch. Chat — where a user can ask
literally anything — carried no harm clause at all, and `self-harm` /
`self-harm/intent` were absent from HARD_BLOCK_CATEGORIES, so a suicidal
disclosure was forwarded to an astrology persona (or, once blocked, answered
with "this violates our content policy").
**Rules:**
- When one feature gets a safety clause, audit every sibling that reaches the
  same model. Keep the wording in ONE shared constant.
- Crisis categories get a crisis RESPONSE (helplines, no astrology, never
  charged), never a generic policy rejection.

## 7. "Returns null on failure" silently defeats a refund written as try/catch
**Incident:** `LlmService.chatCompletion` returns `null` when every provider in
the failover chain fails — it never throws. Chat's refund lived in a `catch`,
so the dominant outage path skipped it: the user paid full price for canned
boilerplate, and the streaming path *incremented* the meter on it. Separately,
the SSE observer hardcoded `refunded: true` for failures whose refund handler
had never run.
**Rules:**
- Check the failure CONTRACT of a dependency (null vs throw) before relying on
  try/catch for money. Model degradation explicitly (`{ text, degraded }`).
- Never report a refund you did not perform — derive the flag from the refund
  call's own return value.
- Everything after the charge point belongs inside the refund handler,
  including DB writes and retrieval, not just the model call.
- Metered features must CLAIM atomically (`tryConsumeUsage`) and release on
  failure; check-then-increment across an LLM round-trip is an open door.
