---
name: ultra-review
description: Run an exhaustive, adversarially-verified code review of a change — deeper than a quick pass. Fans out independent reviewers across many dimensions (correctness, security, concurrency, data integrity, API/contract, error handling, resource/perf, tests, readability), then verifies every finding to kill false positives before reporting. Use this whenever the user asks for a thorough / deep / exhaustive / rigorous review, an "ultra review", an "ultra code review" or "code review ultra", running code-review "at max effort", a code audit, a pre-merge or pre-release review of a large or risky change, a security-sensitive review, or says things like "review this really carefully", "go over the whole diff", "find every bug", "is this safe to merge". For a quick single-file or routine review a normal review is enough — reach for this when the user signals depth or risk, or the change is large or safety-critical.
---

# Ultra Review

An exhaustive, multi-pass code review that trades speed for confidence. A normal review reads the diff once and reports what jumps out. Ultra Review instead runs **many independent reviewers in parallel**, each looking through a different lens, then **adversarially verifies every candidate finding** before it reaches the user — so what you report is ranked, deduplicated, and false-positive-filtered, not a raw brain-dump.

Use it when the cost of a missed bug is high: pre-merge review of a large or risky change, security-sensitive code, data-migration or money-touching paths, or any time the user explicitly asks for depth.

**How this differs from a normal review** (e.g. the built-in `code-review` / `security-review`): those read the diff once at a chosen effort level and report quickly — the right default for routine changes. Ultra Review is the escalation: many independent lenses instead of one, plus a verification pass. It costs more time and tokens, so don't reach for it on a small or low-stakes diff.

## Why it's structured this way

Single-pass review has two failure modes. It **misses** things — one reader scanning for "anything wrong" spreads attention thin and skips whole classes of defect (a reviewer thinking about logic rarely also thinks about lock ordering). And it **over-reports** — plausible-sounding findings that dissolve the moment you trace the actual code path, which erode trust and waste the user's time. Fanning out by dimension fixes the first; adversarial verification fixes the second. Keep both — dropping either collapses this back into an ordinary review.

## Workflow

### 1. Establish scope

Figure out exactly what to review before reading anything:

- **Default**: the uncommitted working diff — `git diff HEAD` plus new/untracked files (`git status --short`).
- **Branch/PR**: if the user names a branch or PR, review its full diff against the merge base — `git merge-base <base> HEAD` then `git diff <mergebase>...HEAD`. For a GitHub PR, pull the diff via the available GitHub tools.
- **Explicit paths**: if the user names files or a directory, review those.

Read the full diff yourself first so you can scope the fan-out and write reviewer prompts that reference real symbols. If the change is large, list the touched files and group them (by subsystem or by concern) so each reviewer gets a coherent slice. State the scope you settled on in one line before proceeding.

If you delegate to subagents, they do **not** share your context — carry the exact scope into every reviewer and verifier prompt, either by pasting the diff text or by giving the precise git command from this step (e.g. `git diff <mergebase>...HEAD`). Otherwise a subagent that naively runs `git diff HEAD` will review the wrong slice.

### 2. Fan out reviewers by dimension

Run these lenses **independently and in parallel** — each reviewer sees the diff and hunts only for its own class of defect. Independence is the point: a reviewer told to find everything finds less than five reviewers each told to find one thing.

Adapt the set to the change (skip concurrency for a static-config edit; add a migration lens for schema changes). Default dimensions:

- **Correctness / logic** — off-by-one, wrong operator or boundary, inverted condition, unhandled case, incorrect algorithm, state that can go stale, copy-paste that wasn't fully adapted.
- **Security** — injection (SQL/command/template), authz/authn gaps, secrets in code or logs, unsafe deserialization, SSRF, path traversal, missing input validation on a trust boundary.
- **Concurrency / ordering** — data races, non-atomic read-modify-write, lock ordering and deadlock, await points that widen a critical section, assumptions about execution order that don't hold.
- **Error handling / resilience** — swallowed errors, error paths that leak resources or leave partial state, missing rollback, retries without idempotency or backoff, unhandled rejections.
- **Data integrity** — schema/migration hazards, nullability and type mismatches, precision/rounding on money, timezone handling, lost updates, missing constraints or transactions.
- **API / contract / compatibility** — breaking changes to a public signature, response shape, or serialized format; back-compat with existing callers and stored data; pagination/limit changes.
- **Resource / performance** — N+1 queries, unbounded growth, work inside a hot loop, missing index for a new query pattern, blocking I/O on a hot path, leaks. Flag only where it plausibly matters, not micro-optimizations.
- **Tests / coverage** — new logic with no test, tests that assert the wrong thing or can't fail, missing edge/error-path coverage, flakiness (time, ordering, network).
- **Readability / simplification** — dead code, needless complexity, a duplication of something that already exists in the repo, a name that misleads. Lowest severity; include only clear wins.

