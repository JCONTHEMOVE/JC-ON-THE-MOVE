# Production Secrets Checklist
## Quick Reference for Published App Configuration

Use this as a quick reference when configuring your published Replit app.

---

## How to Add Secrets in Replit

1. Open your Replit workspace
2. Click the **🔒 Lock icon** in left sidebar
3. Click **"Add Secret"** or edit existing ones
4. Copy and paste the values below

---

## Required Secrets (Copy & Paste Ready)

### 1. NODE_ENV
```
Key: NODE_ENV
Value: production
```

### 2. REPLIT_DOMAINS
```
Key: REPLIT_DOMAINS
Value: jconthemove.replit.app,jconthemove.com,www.jconthemove.com
```
⚠️ Update with your actual domains

### 3. VITE_SOLANA_RPC_URL
```
Key: VITE_SOLANA_RPC_URL
Value: https://api.mainnet-beta.solana.com
```
💡 For better performance, consider upgrading to:
- Alchemy: `https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY`
- QuickNode: `https://YOUR_ENDPOINT.quiknode.pro/YOUR_KEY/`

### 4. TREASURY_WALLET_PUBLIC_KEY
```
Key: TREASURY_WALLET_PUBLIC_KEY
Value: 34e5eAwb6Eh6zgyARSrk7RX1bkK2rVX5bazCHYXKtRM7
```

### 5. MOONSHOT_TOKEN_ADDRESS
```
Key: MOONSHOT_TOKEN_ADDRESS
Value: AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp
```

### 6. SENDGRID_API_KEY (Optional)
```
Key: SENDGRID_API_KEY
Value: SG.your_actual_key_here
```
⚠️ Replace with your actual SendGrid API key

### 7. COMPANY_EMAIL (Optional)
```
Key: COMPANY_EMAIL
Value: upmichiganstatemovers@gmail.com
```

---

## Auto-Configured Secrets (Already Set by Replit)

These are automatically configured - **DO NOT modify**:

- ✅ `DATABASE_URL` - PostgreSQL connection (auto-configured)
- ✅ `REPL_ID` - Your Replit project ID (auto-configured)
- ✅ `SESSION_SECRET` - Session encryption key (auto-configured)
- ✅ `TREASURY_WALLET_PRIVATE_KEY` - Wallet private key (existing secret)

---

## Deployment Command

After configuring secrets, run this in your **published deployment shell**:

```bash
npm run db:push
```

Or if you see data loss warnings (normal for new production DB):

```bash
npm run db:push --force
```

---

## Verification Steps

After deployment:

1. ✅ Visit your published URL
2. ✅ Log in (OAuth should work)
3. ✅ Navigate to Treasury Management
4. ✅ Check "Blockchain Balance Verification" card appears
5. ✅ Click "View on Solscan.io" - should open blockchain explorer
6. ✅ Start blockchain monitoring
7. ✅ Scan historical transactions to record existing 5.9M JCMOVES

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Can't log in | Check `REPLIT_DOMAINS` includes your published URL |
| Blockchain not working | Verify `VITE_SOLANA_RPC_URL` is set |
| Balance shows 0 | Run "Scan Historical Transactions" in Treasury → Blockchain |
| Email not sending | Add `SENDGRID_API_KEY` secret |
| Database error | Run `npm run db:push --force` in production shell |

---

## Summary

1. **Add 7 secrets** (5 required, 2 optional)
2. **Publish** your app
3. **Run** `npm run db:push` in production
4. **Test** blockchain features
5. **Done!** 🎉

Your published app will have all the latest blockchain monitoring features!
