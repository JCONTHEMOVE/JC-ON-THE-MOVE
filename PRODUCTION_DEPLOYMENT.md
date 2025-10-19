# Production Deployment Guide
## Migrate Development Features to Your Published App

This guide will help you deploy all your latest features (blockchain monitoring, Solscan integration, mining system, etc.) to your published Replit app.

---

## Overview

Your setup uses **two separate databases**:
- **Development Database**: Where you test features (current working environment)
- **Production Database**: What your published app uses (needs to be updated)

**Goal**: Sync your production database schema with all the latest development features.

---

## Step 1: Prepare for Migration

### A. Backup Current Production Data (IMPORTANT!)

Before making any changes, ensure you have a backup. Replit automatically creates checkpoints, but verify:

1. Go to your Replit workspace
2. Check that "Automatic Checkpoints" is enabled
3. Manually create a checkpoint if desired (for extra safety)

### B. Verify Development Schema is Ready

Your current development database has these features:
- ✅ Blockchain transaction monitoring
- ✅ Solana deposit tracking
- ✅ Unified mining system with streak bonuses
- ✅ Lead management with job creator tracking
- ✅ Treasury management system
- ✅ Moonshot integration for JCMOVES tokens

---

## Step 2: Configure Production Environment Variables

Your published app needs these secrets configured. Access them via:
1. Open your Replit workspace
2. Click the **🔒 Lock icon** in the left sidebar (Secrets)
3. Add or update the following:

### Required Secrets for Production:

```bash
# Core Settings
NODE_ENV=production
REPLIT_DOMAINS=jconthemove.replit.app,jconthemove.com,www.jconthemove.com

# Blockchain & Treasury (CRITICAL)
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
TREASURY_WALLET_PUBLIC_KEY=34e5eAwb6Eh6zgyARSrk7RX1bkK2rVX5bazCHYXKtRM7
MOONSHOT_TOKEN_ADDRESS=AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp

# Email (Optional but Recommended)
SENDGRID_API_KEY=SG.your_actual_sendgrid_key_here
COMPANY_EMAIL=upmichiganstatemovers@gmail.com
```

**⚠️ IMPORTANT**: Replace `SENDGRID_API_KEY` with your actual SendGrid key if you want email notifications.

**🔐 SECURITY NOTE**: `TREASURY_WALLET_PRIVATE_KEY` should already exist in your secrets from development. If not, contact support - DO NOT share this key.

---

## Step 3: Publish Your App with Updated Code

1. **Ensure Latest Code is Committed**
   - All your blockchain monitoring features are already in the code
   - The schema definitions are in `shared/schema.ts`

2. **Click "Publish" in Replit**
   - Your app will deploy with the latest code
   - This deploys the code but NOT the database schema yet

3. **Wait for Deployment to Complete**
   - You'll get a published URL (e.g., `https://your-app.replit.app`)

---

## Step 4: Run Database Migration on Production

This is the critical step that syncs your production database with all the new features.

### Option A: Using Replit's Database Tool (Recommended for Beginners)

1. **Access Production Database**
   - In your published deployment, find the Database connection
   - Replit automatically provides a production `DATABASE_URL`

2. **Run Migration Command**
   - Open the Shell in your **published** Replit environment
   - Run: `npm run db:push`
   - This will analyze your schema and update production database

3. **Confirm Migration**
   - Review the changes shown
   - Type `y` to confirm when prompted
   - If you see warnings about data loss, use: `npm run db:push --force`

### Option B: Manual Database Schema Sync (Advanced)

If you need more control:

```bash
# Connect to production database
# Run this in your published deployment shell:
npx drizzle-kit push:pg
```

---

## Step 5: Verify Production Deployment

After migration, verify everything works:

### A. Test Authentication
1. Visit your published app URL
2. Log in with your account (will show as "Djackson" now)
3. Verify you can access the dashboard

### B. Test Treasury Features
1. Navigate to **Treasury Management**
2. Check that the **Blockchain Balance Verification** card appears on the Overview tab
3. Verify it shows:
   - Live Blockchain Balance: ~5.9M JCMOVES
   - Database Balance: Should match (after first sync)
   - Solscan.io link works

### C. Test Blockchain Monitoring
1. Go to **Blockchain** tab in Treasury
2. Click "Start Monitoring"
3. Verify status shows "Monitoring Active"
4. Test "Scan Historical Transactions" button

