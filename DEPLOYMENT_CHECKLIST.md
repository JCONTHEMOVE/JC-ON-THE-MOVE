# JC ON THE MOVE - Deployment Checklist

This document provides a comprehensive checklist of all environment variables required for deploying the application to production.

## Critical Environment Variables (Required)

These variables **must** be configured for the application to function:

### Database & Sessions
- **`DATABASE_URL`** ✅ Auto-synced from workspace
  - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Status: Automatically provided by Replit database

- **`SESSION_SECRET`** ⚠️ Must configure manually
  - Secret key for encrypting session cookies
  - Recommendation: Generate a random 32+ character string
  - Example: `openssl rand -base64 32`

### Authentication
- **`REPLIT_DOMAINS`** ⚠️ Must configure manually
  - Comma-separated list of allowed authentication domains
  - **CRITICAL FOR PUBLISHED DEPLOYMENTS**
  - Example: `jconthemove.replit.app,jconthemove.com,www.jconthemove.com`
  - Include all custom domains if you have any

- **`REPL_ID`** ✅ Auto-provided by Replit
  - Automatically set by Replit platform
  - No action needed

### Blockchain Integration
- **`MOONSHOT_TOKEN_ADDRESS`** ⚠️ Must configure manually
  - JCMOVES token mint address on Solana
  - Current value: `BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon`
  - Used for: Token balance verification, price lookups

- **`VITE_SOLANA_RPC_URL`** ⚠️ Must configure manually
  - Solana RPC endpoint for blockchain queries
  - **IMPORTANT**: Frontend variables (VITE_*) must be set before deployment
  - Default fallback: `https://api.mainnet-beta.solana.com` (rate limited)
  - Recommended: Use a dedicated RPC provider (Helius, QuickNode, etc.)

### Runtime Environment
- **`NODE_ENV`** ⚠️ Must set to "production"
  - Controls error handling, logging, and optimizations
  - Value for production: `production`
  - Value for development: `development`

---

## Important Environment Variables (Recommended)

These variables enable core features but have fallbacks:

### Email Notifications
- **`SENDGRID_API_KEY`**
  - SendGrid API key for transactional emails
  - Format: Must start with `SG.`
  - Used for: Quote notifications, contact form alerts, lead updates
  - Fallback: Email notifications disabled if not configured

- **`COMPANY_EMAIL`**
  - Email address to receive notifications
  - Default fallback: `upmichiganstatemovers@gmail.com`
  - Used for: Receiving new lead alerts

### Security
- **`ENCRYPTION_KEY`**
  - Key for encrypting sensitive data in database
  - Recommendation: Generate a secure random key
  - Used for: Encrypting wallet private keys, sensitive user data
  - Fallback: Uses development key (not secure for production)

---

## Optional Environment Variables (Feature-Specific)

These variables enable additional features but aren't required:

### Push Notifications
- **`VAPID_PUBLIC_KEY`**
- **`VAPID_PRIVATE_KEY`**
  - Web Push notification keys
  - Generate with: `npx web-push generate-vapid-keys`
  - Used for: Browser push notifications to employees

### Crypto Payments
- **`FAUCETPAY_API_KEY`**
  - FaucetPay API integration
  - Used for: Bitcoin micropayments via FaucetPay

- **`REQUEST_TECH_API_KEY`**
  - Request.tech API for crypto cashouts
  - Used for: Processing cryptocurrency withdrawal requests

### Advertising Integration
- **`AADS_PUBLISHER_ID`**
  - A-Ads network publisher ID
  - Used for: Displaying A-Ads advertisements

- **`BITMEDIA_PUBLISHER_ID`**
- **`BITMEDIA_WEBHOOK_SECRET`**
  - Bitmedia network integration
  - Used for: Displaying and tracking Bitmedia ads

- **`COINTRAFFIC_PUBLISHER_ID`**
- **`COINTRAFFIC_WEBHOOK_SECRET`**
  - Cointraffic network integration
  - Used for: Displaying and tracking Cointraffic ads

---

## Auto-Provided Variables (No Action Needed)

These are automatically set by the Replit platform:

- `REPL_SLUG` - Your Repl name
- `REPL_OWNER` - Your Replit username
- `REPL_ID` - Unique Repl identifier
- `ISSUER_URL` - OIDC issuer URL
- `REPLIT_CLUSTER` - Replit cluster identifier
- `REPLIT_DEV_DOMAIN` - Development domain
- `PORT` - Server port (defaults to 5000)

