# Square eGift Card Launch Checklist

The website treats Square as the sole system of record for gift-card payment, delivery, balances, and redemption. The public marketing URL remains `https://jconthemove.com/gift-cards`; use that stable URL in ads and QR codes rather than linking directly to Square.

## 1. Configure Square

Use the production Square account and location already used for JC ON THE MOVE invoices.

1. Open **Square Dashboard → Items & services → Gift cards → eGift Cards → Configure** and enable online eGift-card sales.
2. Upload [`client/public/gift-cards/jc-helping-hand-egift.png`](client/public/gift-cards/jc-helping-hand-egift.png) as the standard 640×400 branded design and name it **Give the Gift of a Helping Hand**.
3. Upload [`client/public/gift-cards/jc-gold-helping-hand-5000.png`](client/public/gift-cards/jc-gold-helping-hand-5000.png) as the premium 640×400 design and name it **Gold Helping Hand**.
4. Use Square's four eGift preset slots for **$50, $100, $250, and $500**.
5. Keep custom amounts enabled. Square caps an individual US gift card at **$2,000**, so market **$1,000** as a custom-amount choice and coordinate the **$5,000 Gold Bundle** as multiple cards (for example $2,000 + $2,000 + $1,000) purchased together.
6. Enable personalized messages and scheduled email delivery.
7. Use no expiration date or inactivity fee.
8. Keep public gift-card directories disabled for launch so purchases originate from the JC service-area message on the website.
9. Disable Square eGift-card discounts. The separate JC purchase bonus is the only launch incentive.
10. Copy the public HTTPS eGift order-page URL.

## 2. Configure Railway

Add the copied URL as the non-secret Railway variable:

```text
VITE_SQUARE_EGIFT_URL=https://app.squareup.com/gift/MLA23H7HK4MV2/order
```

This is the live JC ON THE MOVE order-page URL confirmed in the production Square Dashboard on August 17, 2026.

Redeploy after saving it. Vite embeds this value during the client build. Without a valid HTTPS value, `/gift-cards` intentionally shows the JC call/text fallback and never renders a broken purchase button.

The purchase-bonus automation uses the existing Square access token plus the Orders, Payments, Customers, and Gift Cards read permissions. It stores minimal audit records in JC's database; it never stores the gift-card number or access code.

## 3. Configure the signed Square webhook

Use the exact production notification URL `https://www.jconthemove.com/api/webhooks/square` and subscribe it to:

- `gift_card.activity.created`
- `gift_card.activity.updated`
- `payment.created`
- `payment.updated`
- `refund.updated`
- `dispute.created`
- `dispute.updated`
- the existing invoice events already used by JC

Set `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, and `SQUARE_LOCATION_ID` in Railway. The app verifies every signature before processing an event and applies unique database constraints so duplicate or out-of-order events cannot double-credit a wallet.

Leave `GIFT_CARD_BONUS_ENABLED=false` while wiring the webhook. Immediately before launch, set a new ISO timestamp such as `2026-08-18T15:00:00-05:00` in `GIFT_CARD_BONUS_START_AT`, then set `GIFT_CARD_BONUS_ENABLED=true` and redeploy. Never move the timestamp backward to award old purchases.

## 4. Published Terms

The website tells purchasers and recipients that:

- The card can be used toward any eligible JC ON THE MOVE service.
- Any unused balance remains on the Square eGift card.
- It has no expiration date or inactivity fee.
- All gift-card sales are final and nonrefundable. No cash back or cash refunds are provided except where legally required.
- If JC approves an adjustment for service paid by gift card, return it to the original Square gift card or issue Square eGift/store credit where Square supports it.
- Normal estimates, booking minimums, availability, scheduling, and service-area rules still apply.

The **$5,000 Gold Helping Hand Bundle** also includes priority estimate review, one JC coordination contact, a complimentary planning call and multi-service plan, and priority scheduling assistance subject to crew availability, weather, and the service area. These are service perks, not bonus cash value, and they do not guarantee a particular service date.

### Purchase bonus

- Eligible initial eGift activations of $50 or more earn **25 JCMOVES per $1** after Square confirms both completed payment and activation. At the current 500 JCMOVES = $1 redemption rate, this is a true 5% service-credit reward.
- Advertised examples are $50 → 1,250, $100 → 2,500, $250 → 6,250, $500 → 12,500, $1,000 → 25,000, and a $5,000 multi-card Gold order → 125,000 JCMOVES (currently $250 of eligible service credit).
- Reloads and discounted gift-card purchases are excluded.
- The purchaser assigns the bonus to themself or the recipient. A recipient without an account has 30 days to accept; after that it returns to the purchaser. If the purchaser has no account, it remains held until signup.
- Bonuses remain pending for 14 days. Completed refunds reverse them proportionally. If already spent, the resulting reward debt is automatically offset by later JCMOVES earnings.
- Service paid with a gift card does not earn the normal customer per-dollar JCMOVES on that gift-funded portion. Flat service/completion rewards and crew rewards are unaffected.
- Reward redemption rules and rates may change prospectively. The face value and remaining balance of the Square gift card are separate and remain managed by Square.

## 5. Owner-Controlled Live Test

Only the owner should perform this test using a payment method and recipient inbox they control.

1. Visit `https://jconthemove.com/gift-cards` while logged out and choose **Send a Gift Card**.
2. Purchase a **$25** card with a personal message and scheduled email delivery.
3. Confirm the receipt and recipient email both arrive with the expected JC branding.
4. Create a small Square invoice in the same production Square account/location.
5. Apply only part of the card balance to the invoice.
6. Confirm the payment appears in Square and the remaining balance is correct.
7. Recheck the page and checkout link on a phone before publicly announcing the program.

The $25 card confirms Square delivery and partial redemption but is below the $50 bonus minimum. Before enabling public bonus marketing, also perform an owner-controlled $50 purchase after `GIFT_CARD_BONUS_START_AT`: confirm the assignment email, assign it to a test account, verify the 14-day pending state, use the owner-only sweep/reconciliation controls as needed, and confirm exactly 1,250 JCMOVES are released once eligible.

Outstanding cards from the retired JC custom flow remain visible to their owners and should be handled manually. Do not delete their historical balances.
