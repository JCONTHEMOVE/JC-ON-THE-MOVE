# JC's Pi Jackpot
## Security & Rules

Version: 0.1 Beta  
Status: Internal Development  
Repository: JCONTHEMOVE/JCONTHEMOVE.COM

---

## Purpose

JC's Pi Jackpot is designed as a transparent, secure, and community-focused rewards experience for the Pi Network ecosystem.

Security, fairness, transparency, and regulatory compliance take priority over fast feature release.

---

## Payment Verification

### No Ticket Without Confirmed Pi Payment

A jackpot ticket is not valid unless all of the following are true:

- Pi SDK payment is completed.
- Payment callback is verified server-side.
- Transaction ID is recorded.
- Database confirms payment status.
- Ticket is assigned to the correct jackpot round.

If any verification fails:

- No valid ticket is issued.
- The payment attempt is flagged for review.
- An admin notification should be generated.
- The user receives a clear failed-verification message.

The application must never issue valid tickets before payment verification is complete.

---

## Ticket Audit Trail

Every ticket must permanently store:

- Ticket ID
- User ID
- Pi username
- Jackpot round ID
- Purchase timestamp
- Pi transaction ID
- Payment amount
- Verification status
- Ticket status
- Server hash
- Random draw seed reference, when applicable

Tickets should not be physically deleted from the database. Invalid or voided tickets should remain stored with a non-winning status such as `INVALID`, `VOID`, or `FAILED_PAYMENT`.

---

## Jackpot Drawing Rules

Every jackpot drawing must record:

- Drawing timestamp
- Round ID
- Total tickets entered
- Total Pi collected
- Random seed or drawing reference
- Winning ticket ID
- Winner user ID
- Prize amount
- Admin approval status
- Payout status

Drawings should be reproducible or auditable wherever technically possible.

---

## Administrator Payout Approval

No automatic payouts should occur during Beta.

Every jackpot payout requires:

- Admin review
- Payment verification
- Fraud review
- Winner confirmation
- Manual payout approval

Only after approval may Pi be distributed to the winner.

Automatic payouts may be considered only after payment verification, fraud controls, logging, and legal review are production-ready.

---

## Fraud Detection

The system should flag:

- Duplicate payment IDs
- Rapid ticket purchases
- Payment amount mismatches
- Failed payment callbacks
- Suspicious account patterns
- Repeated failed verification attempts
- Multiple accounts using suspiciously similar behavior

Flagged users, tickets, payments, or rounds require manual review before payout.

---

## Age Requirement

Users must meet the minimum legal age required in their jurisdiction.

If a jurisdiction prohibits participation, access must be denied.

No exceptions should be made for underage users.

---

## Regional Compliance Warning

Laws differ by country, state, province, and local jurisdiction.

Before public launch:

- Review local gaming, sweepstakes, lottery, and promotional rules.
- Review Pi Network developer policies.
- Verify payment and prize-distribution requirements.
- Disable participation in restricted regions if necessary.
- Obtain legal guidance where appropriate.

This project should not be publicly marketed as gambling, a casino, or a lottery unless legal approval confirms that classification is permitted.

Safer early-stage wording includes:

- Community rewards
- Promotional prize pool
- Pi rewards game
- Rewards experience

---

## Responsible Participation

JC's Pi Jackpot is intended for entertainment, community engagement, and rewards utility.

Users should:

- Never spend more Pi than they are comfortable losing.
- Understand that prizes are not guaranteed.
- Participate responsibly.
- Stop using the app if participation feels stressful, compulsive, or harmful.

The app should include clear responsible-play language before live launch.

---

## Data Security

Authentication should use Pi Sign-In where applicable.

The app should not store unnecessary sensitive personal information.

Sensitive data must be:

- Access controlled
- Backed up
- Protected from unauthorized admin access
- Logged when changed by an admin

Passwords should not be stored directly. If the app later adds non-Pi login, passwords must be salted, hashed, and handled with industry-standard authentication practices.

---

## Admin Action Logging

Every admin action must be logged, including:

- Round creation
- Round closing
- Drawing execution
- Winner confirmation
- Payout approval
- Payout rejection
- User suspension
- Ticket invalidation
- Payment status change
- Settings changes

Logs should include:

- Admin user
- Timestamp
- Action type
- Previous value, when applicable
- New value, when applicable
- Reason or note

---

## Manual Review Before Public Launch

Before any production or public launch, complete this checklist:

- [ ] Pi Login tested
- [ ] Pi payment request tested
- [ ] Server-side payment verification tested
- [ ] Ticket creation tested
- [ ] Duplicate payment prevention tested
- [ ] Jackpot round creation tested
- [ ] Jackpot round close tested
- [ ] Drawing process tested
- [ ] Winner history tested
- [ ] Admin approval tested
- [ ] Payout process tested
- [ ] Audit logs tested
- [ ] Fraud flagging tested
- [ ] Database backup tested
- [ ] Regional compliance reviewed
- [ ] Responsible participation language added
- [ ] Terms and rules page published
- [ ] Manual legal review completed

---

## SoloHost Integration Roadmap

Future SoloHost or local-compute features may include:

- Local AI fraud detection
- Local audit tools
- Private analytics
- Draw verification utilities
- JC ON THE MOVE quote assistant
- Local business automation tools

No user-private data should be transmitted to external AI services unless the user clearly understands and approves that behavior.

---

## Beta Disclaimer

JC's Pi Jackpot is under active development.

Features, balances, ticket rules, prize rules, and payout rules may change before public launch.

No payout should be considered final until confirmed by an authorized administrator.

---

## Build Direction

Initial production-safe direction:

1. Pi Sign-In
2. Verified Pi payment flow
3. Ticket creation after verified payment only
4. Manual admin payout approval
5. Public winner history
6. Audit logs
7. Rewards and referrals
8. JC ON THE MOVE service redemption
9. SoloHost/local AI modules after core app stability

Security first.  
Transparency always.  
Community driven.