---

## Deployment Steps

### Step 1: Configure Secrets in Replit

1. Go to your Repl's **Secrets** tool (Tools → Secrets)
2. Add all **Critical** environment variables listed above
3. Add **Important** variables for features you want to enable
4. Add **Optional** variables for any additional features

### Step 2: Verify Frontend Environment Variables

**IMPORTANT**: Variables starting with `VITE_` are bundled into the frontend at build time.

Ensure these are set **before** deploying:
- ✅ `VITE_SOLANA_RPC_URL`
- ✅ `VITE_VAPID_PUBLIC_KEY` (if using push notifications)

### Step 3: Configure Deployment Secrets

1. Navigate to the **Deployments** tab in Replit
2. Click on your deployment → **Environment Variables**
3. Verify all secrets synced correctly from workspace
4. **Manually add** any missing secrets (especially `VITE_*` variables)
5. Set `NODE_ENV=production`

### Step 4: Test Configuration

Before deploying, verify your configuration:

1. Visit `/api/health` endpoint to check system status
2. Review the response for any missing configurations
3. Example health check response:
   ```json
   {
     "status": "healthy",
     "environment": "production",
     "database": { "status": "configured" },
     "email": { "status": "configured" },
     "blockchain": { "tokenAddress": "configured" }
   }
   ```

### Step 5: Deploy

1. Click **Deploy** in the Deployments tab
2. Wait for build to complete
3. Test the published site thoroughly

---

## Common Issues & Solutions

### Issue: Blockchain balance shows "could not find mint" error

**Solution**: Ensure `VITE_SOLANA_RPC_URL` and `MOONSHOT_TOKEN_ADDRESS` are configured in deployment secrets and redeploy.

### Issue: Authentication fails on published site

**Solution**: Verify `REPLIT_DOMAINS` includes your published domain(s) and custom domains.

### Issue: Email notifications not working

**Solution**: Check `SENDGRID_API_KEY` is valid and starts with `SG.`

### Issue: Session timeout or login loops

**Solution**: Ensure `SESSION_SECRET` is set to a secure random string (not the default).

---

## Security Best Practices

1. **Never commit secrets to Git**: Use Replit's Secrets tool
2. **Rotate secrets regularly**: Update API keys and session secrets periodically
3. **Use strong encryption keys**: Generate random keys with `openssl rand -base64 32`
4. **Limit RPC access**: Use authenticated RPC endpoints for Solana
5. **Monitor logs**: Check deployment logs for security warnings

---

## Production Checklist

Before going live, verify:

- [ ] `NODE_ENV` is set to `production`
- [ ] `REPLIT_DOMAINS` includes all your domains
- [ ] `MOONSHOT_TOKEN_ADDRESS` is correct: `BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon`
- [ ] `VITE_SOLANA_RPC_URL` is configured with a reliable RPC provider
- [ ] `DATABASE_URL` is configured
- [ ] `SESSION_SECRET` is a secure random string
- [ ] `SENDGRID_API_KEY` is valid (if using email)
- [ ] `ENCRYPTION_KEY` is set for production
- [ ] All custom domains are added to `REPLIT_DOMAINS`
- [ ] Health check endpoint (`/api/health`) returns all green statuses
- [ ] Treasury blockchain verification shows correct balance
- [ ] Test login/logout flow on published site
- [ ] Test critical user flows (quotes, jobs, rewards)

---

## Getting Help

If you encounter deployment issues:

1. Check `/api/health` endpoint for configuration status
2. Review deployment logs in Replit console
3. Verify all critical environment variables are set
4. Contact Replit support for platform-specific issues

---

## Current Configuration Status

Last Updated: October 21, 2025

**Known Configuration:**
- Treasury Wallet: `34e5eAwb6Eh6zgyARSrk7RX1bkK2rVX5bazCHYXKtRM7`
- Token Mint: `BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon`
- Token Account (ATA): `57gWz4z4mbpqUymXTK4MToJxTvyDPnsxXapyuJx2p4tt`
- On-Chain Balance: 5,914,739.69 JCMOVES
- Database Balance: 3,370,230.39 JCMOVES
