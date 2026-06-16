# CLAUDE.md — Project Context

> This file is read automatically by Claude Code. It is the single source of truth
> for what we are building, the locked technical stack, and the rules that must not
> be broken. Keep it short and current. When something changes, change it here first.

## 1. Product in one line

A multi-tenant SaaS for personal trainers and nutritionists where **AI does the heavy,
repetitive work** (drafting programs, nutrition plans, check-ins, progress analysis) so
that each coach **earns more and works less** — without losing the human touch.

Business model: B2B2C. We serve the coach (B2B); the coach serves their clients (B2C);
the platform sits in the middle and automates the boring parts for both sides.

## 2. Non-negotiable invariants

These never change. If a task seems to require breaking one of these, stop and ask.

1. **Human-in-the-loop.** AI never sends anything to a client on its own. Every AI
   artifact (program, nutrition plan, check-in summary, message draft) is created as a
   `draft`, must be reviewed and approved by the coach, and only then becomes visible to
   the client. The coach is always in control.
2. **Multi-tenant from day one.** Every domain row carries a `tenant_id`. Isolation is
   enforced in the database with Postgres Row-Level Security (RLS), not in application
   code. Even while only one coach (the pilot) uses the system, build it multi-tenant.
3. **Secrets stay server-side.** No API key (AI, Stripe, etc.) ever reaches the browser.
   All third-party calls happen in Supabase Edge Functions.
4. **EU data residency.** Health-adjacent data. Supabase project and all processing in an
   EU region. Treat biometric/health fields as sensitive.

## 3. Locked stack (do not swap)

One language end to end, a relational database that scales for years, and a hosting setup
with near-zero starting cost. Chosen for solidity and longevity, not novelty.

- **Language:** TypeScript everywhere (frontend + Edge Functions).
- **Frontend / app:** Next.js (App Router) delivered as an installable **PWA**
  (works on iOS and Android browsers — no native app store build in the MVP).
  Styling with Tailwind CSS. **Mobile-first, dark-mode-first** (gym use).
- **Backend + database:** **Supabase** — managed PostgreSQL + Auth + Storage + RLS +
  Edge Functions (Deno/TypeScript). Under the hood it is plain Postgres, so we are never
  locked in.
- **AI layer:** **Anthropic Claude API**, called only from Edge Functions. All AI output
  is **structured JSON validated against a schema** before it is stored.
- **Payments:** **Stripe** (move to Stripe Connect when we onboard multiple coaches).
- **Transactional email:** Resend. **Client messaging (WhatsApp): later**, not in MVP.
- **Hosting:** Vercel (Next.js) + Supabase Cloud, both EU region.
- **Source control:** GitHub.

Native mobile apps, wearables, and white-label branding are **future phases**, designed
to plug into this core without rewriting it.

## 4. MVP scope — build ONLY this first

The MVP is a single end-to-end vertical slice that proves the core promise ("less work").
Build it for one pilot coach first, on the multi-tenant foundation.

In scope:

1. **Roles & auth:** admin, coach, client.
2. **Onboarding funnel:** lead → intake questionnaire → Stripe checkout → client account.
3. **AI program generation (the wedge):** from the client intake, AI drafts a training
   program (nutrition optional) → status `draft` → coach reviews/edits → coach approves →
   status `published` and visible to the client.
4. **Client PWA:** view the assigned program; fast memory-based workout logging; rest
   timer with background notifications; supersets/giant-sets UI; high-visibility notes;
   dark mode.
5. **Automated check-ins:** scheduled prompts to the client → responses stored → AI
   summarizes what changed → coach approves any adjustment.

Explicitly OUT of MVP scope (later phases): wearable integration, AI photo nutrition,
native iOS/Android apps, drag-and-drop program builder, advanced biometric dashboards,
multi-brand white-label, CRM/funnel automation beyond the basic intake.

## 5. Core data model (all tables carry tenant_id + RLS)

- `tenants` — one per coach/brand.
- `profiles` — users, linked to auth, with role (admin/coach/client) scoped to a tenant.
- `clients` — client records owned by a coach.
- `intakes` — questionnaire answers used to seed AI generation.
- `exercises` — per-tenant exercise library (grounding source for AI).
- `programs` and `program_versions` — versioned artifacts with an
  `artifact_status` enum: `draft` → `pending_review` → `approved` → `published` → `archived`.
- `sessions` / `workout_logs` — what the client actually did.
- `checkins` — scheduled prompts and client responses.
- `nutrition_plans` — optional, same draft→approve lifecycle.
- `messages` — coach/client communication (in-app first).
- `subscriptions` / `payments` — Stripe state.
- `activity_log` — audit trail.

## 6. AI layer rules

- Server-side only (Edge Functions).
- Always request **structured JSON** and validate against a schema before persisting.
- **Ground** generation on the tenant's own exercise/food libraries; do not invent
  exercises outside the library.
- Guardrails: no medical claims; flag anything health-sensitive for coach attention.
- Every AI artifact enters as `draft` / `pending_review`. Never auto-publish.

## 7. Security & GDPR

- RLS policy on every table; test cross-tenant access (a coach must never read another
  tenant's data).
- Secrets only in Edge Function environment variables.
- EU region; health data minimized and treated as sensitive.
- Audit important actions in `activity_log`.

## 8. Development conventions

- SQL migrations are committed to the repo and applied in order; no manual schema edits.
- Write an RLS test for every new table before building UI on top of it.
- No per-tenant code branches — tenants differ by **data/config only**.
- Typed end to end (generate DB types from Supabase).
- Ship in small vertical slices: one screen / one flow working end-to-end before the next.

## 9. Open decisions (small, to close as we go)

- Nutrition disclaimers / legal wording.
- Exact check-in cadence (weekly default to start).
- Claude model tier per task (cheaper model for summaries, stronger for generation).
- WhatsApp provider when messaging is added (360dialog vs Twilio).
