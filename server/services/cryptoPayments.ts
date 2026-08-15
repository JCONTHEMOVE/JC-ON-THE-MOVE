import crypto from "crypto";

export type CryptoPaymentProvider = "bitpay";

export type CryptoProviderStatus =
  | "new"
  | "paid"
  | "confirmed"
  | "complete"
  | "expired"
  | "invalid"
  | "declined"
  | "unknown";

export type CryptoIntentStatus =
  | "pending"
  | "paid"
  | "expired"
  | "invalid"
  | "declined"
  | "failed";

export type CryptoStatusMapping = {
  providerStatus: CryptoProviderStatus;
  intentStatus: CryptoIntentStatus;
  creditEligible: boolean;
  terminal: boolean;
};

export type CryptoCheckoutIntentInput = {
  amountUsd: number;
  userId: string;
  referenceType: string;
  referenceId: string;
  itemDesc: string;
  redirectUrl: string;
  closeUrl: string;
  notificationUrl: string;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  metadata?: Record<string, unknown>;
  /** Restrict the hosted invoice to explicitly allowed transaction currencies. */
  paymentCurrencies?: string[];
  /** Preselect the buyer currency; used by the BTC/Lightning-only job rail. */
  forcedBuyerSelectedTransactionCurrency?: string;
};

export type CryptoCheckoutIntentResult = {
  provider: CryptoPaymentProvider;
  providerInvoiceId: string;
  providerInvoiceToken: string | null;
  checkoutUrl: string;
  providerStatus: CryptoProviderStatus;
  raw: Record<string, unknown>;
};

export type CryptoPaymentProviderClient = {
  provider: CryptoPaymentProvider;
  createCheckoutIntent(input: CryptoCheckoutIntentInput): Promise<CryptoCheckoutIntentResult>;
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean;
  fetchPayment(providerInvoiceId: string, providerInvoiceToken?: string | null): Promise<Record<string, unknown>>;
  mapProviderStatus(providerPayload: Record<string, unknown>): CryptoStatusMapping;
};

function bitPayBaseUrl() {
  const env = (process.env.BITPAY_ENV || "sandbox").trim().toLowerCase();
  return env === "production" ? "https://bitpay.com" : "https://test.bitpay.com";
}

function bitPayApiToken() {
  const token = process.env.BITPAY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("BitPay is not configured");
  }
  return token;
}

function bitPayHeaders(token: string) {
  return {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Accept-Version": "2.0.0",
    "Authorization": `Bearer ${token}`,
  };
}

function unwrapBitPayData(raw: unknown): Record<string, unknown> {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const data = obj.data && typeof obj.data === "object" ? obj.data as Record<string, unknown> : obj;
  return data;
}

async function parseBitPayResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? JSON.stringify(payload).slice(0, 500)
      : String(payload).slice(0, 500);
    throw new Error(`BitPay API ${response.status}: ${detail}`);
  }
  return payload;
}

export function cryptoPaymentsEnabled() {
  return process.env.CRYPTO_PAYMENTS_ENABLED === "true";
}

export function cryptoPaymentsProvider(): CryptoPaymentProvider {
  const provider = (process.env.CRYPTO_PAYMENTS_PROVIDER || "bitpay").trim().toLowerCase();
  if (provider !== "bitpay") {
    throw new Error(`Unsupported crypto payments provider: ${provider}`);
  }
  return "bitpay";
}

export function getCryptoPaymentProviderClient(
  provider: CryptoPaymentProvider = cryptoPaymentsProvider(),
): CryptoPaymentProviderClient {
  if (provider !== "bitpay") {
    throw new Error(`Unsupported crypto payments provider: ${provider}`);
  }
  return {
    provider: "bitpay",
    createCheckoutIntent: createBitPayCheckoutIntent,
    verifyWebhook: validateOptionalBitPayWebhookSignature,
    fetchPayment: fetchBitPayInvoice,
    mapProviderStatus: (providerPayload) => mapBitPayInvoiceStatus(providerPayload.status),
  };
}

