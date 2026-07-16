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
**Rules:**
- Any gate built on an ML model's output must be validated against REAL
  inputs through the REAL model at least once (e2e/fixtures/ + the
  palmistry-real-pipeline.spec.ts harness) — measure, don't assume
  conventions from docs.
- When a check turns out to be geometrically impossible (2D palm-vs-dorsal),
  say so in the code and move the enforcement to a layer that has the needed
  signal (server vision check sees appearance; landmarks don't).
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
