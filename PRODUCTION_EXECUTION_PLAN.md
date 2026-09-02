# JC ON THE MOVE Production Execution Plan

_Authoritative snapshot: September 2, 2026 (America/Chicago)._ This is the single release and operations plan for the current release train. It replaces the old Render/Replit-oriented deployment notes for the active production path. Product strategy, payment-rail sequencing, and the GSG operating model live in [`MASTER_GAME_PLAN.md`](./MASTER_GAME_PLAN.md); this document remains the release checklist.

## Decisions already made

| Area | Decision | Evidence |
| --- | --- | --- |
| Production platform | Railway is the active production host. | `www.jconthemove.com/api/health` reported Railway and commit `a34b2fe5` on September 2, 2026. |
| Canonical readiness endpoint | `https://www.jconthemove.com/api/health` | Returns `status: ready`, database ready, and a deploy commit. |
| Deployment model | Railway Git integration deploys `main`; GitHub validates the public commit after each push. | Public commit matches current `main` head. |
| Card payments | Square remains the sole card/invoice processor. | Existing payment and launch-checklist design. |
| Job close-out | Quote → paid/dispatch → in progress → complete → payout review/approval → worker payout → JCMOVES issue. | Current lifecycle, payout engine tests, and admin payout surface. |
| Local PM2 | Development-only; it is not a production availability signal. | The stopped `jc-api-5012` process lacks `web-push`; do not restart it until Node 20 and a clean install are restored. |

## Current evidence

- Production was healthy when checked on September 2: Railway, HTTP 200, readiness `ready`, database `ready`, public commit `a34b2fe5`.
- The combined release is preserved in Git and includes the current production Facebook Page pilot and private Square gift-card bonus controls. It is not approved for `main` until every gate below passes on the combined commit.
- An official portable Node 20 runtime is available locally. The original worktree dependency folder became partial during clean-install recovery, so release validation must use an isolated checkout and a fresh `npm ci`.
- Before the production merge, all 39 discovered server test files passed. Types, the post-merge server suite, build, and browser checks remain open gates and must not be inferred from that earlier result.
- The release train groups roughly eight connected streams: staff Job Brief, job lifecycle/crew/payout, quote and Square delivery, marketing/zone pricing, notifications, Facebook Page pilot, private gift-card rewards, and production operations.
- The August 31 Ironwood test-job time has passed. No stale job alert should be created or sent; a fresh date, time, recipient scope, and owner approval are required for any live notification test.

## Reconciled work inventory

Chat titles and historical task briefs are not completion proof. An item is only closed when its current code, tests, and (where needed) production behavior prove it. The accessible evidence currently groups the active worktree as follows:

| Release area | Current implementation evidence | Required close-out proof |
| --- | --- | --- |
| Fast staff job view | `client/src/pages/lead-detail.tsx` contains the mobile Job Brief, contextual next action, compact finance/JCMOVES state, and collapsed advanced detail. | Mobile and desktop role-based browser check against representative missing-data and payout states. |
| Job handoff, crew, and payout | `admin/jobs`, `admin/ops-board`, `admin/job-payouts`, dispatch services, and `server/routes.ts` are in the active release train. | Server tests plus completed-job → payout approval → worker payout → JCMOVES production smoke test. |
| Quote, invoice, and customer contact | `server/services/square-invoice.ts`, `server/routes.ts`, `JobOrderBuilder.tsx`, and Job Detail are in the active release train. | Square sandbox/production-safe test of quote, email/SMS consent, payment link, deposit, and dispatch authorization. |
| Targeted-area marketing | Zone-pricing, launch-checklist, campaign analytics, and tracked-link code are in the active release train. | Launch Checklist probe and one public tracked-link/quote smoke test; verify attribution without creating a real customer charge. |
| Notifications | Job-event routing, Discord/web-push delivery, readiness reporting, and route-wiring tests are in the active release train. | Owner-only or preview-mode test first; confirm recipients and payload before authorizing a crew-wide alert. |
| Facebook and gift-card pilots | Company Page import controls and private, staged Square gift-card bonus settings are included from production. | Keep both pilots explicitly scoped; prove consent, attribution, and payment/reward audit records before widening access. |
| Production operations | Railway workflows, public health verifier, and Launch Checklist wording were aligned in this release. | Push `main`, see the exact commit on public readiness, then observe at least one scheduled availability run. |

### Historical chat triage

The visible chat list falls into four queues. Keep them out of the release until each has a current acceptance test:

1. **P0 – revenue and operations:** duplicate scheduler cleanup, jobs that need a specific calendar/docket entry, lead recovery, and test-lead cleanup. These require a data-scope review before any mutation.
2. **P1 – conversion and customer experience:** quote wording, targeted-area marketing, website job listings, text-lead intake, and the booking funnel. These require public-path and analytics verification.
3. **P1 – crew and administration:** admin capabilities, adding or correcting workers, JCMOVES/payout linkage, and external notifications. These require authorization and payout-audit checks.
4. **P2 – integrations and outreach:** Discord/Bill, campaigns, and non-critical workflow polish. These require explicit account/recipient authorization before connection or messaging.

Do not merge data cleanup, external messaging, or calendar mutations into the current release train. They need their own reviewed inputs and rollback plan.

## Release train: complete in this order

### 1. Stabilize and publish the current batch

1. Use Node 20 in a clean checkout and run `npm ci`.
2. Run `npm run check`, `npm run test:server`, and `npm run build`.
3. Run secret/policy checks and focused role-based browser checks for:
   - a quote-ready job,
   - a dispatched job,
   - a completed job awaiting payout review,
   - payout approval and worker payout screens,
   - the compact mobile Job Brief with missing optional fields.
4. Review the combined commit as one release train; push `main` only after the validation checkout is green.
5. Let `Production Build and Deploy Verification` wait for Railway to report that exact commit on the public readiness endpoint.
6. Run the in-app Launch Checklist from an owner account after deployment. Do not mark a release live if payment, readiness, route, or payout probes fail.

### 2. Verify the lead-to-booking funnel

1. Establish the expected relationship between legacy leads and parent bookings. A lead-only request may be valid, so define the expected conversion event before changing code.
2. Add a daily dashboard or query showing: lead count, booking count, quote count, payment-link count, paid/dispatch count, and completed count.
3. Investigate the July 2 booking cutoff with a non-production test request and production logs. Check the public booking form, `/api/bookings/quote`, and booking-confirm endpoint separately.
4. Treat any request that creates a lead but cannot create/confirm the intended booking as a P1 conversion defect.

### 3. Operate the application 24/7

| Control | Implementation | Owner action still required |
| --- | --- | --- |
| Process recovery | Railway manages the web process; `/health` is its liveness probe. | Confirm Railway service is set to deploy from `main` and has its native health check enabled. |
| Readiness and deploy freshness | `scripts/check-production-deploy.mjs` verifies readiness, provider, DB state, and public commit. | Set GitHub variable `EXPECTED_HOSTING_PROVIDER=railway` (the workflow defaults to it) and keep the canonical health URL if it changes. |
| Continuous availability | `Production Availability` GitHub workflow runs every 10 minutes. | Ensure repository owners receive failed-workflow notifications or connect that failure to the chosen alert channel. |
| Release verification | `Production Build and Deploy Verification` validates Node 20 install, types, server tests, build, and exact public commit. | Keep Railway Git integration enabled; a delayed/missing deployment must fail this workflow. |
| Business-health monitoring | Daily lead/booking funnel review. | Choose the responsible owner and threshold for investigation. |
| Backup and recovery | No verified backup/restore evidence is in this repository. | Confirm the database provider's backup retention and perform one documented restore drill before claiming disaster-recovery readiness. |
| Secrets | Required payment and infrastructure values are checked without exposing their values. | Rotate secrets after any exposure concern and restrict Railway/GitHub administrative access. |

## Outstanding decisions that require an owner

1. **Alert destination and escalation:** choose who receives a failed 10-minute availability check and how they escalate after 15, 30, and 60 minutes. GitHub checks alone do not guarantee a human wake-up path.
2. **Database recovery objective:** set backup retention and the maximum acceptable data loss/recovery time, then document the restore drill.
3. **Release authority:** name the person who approves payment, payout, and production releases after the Launch Checklist is green.
4. **Funnel expectation:** decide whether every qualified lead should become a parent booking or whether lead-only intake is an intentional business path.

## Definition of production-ready

Production is ready only when all of the following are true:

- a clean Node 20 install, types, tests, and build pass;
- the pushed commit is verified on the public readiness endpoint;
- the role-based smoke tests above pass in production;
- the owner-run Launch Checklist is green for the payment and payout paths being enabled;
- a real alert recipient and escalation path is configured;
- database backup retention and a restore drill are documented; and
- the lead-to-booking conversion expectation is measured and has no unexplained production regression.