export function mapBitPayInvoiceStatus(rawStatus: unknown): CryptoStatusMapping {
  const normalized = String(rawStatus ?? "").trim().toLowerCase();
  const providerStatus: CryptoProviderStatus = (
    normalized === "new" ||
    normalized === "paid" ||
    normalized === "confirmed" ||
    normalized === "complete" ||
    normalized === "expired" ||
    normalized === "invalid" ||
    normalized === "declined"
  ) ? normalized : "unknown";

  if (providerStatus === "confirmed" || providerStatus === "complete") {
    return { providerStatus, intentStatus: "paid", creditEligible: true, terminal: true };
  }
  if (providerStatus === "expired" || providerStatus === "invalid" || providerStatus === "declined") {
    return { providerStatus, intentStatus: providerStatus, creditEligible: false, terminal: true };
  }
  return { providerStatus, intentStatus: "pending", creditEligible: false, terminal: false };
}

export async function createBitPayCheckoutIntent(
  input: CryptoCheckoutIntentInput,
): Promise<CryptoCheckoutIntentResult> {
  const token = bitPayApiToken();
  const posData = JSON.stringify({
    userId: input.userId,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    ...(input.metadata ?? {}),
  });

  const buyer: Record<string, unknown> = {};
  if (input.customer?.name) buyer.name = input.customer.name;
  if (input.customer?.email) {
    buyer.email = input.customer.email;
    buyer.notify = true;
  }
  if (input.customer?.phone) buyer.phone = input.customer.phone;

  const response = await fetch(`${bitPayBaseUrl()}/invoices`, {
    method: "POST",
    headers: bitPayHeaders(token),
    body: JSON.stringify({
      token,
      price: Number(input.amountUsd.toFixed(2)),
      currency: "USD",
      itemDesc: input.itemDesc,
      orderId: input.referenceId,
      posData,
      redirectURL: input.redirectUrl,
      closeURL: input.closeUrl,
      notificationURL: input.notificationUrl,
      autoRedirect: true,
      acceptanceWindow: 900000,
      transactionSpeed: "medium",
      paymentCurrencies: input.paymentCurrencies,
      forcedBuyerSelectedTransactionCurrency: input.forcedBuyerSelectedTransactionCurrency,
      buyer: Object.keys(buyer).length > 0 ? buyer : undefined,
    }),
  });

  const raw = await parseBitPayResponse(response);
  const data = unwrapBitPayData(raw);
  const providerInvoiceId = typeof data.id === "string" ? data.id : "";
  const checkoutUrl = typeof data.url === "string" ? data.url : "";
  if (!providerInvoiceId || !checkoutUrl) {
    throw new Error("BitPay did not return an invoice id and checkout URL");
  }
  const status = mapBitPayInvoiceStatus(data.status);

  return {
    provider: "bitpay",
    providerInvoiceId,
    providerInvoiceToken: typeof data.token === "string" ? data.token : null,
    checkoutUrl,
    providerStatus: status.providerStatus,
    raw: data,
  };
}

export async function fetchBitPayInvoice(
  providerInvoiceId: string,
  _providerInvoiceToken?: string | null,
) {
  const token = bitPayApiToken();
  const url = new URL(`${bitPayBaseUrl()}/invoices/${encodeURIComponent(providerInvoiceId)}`);
  // BitPay's retrieve endpoint requires the same POS API token used to create
  // the invoice. The invoice token returned in the creation payload is not a
  // replacement for the account API token on this endpoint.
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Accept-Version": "2.0.0",
    },
  });
  const raw = await parseBitPayResponse(response);
  return unwrapBitPayData(raw);
}

export function parseBitPayWebhookBody(body: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf8");
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<string, unknown>;
  }
  if (typeof body === "string") {
    if (!body.trim()) return {};
    return JSON.parse(body) as Record<string, unknown>;
  }
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

export function extractBitPayInvoiceId(payload: Record<string, unknown>) {
  const data = payload.data && typeof payload.data === "object"
    ? payload.data as Record<string, unknown>
    : payload;
  const candidates = [
    data.id,
    data.invoiceId,
    data.invoice_id,
    payload.id,
    payload.invoiceId,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

export function validateOptionalBitPayWebhookSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
) {
  const secret = process.env.BITPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const sent = [
    headers["x-signature"],
    headers["x-bitpay-signature"],
    headers["x-bp-signature"],
    headers["bitpay-signature"],
  ].flat().find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!sent) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const normalizedSent = sent.trim().replace(/^sha256=/i, "");
  return timingSafeEqual(normalizedSent, expectedHex) || timingSafeEqual(normalizedSent, expectedBase64);
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