### D. Test Mining System
1. Navigate to **Rewards** → **Mining Dashboard**
2. Verify passive mining shows 1,728 JCMOVES/day
3. Test claiming rewards
4. Check streak bonus system

---

## Step 6: Initialize Production Data

Your production database now has the schema but needs initial data:

### A. Create Admin User (if needed)
- Production will create your user automatically on first login via OAuth
- Username will be set based on your Replit profile

### B. Initialize Treasury (IMPORTANT)
1. Log into your published app as admin
2. Go to **Treasury Management**
3. Make your first deposit to initialize the treasury:
   - Amount: $1000 (or desired starting amount)
   - Method: Manual
   - Notes: "Initial production treasury funding"

### C. Start Blockchain Monitoring
1. In Treasury → Blockchain tab
2. Click **"Start Monitoring"**
3. This will begin tracking incoming JCMOVES deposits
4. Run **"Scan Historical Transactions"** to catch any existing deposits

---

## Troubleshooting

### Issue: "Database connection failed"
**Solution**: Verify `DATABASE_URL` exists in production environment
- Replit auto-configures this when you add a PostgreSQL database
- Check Secrets panel for `DATABASE_URL`

### Issue: "Authentication failed"
**Solution**: Check `REPLIT_DOMAINS` includes your published URL
```bash
REPLIT_DOMAINS=your-app.replit.app,custom-domain.com
```

### Issue: "Blockchain monitoring not working"
**Solution**: 
1. Verify `VITE_SOLANA_RPC_URL` is set in Secrets
2. Verify `TREASURY_WALLET_PUBLIC_KEY` matches your treasury address
3. Check browser console for RPC connection errors

### Issue: "Balance shows 0 JCMOVES"
**Solution**: This is normal for new production database
1. Go to Treasury → Blockchain tab
2. Click "Scan Historical Transactions" (limit: 50)
3. System will detect and record your existing 5.9M JCMOVES balance
4. Wait 30 seconds for balance to update

### Issue: "Migration shows data loss warning"
**Solution**: This is expected for a new production database
- Use `npm run db:push --force` to proceed
- Your development data is safe (separate database)
- Production will start fresh with correct schema

---

## Database Migration Safety

### What Gets Migrated:
✅ All table structures (users, leads, treasury, mining, etc.)
✅ All columns and data types
✅ All indexes and constraints
✅ All relationships between tables

### What Does NOT Get Migrated:
❌ Actual data from development (users, deposits, rewards)
❌ Your personal test data from dev environment
❌ Development database itself (remains untouched)

**This is SAFE**: Your production database will have the correct structure but will start with empty tables. Data will populate as users interact with your published app.

---

## Post-Migration Checklist

After successful migration, verify:

- [ ] ✅ Can log into published app
- [ ] ✅ Treasury dashboard loads correctly
- [ ] ✅ Blockchain balance verification card appears
- [ ] ✅ "View on Solscan.io" button works
- [ ] ✅ Can start blockchain monitoring
- [ ] ✅ Mining system shows daily JCMOVES generation
- [ ] ✅ Can create and edit leads
- [ ] ✅ Rewards system works
- [ ] ✅ Live price shows JCMOVES token value

---

## Support

If you encounter issues during deployment:

1. **Check Deployment Logs**
   - View logs in Replit deployment dashboard
   - Look for specific error messages

2. **Verify All Secrets Are Set**
   - Compare your Secrets panel with the list above
   - Ensure no typos in variable names

3. **Test in Development First**
   - If something doesn't work in production, test in dev
   - This helps isolate whether it's a code or config issue

4. **Rollback if Needed**
   - Replit allows you to roll back to previous deployments
   - Use checkpoints if you need to restore database

---

## Summary

**What you're doing:**
- ✅ Keeping development and production databases separate (best practice)
- ✅ Deploying your latest code to production
- ✅ Syncing production database schema to match development
- ✅ Initializing production with correct configuration

**What you're NOT doing:**
- ❌ Copying development data to production
- ❌ Risking development environment
- ❌ Manually writing SQL migrations

**Expected Result:**
Your published app will have all the latest features (blockchain monitoring, Solscan integration, mining system, etc.) working exactly like they do in development, but using its own separate production database.

---

## Ready to Deploy?

Follow the steps above in order:
1. ✅ Configure Secrets
2. ✅ Publish your app
3. ✅ Run `npm run db:push` in production
4. ✅ Test all features
5. ✅ Initialize treasury and start monitoring

Your published app will be fully operational with all the latest blockchain features! 🚀
