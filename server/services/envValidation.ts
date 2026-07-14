// Production env-var gates. Development stays permissive so local UI and
// non-payment work can continue without every external credential present.

interface EnvCheck {
  name: string;
  required: boolean;
  purpose: string;
}

const STARTUP_ENV: EnvCheck[] = [
  { name: "DATABASE_URL", required: true, purpose: "PostgreSQL database connection" },
];

const SECURITY_ENV: EnvCheck[] = [
  { name: "SESSION_SECRET", required: true, purpose: "session cookies and JWT signing fallback" },
];

const PAYMENT_ENV: EnvCheck[] = [
  { name: "SQUARE_ACCESS_TOKEN", required: true, purpose: "Square card invoicing + customer search" },
  { name: "SQUARE_ENVIRONMENT", required: true, purpose: "Square sandbox vs production switch" },
  { name: "BTC_WALLET_ADDRESS", required: false, purpose: "Bitcoin payment auto-verify sweep + customer pay-with-BTC display" },
  { name: "CRYPTO_PAYMENTS_ENABLED", required: false, purpose: "Enable third-party multi-crypto checkout rail" },
  { name: "CRYPTO_PAYMENTS_PROVIDER", required: false, purpose: "Third-party crypto checkout provider, currently bitpay" },
  { name: "BITPAY_ENV", required: false, purpose: "BitPay sandbox vs production switch" },
  { name: "BITPAY_API_TOKEN", required: false, purpose: "BitPay invoice API token for hosted crypto checkout" },
  { name: "BITPAY_WEBHOOK_SECRET", required: false, purpose: "Optional extra BitPay webhook HMAC secret if configured" },
  { name: "ADMIN_EMAIL", required: false, purpose: "admin quote/lead notification recipient; falls back to COMPANY_EMAIL" },
  { name: "COMPANY_EMAIL", required: false, purpose: "company sender/recipient fallback for transactional email" },
  { name: "GMAIL_USER", required: false, purpose: "Gmail sender address for free email notifications" },
  { name: "GMAIL_APP_PASSWORD", required: false, purpose: "Gmail app password for SMTP email notifications" },
  { name: "SENDGRID_API_KEY", required: false, purpose: "SendGrid fallback email delivery when Gmail OAuth is not configured" },
  { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, purpose: "Google login OAuth client ID" },
  { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: false, purpose: "Google login OAuth client secret" },
  { name: "GOOGLE_OAUTH_REDIRECT_URI", required: false, purpose: "Google login callback URL; defaults to APP_URL/api/auth/google/callback" },
  { name: "GOOGLE_APPLICATION_CREDENTIALS", required: false, purpose: "Google Cloud service-account file for object storage" },
  { name: "GOOGLE_APPLICATION_CREDENTIALS_JSON", required: false, purpose: "Google Cloud service-account JSON for object storage" },
  { name: "GOOGLE_CLOUD_PROJECT_ID", required: false, purpose: "Google Cloud project ID for storage" },
  { name: "ADMIN_PHONE_NUMBER", required: false, purpose: "admin SMS notification recipient" },
  { name: "TWILIO_ACCOUNT_SID", required: false, purpose: "Twilio SMS account for admin/crew notifications" },
  { name: "TWILIO_AUTH_TOKEN", required: false, purpose: "Twilio API auth paired with TWILIO_ACCOUNT_SID" },
  { name: "TWILIO_PHONE_NUMBER", required: false, purpose: "Twilio sender phone number; alternatively use TWILIO_MESSAGING_SERVICE_SID" },
  { name: "TWILIO_MESSAGING_SERVICE_SID", required: false, purpose: "Twilio sender messaging service; alternatively use TWILIO_PHONE_NUMBER" },
];

export interface EnvValidationResult {
  ok: boolean;
  missingRequired: string[];
  missingOptional: string[];
  details: Array<{ name: string; required: boolean; purpose: string; present: boolean }>;
}

function validateEnv(checks: EnvCheck[]): EnvValidationResult {
  const details = checks.map((check) => {
    const present = !!(process.env[check.name] && String(process.env[check.name]).trim());
    return { ...check, present };
  });
  const missingRequired = details.filter((detail) => detail.required && !detail.present).map((detail) => detail.name);
  const missingOptional = details.filter((detail) => !detail.required && !detail.present).map((detail) => detail.name);

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    details,
  };
}

export function validatePaymentEnv(): EnvValidationResult {
  return validateEnv(PAYMENT_ENV);
}

export function validateRequiredEnv(): EnvValidationResult {
  return validateEnv([...STARTUP_ENV, ...SECURITY_ENV, ...PAYMENT_ENV]);
}

export function validateStartupEnv(): EnvValidationResult {
  return validateEnv(STARTUP_ENV);
}

export function assertRequiredEnvOrExit(): void {
  const startupResult = validateStartupEnv();
  const fullResult = validateRequiredEnv();

  if (process.env.NODE_ENV !== "production") {
    const missing = fullResult.details.filter((detail) => !detail.present);
    if (missing.length > 0) {
      console.warn("[env-check] non-production environment detected; missing env vars are allowed for local development:");
      for (const detail of missing) {
        console.warn(`  - ${detail.name} (${detail.required ? "production required" : "optional"}) - ${detail.purpose}`);
      }
    }
    return;
  }

  console.log("[env-check] production startup env vars:");
  for (const detail of startupResult.details) {
    const tag = detail.present ? "OK" : "MISSING";
    console.log(`  ${tag} ${detail.name} (startup required) - ${detail.purpose}`);
  }

  const paymentMissing = validatePaymentEnv().missingRequired;
  if (paymentMissing.length > 0) {
    console.warn(`[env-check] payment env incomplete; service will boot, but payment launch checks will fail until set: ${paymentMissing.join(", ")}`);
  }

  if (!startupResult.ok) {
    const list = startupResult.missingRequired.map((name) => `  - ${name}`).join("\n");
    console.error(`\n[env-check] production startup blocked; missing required env vars:\n${list}\n\nSet these in your production environment and restart.`);
    process.exit(1);
  }
}

export const assertPaymentEnvOrExit = assertRequiredEnvOrExit;
