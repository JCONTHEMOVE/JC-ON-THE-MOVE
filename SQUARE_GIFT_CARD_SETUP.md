# Square eGift Card Launch Checklist

The website treats Square as the sole system of record for gift-card payment, delivery, balances, and redemption. The public marketing URL remains `https://jconthemove.com/gift-cards`; use that stable URL in ads and QR codes rather than linking directly to Square.

## 1. Configure Square

Use the production Square account and location already used for JC ON THE MOVE invoices.

1. Open **Square Dashboard → Items & services → Gift cards → eGift Cards → Configure** and enable online eGift-card sales.
2. Upload [`client/public/gift-cards/jc-helping-hand-egift.png`](client/public/gift-cards/jc-helping-hand-egift.png) as the standard 640×400 branded design and name it **Give the Gift of a Helping Hand**.
3. Upload [`client/public/gift-cards/jc-gold-helping-hand-5000.png`](client/public/gift-cards/jc-gold-helping-hand-5000.png) as the premium 640×400 design and name it **$5,000 Gold Helping Hand**.
4. Use Square's four eGift preset slots for **$50, $100, $250, and $500**.
5. Keep custom amounts enabled, set the maximum load amount to **$5,000**, and market **$1,000** and **$5,000 Gold** as custom-amount choices.
6. Enable personalized messages and scheduled email delivery.
7. Use no expiration date or inactivity fee.
8. Keep public gift-card directories disabled for launch so purchases originate from the JC service-area message on the website.
9. Copy the public HTTPS eGift order-page URL.

## 2. Configure Railway

Add the copied URL as the non-secret Railway variable:

```text
VITE_SQUARE_EGIFT_URL=https://app.squareup.com/gift/MLA23H7HK4MV2/order
```

This is the live JC ON THE MOVE order-page URL confirmed in the production Square Dashboard on August 17, 2026.

Redeploy after saving it. Vite embeds this value during the client build. Without a valid HTTPS value, `/gift-cards` intentionally shows the JC call/text fallback and never renders a broken purchase button.

No new Square credentials, database tables, or customer-data storage are required.

## 3. Published Terms

The website tells purchasers and recipients that:

- The card can be used toward any eligible JC ON THE MOVE service.
- Any unused balance remains on the Square eGift card.
- It has no expiration date or inactivity fee.
- It is not redeemable for cash except where legally required.
- Normal estimates, booking minimums, availability, scheduling, and service-area rules still apply.

The **$5,000 Gold Helping Hand** also includes priority estimate review, one JC coordination contact, a complimentary planning call and multi-service plan, and priority scheduling assistance subject to crew availability, weather, and the service area. These are service perks, not bonus cash value, and they do not guarantee a particular service date.

## 4. Owner-Controlled Live Test

Only the owner should perform this test using a payment method and recipient inbox they control.

1. Visit `https://jconthemove.com/gift-cards` while logged out and choose **Send a Gift Card**.
2. Purchase a **$25** card with a personal message and scheduled email delivery.
3. Confirm the receipt and recipient email both arrive with the expected JC branding.
4. Create a small Square invoice in the same production Square account/location.
5. Apply only part of the card balance to the invoice.
6. Confirm the payment appears in Square and the remaining balance is correct.
7. Recheck the page and checkout link on a phone before publicly announcing the program.

Outstanding cards from the retired JC custom flow remain visible to their owners and should be handled manually. Do not delete their historical balances.
