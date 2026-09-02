export const ASHLEY_SHOP_DEFAULTS = {
  mailbox: "ashleyseegert64@gmail.com",
  intakeAlias: "ashleyseegert64+shop@gmail.com",
  authorizedSender: "ashleyseegert64@gmail.com",
} as const;

export type AshleyShopSetupValue = {
  key: string;
  label: string;
  required: boolean;
  state: "ready" | "missing" | "disabled" | "defaulted" | "mismatch";
  description: string;
  effectiveValue?: string;
  secret?: boolean;
};

function configuredValue(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function normalizeAshleyEmailAddress(value: unknown): string {
  const input = String(value || "").trim();
  const angleMatch = input.match(/<([^<>@\s]+@[^<>\s]+)>/);
  return (angleMatch?.[1] || input).trim().toLowerCase();
}

export function canonicalGmailAddress(value: unknown): string {
  const normalized = normalizeAshleyEmailAddress(value);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return normalized;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replaceAll(".", "")}@gmail.com`;
  }
  return normalized;
}

export function isAshleyFinalApprovalActor(actorEmail: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  const authorized = configuredValue(env, "ASHLEY_SHOP_AUTHORIZED_SENDER") || ASHLEY_SHOP_DEFAULTS.authorizedSender;
  return normalizeAshleyEmailAddress(actorEmail) === normalizeAshleyEmailAddress(authorized);
}

export function assertAshleyFinalApprovalActor(actorEmail: unknown, env: NodeJS.ProcessEnv = process.env): void {
  if (!isAshleyFinalApprovalActor(actorEmail, env)) {
    throw new Error("Ashley must sign in with the authorized shop account to set the final price or publish listings");
  }
}

export function validateAshleyDraftPublication(
  draft: {
    final_price?: unknown;
    final_price_set_by_user_id?: unknown;
    final_price_set_by_email?: unknown;
    final_price_set_at?: unknown;
    media_ids?: unknown;
  },
  actorEmail: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isAshleyFinalApprovalActor(actorEmail, env)) errors.push("Ashley approval is required");
  const price = Number(draft.final_price);
  if (!Number.isFinite(price) || price <= 0) errors.push("A final price greater than zero is required");
  if (!draft.final_price_set_by_user_id || !draft.final_price_set_at || !isAshleyFinalApprovalActor(draft.final_price_set_by_email, env)) {
    errors.push("Ashley must save the final price from the authorized account");
  }
  if (!Array.isArray(draft.media_ids) || draft.media_ids.length === 0) errors.push("At least one reviewed photo is required");
  return { ok: errors.length === 0, errors };
}

export function getAshleyShopSetup(env: NodeJS.ProcessEnv = process.env) {
  const mailbox = normalizeAshleyEmailAddress(configuredValue(env, "ASHLEY_SHOP_MAILBOX") || ASHLEY_SHOP_DEFAULTS.mailbox);
  const intakeAlias = normalizeAshleyEmailAddress(configuredValue(env, "ASHLEY_SHOP_INTAKE_ALIAS") || ASHLEY_SHOP_DEFAULTS.intakeAlias);
  const authorizedSender = normalizeAshleyEmailAddress(configuredValue(env, "ASHLEY_SHOP_AUTHORIZED_SENDER") || ASHLEY_SHOP_DEFAULTS.authorizedSender);
  const automationEnabled = env.ASHLEY_SHOP_AUTOMATION_ENABLED !== "false";
  const emailIngestEnabled = env.ASHLEY_SHOP_EMAIL_INGEST_ENABLED === "true";
  const credentialsReady = Boolean(
    configuredValue(env, "ASHLEY_GMAIL_CLIENT_ID")
    && configuredValue(env, "ASHLEY_GMAIL_CLIENT_SECRET")
    && configuredValue(env, "ASHLEY_GMAIL_REFRESH_TOKEN"),
  );
  const mailboxMatchesAlias = canonicalGmailAddress(mailbox) === canonicalGmailAddress(intakeAlias);
  const senderMatchesMailbox = canonicalGmailAddress(authorizedSender) === canonicalGmailAddress(mailbox);
  const objectStorageReady = Boolean(configuredValue(env, "PUBLIC_OBJECT_SEARCH_PATHS"));
  const outboundEmailReady = Boolean(
    configuredValue(env, "GMAIL_APP_PASSWORD")
    || (
      configuredValue(env, "GMAIL_CLIENT_ID")
      && configuredValue(env, "GMAIL_CLIENT_SECRET")
      && configuredValue(env, "GMAIL_REFRESH_TOKEN")
    )
    || configuredValue(env, "SENDGRID_API_KEY")?.startsWith("SG."),
  );

  const values: AshleyShopSetupValue[] = [
    {
      key: "ASHLEY_SHOP_AUTOMATION_ENABLED",
      label: "Ashley workflow scheduler",
      required: true,
      state: automationEnabled ? (configuredValue(env, "ASHLEY_SHOP_AUTOMATION_ENABLED") ? "ready" : "defaulted") : "disabled",
      description: "Runs the guarded inbox and draft-processing schedule.",
      effectiveValue: String(automationEnabled),
    },
    {
      key: "ASHLEY_SHOP_EMAIL_INGEST_ENABLED",
      label: "Automatic inbox polling",
      required: true,
      state: emailIngestEnabled ? "ready" : "disabled",
      description: "Must be true after the mailbox connection is verified.",
      effectiveValue: String(emailIngestEnabled),
    },
    {
      key: "ASHLEY_SHOP_MAILBOX",
      label: "Connected mailbox",
      required: true,
      state: configuredValue(env, "ASHLEY_SHOP_MAILBOX") ? "ready" : "defaulted",
      description: "The Google account that owns the read-only Gmail connection.",
      effectiveValue: mailbox,
    },
    {
      key: "ASHLEY_SHOP_INTAKE_ALIAS",
      label: "Photo intake address",
      required: true,
      state: mailboxMatchesAlias ? (configuredValue(env, "ASHLEY_SHOP_INTAKE_ALIAS") ? "ready" : "defaulted") : "mismatch",
      description: "Only messages addressed to this alias are eligible for intake.",
      effectiveValue: intakeAlias,
    },
    {
      key: "ASHLEY_SHOP_AUTHORIZED_SENDER",
      label: "Authorized sender and approver",
      required: true,
      state: senderMatchesMailbox ? (configuredValue(env, "ASHLEY_SHOP_AUTHORIZED_SENDER") ? "ready" : "defaulted") : "mismatch",
      description: "Only this address can submit photos, set final prices, and publish.",
      effectiveValue: authorizedSender,
    },
    ...["ASHLEY_GMAIL_CLIENT_ID", "ASHLEY_GMAIL_CLIENT_SECRET", "ASHLEY_GMAIL_REFRESH_TOKEN"].map((key) => ({
      key,
      label: key === "ASHLEY_GMAIL_CLIENT_ID" ? "Gmail OAuth client ID" : key === "ASHLEY_GMAIL_CLIENT_SECRET" ? "Gmail OAuth client secret" : "Gmail OAuth refresh token",
      required: true,
      state: configuredValue(env, key) ? "ready" as const : "missing" as const,
      description: key === "ASHLEY_GMAIL_REFRESH_TOKEN"
        ? "Authorize only the intended mailbox with Gmail read-only access."
        : "Use the dedicated OAuth client for Ashley's mailbox connection.",
      secret: true,
    })),
    {
      key: "PUBLIC_OBJECT_SEARCH_PATHS",
      label: "Photo object storage",
      required: true,
      state: objectStorageReady ? "ready" : "missing",
      description: "Stores normalized intake images used by drafts and approved listings.",
      secret: true,
    },
    {
      key: "AI_GATEWAY_API_KEY",
      label: "Vision draft provider",
      required: false,
      state: configuredValue(env, "AI_GATEWAY_API_KEY") ? "ready" : "missing",
      description: "Recommended. Without it, each image still becomes a review-only fallback draft.",
      secret: true,
    },
    {
      key: "PUBLIC_APP_URL",
      label: "Approval link base URL",
      required: false,
      state: configuredValue(env, "PUBLIC_APP_URL") || configuredValue(env, "APP_URL") ? "ready" : "defaulted",
      description: "Used for the review link in Ashley's draft-ready email.",
      effectiveValue: configuredValue(env, "PUBLIC_APP_URL") || configuredValue(env, "APP_URL") || "https://www.jconthemove.com",
    },
    {
      key: "GMAIL_* or SENDGRID_API_KEY",
      label: "Draft-ready email delivery",
      required: false,
      state: outboundEmailReady ? "ready" : "missing",
      description: "Recommended for receipt and approval-ready notifications; intake and drafts still work without it.",
      secret: true,
    },
  ];

  return {
    automationEnabled,
    emailIngestEnabled,
    credentialsReady,
    mailboxMatchesAlias,
    senderMatchesMailbox,
    objectStorageReady,
    outboundEmailReady,
    mailbox,
    intakeAlias,
    authorizedSender,
    values,
    requiredReady: automationEnabled
      && emailIngestEnabled
      && credentialsReady
      && mailboxMatchesAlias
      && senderMatchesMailbox
      && objectStorageReady,
  };
}