Each reviewer returns findings as: `{ file, line, dimension, severity (critical|high|medium|low), summary, failure_scenario (concrete inputs/state → wrong outcome), suggested_fix }`. Insist on a **concrete failure scenario** — a finding that can't name inputs that break is usually not real, and demanding the scenario is itself a filter.

### 3. Deduplicate

Different lenses will surface the same defect (a missing null check reads as both correctness and data-integrity). Merge findings that point at the same file+line+root-cause into one, keeping the highest severity and the clearest failure scenario. Do this across the full set before verification so you don't verify the same thing three times.

### 4. Adversarially verify every finding

This is what separates ultra review from a louder normal review. For each deduplicated finding, run an **independent** check whose job is to *refute* it — trace the actual code path and prove the failure scenario either real or impossible. Record each verdict as **confirmed**, **refuted**, or **uncertain** (checker couldn't conclusively do either), with the reasoning.

Calibrate what happens to an "uncertain" verdict by severity — this is deliberate, because the two ways to fail a review are not symmetric:

- **Low / medium findings**: default an uncertain verdict to *refuted* and drop it. At this severity a plausible-but-wrong finding costs more trust than it's worth, so the burden is on the finding to survive.
- **High / critical findings**: **never silently drop an uncertain one.** Surface it in the report flagged as *unconfirmed — needs human verification*. An audit exists precisely to catch high-stakes bugs; quietly discarding a possible auth bypass because the refuter couldn't fully trace it is the exact failure this skill is meant to prevent.

For high-severity or genuinely ambiguous findings, use more than one verifier with **different lenses** (e.g. "does it reproduce?" vs "is this reachable from any real caller?") before settling the verdict.

### 5. Report

Report confirmed findings plus any unconfirmed high/critical ones, ranked most-severe first. Empty is a valid, good result — say so plainly rather than inventing filler. Map severity to buckets: **critical + high → Blocking**, **medium → Worth fixing**, **low → Minor**. Use this structure:

```
## Ultra Review — <scope>

<one-line verdict: e.g. "2 blocking issues, 3 worth fixing, safe otherwise">

### Blocking            (critical + high, confirmed)
1. <severity> — <file:line> — <one-sentence defect>
   - Fails when: <concrete scenario>
   - Fix: <specific suggestion>

### Worth fixing        (medium)
...

### Minor / optional    (low)
...

### Unconfirmed — needs human verification   (high/critical the verifier couldn't confirm or refute)
- <file:line> — <what it might be> — <why it couldn't be settled>

### Verified clean
<dimensions checked that came back clean — so the reader knows what was actually looked at>
```

Omit the Unconfirmed section when there's nothing in it. Always list the dimensions you covered (even the clean ones) — a review's value is as much in what it ruled out as what it found. If you narrowed scope or skipped a dimension, say so; silent gaps read as coverage that wasn't there.

### 6. Apply fixes (only if asked)

If the user asked to fix as well as find, apply the surviving findings to the working tree after reporting, smallest-risk first, and re-verify each fix compiles/passes. Don't apply speculative or low-confidence fixes without confirming. Never auto-commit unless the user asked.

## How to run the fan-out

The method — fan out by dimension, dedupe, adversarially verify, report — is what matters, and it works with **no special tools at all**. Parallelism is only an accelerator. Use whatever the current environment offers:

- **No subagents (the universal path — this is how it runs on claude.ai)** — do the passes sequentially yourself. Re-read the diff once per dimension with only that lens active; genuinely reset your attention between lenses rather than skimming for "anything wrong" in one pass — the separation is what makes the fan-out worth more than a single read. Then do a deliberate refute-pass over each finding before it enters the report. Slower than parallel, but this is the full method and is far stronger than one glance.
- **Subagents available (Agent tool)** — parallelize it: spawn one reviewer subagent per dimension in a single message, collect and dedupe their structured findings, then spawn one verifier subagent per finding, and synthesize the survivors yourself. Remember subagents don't share your context — carry the exact scope (Step 1) into every prompt.
- **A batch orchestration primitive available (e.g. a Workflow tool)** — if the environment exposes one, use it to pipeline each dimension's `review → verify` and run the per-finding verifiers concurrently. Optional; never assume it exists, and don't block on it.

Scale the effort to the request and the change: a small diff with "review this carefully" wants the core dimensions and single-vote verification; "audit this before we ship" wants the full dimension set, multi-verifier adversarial passes on anything high-severity, and an explicit note of what was and wasn't covered.
