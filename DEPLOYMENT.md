# Deployment Configuration Guide

## Required Environment Variables for Production

To successfully deploy this application, you need to configure the following environment variables through Replit's Secrets pane (🔒 lock icon in the left sidebar):

### 1. Core Environment Variables

#### `NODE_ENV` (Required for Production)
- **Value**: `production`
- **Purpose**: Enables production mode with optimized builds and error handling
- **Example**: `NODE_ENV=production`

#### `REPLIT_DOMAINS` (Required for Authentication)
- **Value**: Comma-separated list of domains where your app will be accessed
- **Purpose**: Required for Replit authentication to work correctly
- **Example**: `REPLIT_DOMAINS=jconthemove.replit.app,jconthemove.com,www.jconthemove.com`
- **Note**: Include your `.replit.app` domain AND any custom domains

### 2. Database Configuration

#### `DATABASE_URL` (Auto-configured by Replit)
- Automatically set when you create a PostgreSQL database
- Format: `postgresql://username:password@host:port/database`

### 3. Authentication Configuration

#### `REPL_ID` (Auto-configured by Replit)
- Automatically provided by Replit platform
- Used for OAuth authentication

#### `SESSION_SECRET` (Auto-configured by Replit)
- Automatically generated for session encryption
- Should be a long random string

### 4. Treasury & Blockchain Configuration

#### `TREASURY_WALLET_PRIVATE_KEY`
- **Status**: ✅ Already configured in .env
- **Purpose**: Solana wallet for treasury operations

#### `TREASURY_WALLET_PUBLIC_KEY`
- **Status**: ✅ Already configured in .env
- **Purpose**: Public address for treasury wallet

#### `MOONSHOT_TOKEN_ADDRESS`
- **Current Value**: `AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp`
- **Status**: ⚠️ In .env file but needs to be set in Secrets pane
- **Purpose**: JCMOVES token address on Solana/Moonshot

### 5. Email Configuration (Optional)

#### `SENDGRID_API_KEY`
- **Format**: Must start with `SG.`
- **Purpose**: Email notifications for leads and contacts
- **Note**: Email features will be disabled without valid API key

#### `COMPANY_EMAIL`
- **Purpose**: Recipient email for notifications
- **Example**: `admin@jconthemove.com`

### 6. Payment & Faucet Integration (Optional)

#### `FAUCETPAY_API_KEY`
- **Purpose**: FaucetPay integration for crypto payments
- **Status**: Listed as missing in project

#### `FAUCETPAY_USER_TOKEN`
- **Purpose**: FaucetPay user authentication
- **Status**: Listed as missing in project

#### `STRIPE_SECRET_KEY` & `VITE_STRIPE_PUBLIC_KEY`
- **Purpose**: Stripe payment integration
- **Status**: Listed as missing in project

## How to Configure Secrets in Replit

1. **Open Secrets Pane**
   - Click the lock icon (🔒) in the left sidebar
   - Or navigate to "Secrets" or "Environment Variables"

2. **Add or Update a Secret**
   - Find the secret by name (e.g., `NODE_ENV`)
   - If it exists, click "Edit" and update the value
   - If it doesn't exist, click "Add Secret" and enter:
     - Key: `NODE_ENV`
     - Value: `production`
   - Click "Update Secret" or "Add Secret"

3. **Essential Secrets for Deployment**
   ```
   NODE_ENV=production
   REPLIT_DOMAINS=jconthemove.replit.app,jconthemove.com,www.jconthemove.com
   MOONSHOT_TOKEN_ADDRESS=AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp
   ```

4. **Restart Application**
   - After adding/updating secrets, the application will automatically restart
   - Check the logs to verify successful startup

## Deployment Checklist

- [ ] Set `NODE_ENV=production` in Secrets
- [ ] Set `REPLIT_DOMAINS` with all deployment domains in Secrets
- [ ] Verify `DATABASE_URL` is configured (auto-configured by Replit)
- [ ] Move `MOONSHOT_TOKEN_ADDRESS` from .env to Secrets pane
- [ ] Configure `SENDGRID_API_KEY` if email notifications are needed
- [ ] Configure FaucetPay keys if crypto faucet features are needed
- [ ] Configure Stripe keys if payment processing is needed
- [ ] Test authentication flow after deployment
- [ ] Verify treasury system is accessible

## Current Status

✅ **Application starts successfully** with graceful error handling
✅ **Authentication works** in development mode
✅ **Database connected** and operational
✅ **Treasury wallet configured** with JCMOVES tokens
⚠️ **MOONSHOT_TOKEN_ADDRESS** needs to be set in Secrets pane (currently in .env only)
⚠️ **Production deployment** requires NODE_ENV and REPLIT_DOMAINS in Secrets

## Troubleshooting

### "Authentication setup failed"
- Ensure `REPLIT_DOMAINS` is set in Secrets pane
- Include ALL domains where users will access the app
- Format: `domain1.com,domain2.com` (comma-separated, no spaces)

### "Application failed to initialize"
- Check that `NODE_ENV` is set to `production` for deployments
- Verify all required secrets are configured
- Review deployment logs for specific error messages

### "Token not found" (Moonshot API)
- Your JCMOVES tokens exist and are working (verified in wallet)
- Token may still be in bonding curve phase on Moonshot
- System uses fallback price: $0.00000508432
- Will auto-update when token is indexed in Moonshot's public API

## Notes

- The application now has **graceful startup error handling**
- Server will start even if some services fail to initialize
- Authentication errors won't block server startup
- Missing optional services (email, faucet) won't prevent deployment
- All critical errors are logged for debugging
