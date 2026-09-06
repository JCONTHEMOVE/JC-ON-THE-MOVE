# Production alerting and database recovery evidence

Evidence date: 2026-09-06 (UTC). Scope: the two operational readiness gates in
`PRODUCTION_EXECUTION_PLAN.md`. This document is a preparation record, not a
completed drill certificate. Both gates remain **OPEN**.

## Owner decisions

- Darrell Jackson receives availability alerts first. He explicitly confirmed
  the primary email address in the September 6 session; keep that exact address
  in private incident configuration, not this public repository. Confirmation
  of the address is complete; configuration and actual receipt are not proven.
- Darrell also requested Discord alerts. The exact server/channel and its
  operational webhook have not been verified. His technical contact remains
  the next human escalation recipient; that person's identity and delivery
  destination have not been established.
- Existing in-app notices are available in the signed-in website and do not
  require downloading a native app. Treat them as supplemental visibility:
  availability alert delivery must work when the website or database is down.
- Measure existing database protection before recommending or changing
  retention, maximum acceptable data loss (RPO), or recovery time (RTO).
- Customer-facing behavior is preserved. No booking, quote, invoice, payment,
  crew broadcast, payout, or reward is part of these drills.

## Evidence already obtained

| Control | Observed evidence | What it proves |
| --- | --- | --- |
| Live readiness | At `2026-09-06T14:33:30.636Z`, the public `/api/health` endpoint returned HTTP 200, application `ready`, database `ready`, and commit `25b985e4a8369bed94144421a8e2908fa15abd97`. | A healthy point-in-time observation, not backup or notification proof. |
| Current source | `main` is `25b985e4a8369bed94144421a8e2908fa15abd97`. | The source and live commit matched when inspected. |
| Configured cadence before this change | `7,27,47 * * * *` in the availability workflow. | The configured interval was 20 minutes, despite the plan saying 10. |
| Proposed cadence | `7,17,27,37,47,57 * * * *`. | A requested 10-minute cadence only after this branch is merged; GitHub scheduling is best effort. |
| Observed execution | The latest 20 scheduled availability runs returned by the repository runs API span September 4, 01:03:21 UTC through September 6, 13:08:47 UTC. All 20 succeeded, but adjacent starts are 106.25 to 297.47 minutes apart. See `availability-runs-2026-09-06.json`. | Successful probes with large observed monitoring gaps; these gaps are not evidence of a site outage. |
| Latest checked workflow | [Run 34035201876](https://github.com/JCONTHEMOVE/JCONTHEMOVE.COM/actions/runs/34035201876), readiness job `101491880224`, succeeded. | Checkout, Node setup, and the verifier succeeded. There is no explicit notification-delivery step. |
| Owner account | Authenticated GitHub login and scheduled-run actor are `JCONTHEMOVE`. | An account identity, not its email configuration or receipt of an alert. |
| Primary recipient decision | Darrell explicitly confirmed his primary email in the September 6 session. | An approved real destination; delivery configuration and receipt still need evidence. |
| Discord and in-app implementation | `server/services/jobEventBus.ts` supports job-event Discord webhooks. The admin layout includes `notification-bell.tsx` and `notification-list.tsx`, which read the website's notification API. | Existing job/crew capabilities, not proof that availability failures reach Discord or the website. The exact operational Discord destination remains unverified. |
| Database implementation | `server/db.ts` uses the Neon serverless PostgreSQL driver with `DATABASE_URL`. | A provider clue; the active production project/branch and its retention settings are not yet verified. |
| Recovery evidence | No verified retention setting, recovery-point inventory, or completed restore drill was found in the current production plan or repository search. No authenticated database access was available in this review. | Recovery readiness remains unverified. This does not establish that backups are absent. |

Neon was connected during this review, and its installed state was confirmed.
However, project/branch/SQL actions were not exposed in this session and there
was no authenticated CLI, so no database account data or retention settings
could be inspected. Continue from the connected account when those actions are
available; no new account or database is required.

The repository is public. Keep full recipient addresses, customer data,
database connection strings, backups, and private provider screenshots in a
restricted operations record. Commit only sanitized outcomes and references.

## Alerting gate

### Configuration to complete

1. Use Darrell's directly confirmed primary email in the private incident
   configuration. Resolve the named technical contact and the exact Discord
   server/channel link before enabling escalation or sending a drill. Do not
   infer either destination from marketing contacts, crew membership, a shared
   invite, or a webhook environment-variable name.
2. In the owner's GitHub notification settings, verify Actions email delivery,
   failure notifications, and the intended destination. GitHub's scheduled-run
   notification recipient follows the user who created/last changed the cron,
   or re-enabled the workflow. Verify the actor after the cron correction;
   being a repository owner alone does not establish delivery.
3. Configure and verify the escalation policy below in the selected incident
   delivery system. GitHub failure email alone has no acknowledgement or timed
   escalation mechanism. Until such a system is connected, the timeline is a
   required policy, not implemented automation.
4. Investigate the observed execution gaps and verify ongoing coverage.
   GitHub documents that scheduled runs can be delayed or dropped. An
   independent monitor must detect both a bad readiness response and absence
   of expected checks; use a separate scheduler/delivery path for a true
   10-minute operational control. A second workflow on the same scheduler does
   not remove the observed failure mode. Prefer an existing incident service
   if one is already available; account, destination, and any cost remain to be
   resolved before provisioning one.
5. Use the same real failure route for the synthetic drill and normal failures.
   Do not add a test-only email that bypasses the actual failure route. Check
   for cancelled, timed-out, and missing monitor runs as well as explicit
   verifier failures. Preserve all current verifier checks.

### Delivery decisions recorded on September 6

| Destination | Confirmed decision | Remaining proof |
| --- | --- | --- |
| Primary email | Darrell's explicitly confirmed email is the first destination; use the exact private address from the session. | Configure it in the actual incident service and record real receipt and acknowledgement. GitHub account identity alone is insufficient. |
| Discord | The owner requested Discord alerts. No exact server/channel has been verified. | Resolve the channel link and intended audience, configure its operational webhook privately, then record receipt. A shared crew invite or existing job-event webhook is insufficient. |
| Technical escalation | The owner's technical contact is next after Darrell. | Obtain the person's name and approved email, phone, or Discord handle; verify the destination and 15/30/60-minute route. A channel name alone does not identify the responsible person. |
| In-app notices | The website already provides an authenticated notification drawer; a native app download is unnecessary for reading those notices. | No operational outage route has been demonstrated. The September 3 plan separately recorded missing VAPID keys, so phone/browser push is not proven. |

Keep the availability monitor and its delivery system independent of the
production application/database. The existing `DISCORD_JOB_WEBHOOK_URL` and
`DISCORD_WEBHOOK_URL` code paths serve job events; do not redirect or reuse them
for operational alerts without verifying their destination and audience.
Store any new operational webhook in the selected monitor's secret settings;
do not paste webhook credentials into a public issue, workflow, or drill log.
No email, Discord message, in-app notice, or push was sent during this review.

### Required escalation policy (not yet configured)

The clock starts at the monitoring system's first detected failure, **T0**.
Record receipt and acknowledgement separately; delivery is not acknowledgement.

| Elapsed time | Required action | Recipient |
| --- | --- | --- |
| T0 | Open one incident and send the readiness failure or missing-check alert. | Darrell Jackson |
| 15 minutes | If unresolved or unacknowledged, notify the technical contact; retain Darrell on the incident. An acknowledgement must not suppress escalation of an unresolved failure. | Verified technical contact |
| 30 minutes | If unresolved, repeat the escalation and have the technical contact engage the affected hosting/database provider's support path. | Darrell and technical contact |
| 60 minutes | Owner reviews diagnosis, incident impact, and recovery/containment options. Record the decision and next update time. | Darrell, with the technical contact |
| Recovery | Require a fresh successful readiness check, send a recovery notice, stop pending escalation, and retain the incident timeline. | The incident recipients |

Group repeated failed probes into the same open incident. Preserve its original
T0; do not reset escalation timers on every retry. New incidents may open after
a verified recovery. Changing customer behavior, rolling back, or restoring
production requires a separate concrete owner decision.

### Safe alert drill

Status: **NOT RUN**. The workflow adds an `alert_drill` manual input, defaulting
to false. In drill mode it intentionally fails before checkout, Node setup, or
the verifier; no production URL is contacted. The final summary is evidence
of the signal, not evidence that a person received it.

After destinations are resolved and the route is configured:

1. Record the owner, technical contact, private destination reference, expected
   escalation timing, and drill identifier in the restricted incident record.
2. Dispatch `Production Availability` using `alert_drill=true` from the owner
   account. The run title must say `intentional failure`. The existing manual
   workflow can target the reviewed branch; scheduled runs use the default
   branch. Explicitly record which ref was tested.
3. Confirm the synthetic step failed and all production steps were skipped.
4. Record actual first-recipient receipt and acknowledgement timestamps, then
   test the unacknowledged and unresolved escalation routes to the named
   technical contact. Verify the 15/30/60-minute timings. A compressed routing
   rehearsal alone does not prove the configured timing.
5. Verify acknowledgement, recovery, duplicate suppression, and cancellation
   of pending escalations. A drill with no real endpoint failure needs a
   clearly identified test-incident resolution, not a fabricated recovery.
6. Record a normal successful readiness run and scheduled-run recipient proof
   after the cron update. A manual-run receipt alone does not prove scheduled
   GitHub notification routing. Verify the independent missed-check alert too.

Optional CLI dispatch, after the above prerequisites are met:

```bash
gh workflow run production-availability.yml --repo JCONTHEMOVE/JCONTHEMOVE.COM --ref main -f alert_drill=true
```

### Alert evidence fields

The primary owner email has been confirmed directly. Keep these **pending**
until observed: configured monitor and incident service; configured owner
destination; named technical contact; verified Discord destination; private
destination references; run URL and tested
ref; scheduled actor; failure T0; owner delivery/acknowledgement timestamps;
15/30/60-minute escalation delivery/acknowledgement timestamps; recovery and
deduplication results; missed-check test; post-change schedule observations;
reviewer and date. A provider's accepted-send response is not human receipt.

## Database recovery gate

### Measure existing protection first

Do not change retention or plan tier as part of discovery. Using authenticated
production host and database metadata, fill in the following restricted record:

| Evidence | Current result |
| --- | --- |
| Hosting service and active production database endpoint match | Pending; match the host's active `DATABASE_URL` to the provider project/branch without exposing its password. |
| Database provider, organization, project, branch, database, region, PostgreSQL version, plan | Not verified |
| Configured PITR/history retention | Not verified; record actual configuration and capture time. |
| Earliest and latest currently restorable time or LSN | Not verified; configured retention alone does not prove available history. |
| Scheduled snapshots/exports: successful timestamps and failures | Not verified |
| Retention of snapshots/exports, destination, access and encryption controls | Not verified |
| Protection against loss of the primary provider/account | Not verified; same-provider PITR is not independent off-provider recovery. |
| Maximum observed backup gap and age of newest usable recovery point | Not measured |
| Existing RPO/RTO commitment | None verified; owner requested measurement before recommendation. |

Measure snapshot/export cadence separately from PITR history. An available
provider feature, a healthy connection, a filesystem snapshot, or a freshly
created dump is not proof that the existing retention policy works.

### Isolated restore procedure

Status: **NOT RUN**. Use an actual retained recovery point from the active
production database, not a schema-only branch, toy fixture, or a fresh export
presented as historical backup proof.

1. Confirm the provider/project/branch mapping and access above. Capture the
   actual earliest/latest recoverable timestamps and choose an explicit UTC
   point **T** inside the available history. For a snapshot/export, record its
   immutable identifier, completion time, and checksum when available.
2. Capture source expectations corresponding to **exactly T**: use the
   provider's read-only historical view, an independently recorded consistent
   backup manifest, or a consistent source snapshot tied to the backup's
   LSN. Record counts, relevant totals, schema/index inventory, and known
   pre-T business records. Do not require current production counts to equal
   an older restore. If no independent baseline exists, record that limitation
   and use verifiable pre-T audit records; do not claim a full equality check.
3. Start the recovery timer before the restore request. Create a uniquely
   named, private, disposable target such as `restore-drill-20260906-<suffix>`.
   Verify its project/branch/endpoint is distinct from active production before
   restoring. Do not change production's default branch, compute endpoint,
   connection string, or DNS.
4. If Neon is confirmed, create a new child branch from **Past data** at T,
   with a separate compute, and await successful provider operations. Do not
   invoke restore/reset on the production branch. If the actual provider is
   different, use its documented restore-to-new-database operation. If using
   `pg_restore`, target a fresh empty database and stop on the first error;
   never use a production target or `--clean` on an existing database.
5. Use SQL only against the restored target. **Do not start this application's
   server, run migrations, mount production credentials in an app process, or
   connect webhooks, schedulers, email/SMS, Square, push, or wallet signing to
   the restored copy.** Startup code includes data migrations and integrations
   that would invalidate an untouched restore and could emit side effects.
6. Run `scripts/verify-restored-database.sql` with a read-only transaction and
   stop-on-error enabled. It emits aggregate counts, schema/index definitions,
   financial/reward totals, and orphan/duplicate counts; it does not emit
   customer records. Run it on the same-T reference when available and compare
   results. Missing tables/columns are a validation failure to investigate,
   not permission to migrate the restore. Retain outputs privately.
7. Confirm known pre-T bookings, quotes, payment records, worker payouts,
   rewards and idempotency records exist with the expected relationships. Use
   sanitized references, not public customer details. Check post-T exclusions
   when independently known. Review any pre-existing duplicate/orphan counts
   against the baseline rather than silently repairing them.
8. Stop the timer only after the restored data is accessible and the checks
   pass. Record request time, provider-ready time, first successful query, and
   validated time. This measures isolated data-recovery time, not full
   customer-service RTO; no application cutover is being tested.
9. Record `observation time - latest usable recovery point` as measured
   recovery-point lag. The age of the deliberately selected T is the drill's
   lookback, not the system's best achievable RPO. Do not infer a contractual
   guarantee from one measurement.
10. Recheck live readiness and unchanged deployment/database mapping. Record
    the drill target's expiration/cleanup plan; remove only the positively
    identified disposable target under the applicable deletion approval.
    Preserve private evidence and a sanitized result in this record.

Example validation invocation from an authenticated operator environment:

```bash
# RESTORE_DRILL_DATABASE_URL must identify the isolated target, never production.
PGDATABASE="$RESTORE_DRILL_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -f scripts/verify-restored-database.sql
```

Do not put connection URLs, backups, SQL outputs containing business totals,
or unredacted screenshots in public GitHub Actions artifacts or this repository.

### Restore evidence fields

Drill ID; operator; private provider/project/branch mapping; measured retention;
earliest/latest recoverable point; chosen T/LSN or backup ID/checksum;
source-baseline provenance; isolated target and proof it is not production;
operation result; start/provider-ready/query/validated timestamps; recovered
schema/index and business-data validation results; orphan/duplicate comparison;
measured lag and data-recovery duration; limitations; unchanged-production
proof; cleanup status; reviewer and date. Leave unknown fields pending.

### Recommend targets after measurement

After a successful drill, report actual retained history, recoverable-point
lag, successful backup intervals, isolated data-recovery time, and untested
failure modes. Recommend retention, RPO and RTO separately, explaining any gap
between observed capability and business need. Include time for incident
detection, response, validation, and controlled application recovery in any
full-service RTO recommendation. Present changes and costs for an owner
decision; do not turn measured values into promises or silently change settings.

## Gate decision

Local validation passed for workflow YAML, six evenly spaced requested
10-minute slots, default-off drill input, exclusion of production steps from
the drill, the intentional nonzero exit, shell syntax, both evidence-summary
modes, and the public run-evidence JSON. The SQL was reviewed against the
repository schema and statically checked for read-only statements. No live
PostgreSQL execution, notification receipt, timed escalation, or restore test
is claimed by these checks.

| Gate | Status | Required to close |
| --- | --- | --- |
| Recipient and escalation | OPEN | Owner email is confirmed. Still need configured delivery, exact Discord destination, a named technical contact, verified receipt/acknowledgement/escalation/recovery, and adequate measured monitoring coverage including missed checks. |
| Backup retention and restore | OPEN | Authenticated production retention/recovery-point evidence and one successfully validated, documented isolated restore. |

This operational work does not approve other payment, payout, notification,
marketing, or reward release gates.

## References

- [Current production plan](../../PRODUCTION_EXECUTION_PLAN.md)
- [Availability workflow](../../.github/workflows/production-availability.yml)
- [GitHub workflow notification routing](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
- [GitHub scheduled-event behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Neon backup strategies](https://neon.com/docs/manage/backups)
- [Neon branch creation and isolation](https://neon.com/docs/manage/branches)
