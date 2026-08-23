# JCMOVES paid/completed reward reconciliation

## Problem

The completion pipeline already calls `disburseJobTokens(leadId)`. That service correctly refuses to issue rewards until the job is both `completed` and `payment_paid_at` is set.

When a job is completed **before** the final payment arrives, the completion attempt therefore defers. A later payment can make the job eligible without re-running the completion step.

## Fix

`reconcilePaidCompletedJcMoves()` searches only for leads where:

- `status = 'completed'`
- `payment_paid_at IS NOT NULL`
- `tokens_disbursed_at IS NULL`
- `completion_rewarded_at IS NULL`

It then calls the existing `disburseJobTokens()` service. It does not calculate or credit rewards independently.

The existing disbursement service remains the authority for reward amounts, gift-card-funded exclusions, JCMOVES ledger writes, advisory locking, wallet credits, and duplicate prevention.

## Rollout controls

Automatic reconciliation is disabled unless:

```text
JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED=true
```

Default interval:

```text
JCMOVES_PAYMENT_REWARD_RECONCILE_MINUTES=5
```

An authenticated owner/admin can perform a controlled sweep while automation is disabled:

```text
POST /api/admin/rewards-reconciliation/paid-completed
```

Optional JSON body:

```json
{ "limit": 1 }
```

## Production test

1. Deploy with `JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED=false`.
2. Select one owner-approved job that is completed, fully paid, and not already rewarded.
3. Verify its `payment_paid_at`, finalized job total, customer identity, crew, and gift-card tender amount if applicable.
4. Call the admin reconciliation endpoint with `limit: 1`.
5. Verify exactly one JCMOVES ledger/reward set was created and wallet balances match it.
6. Replay the reconciliation and verify no duplicate credit occurs.
7. Only after that test passes, set `JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED=true`.

This fix is provider-neutral. Square, PayPal, USDC, BTC, or another future payment adapter only needs to update the canonical paid state correctly; reward calculation remains centralized.