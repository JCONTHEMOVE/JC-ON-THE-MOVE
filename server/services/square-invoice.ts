import type { SquareClient } from "square";
import { storage } from "../storage";
import type { InsertSquareInvoice, Lead } from "@shared/schema";

export type InvoiceDeliveryMethod = "email" | "sms" | "both" | "none";

/**
 * Subset of `Lead` that `createItemizedInvoiceForLead` actually reads.
 * Lawn-care quotes don't have a leads-table row, so they pass a typed
 * shim that satisfies this shape — no `as unknown as Lead` casts.
 */
export interface InvoiceRecipient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  totalPrice?: string | number | null;
  bundleDiscountAmount?: string | number | null;
  serviceType?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeLeadId(id: string | undefined | null): string | null {
  if (!id || typeof id !== "string") return null;
  return UUID_RE.test(id) ? id : null;
}

async function getSquareClient(): Promise<SquareClient> {
  const { SquareClient, SquareEnvironment } = await import("square");
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN || "",
    environment: process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}

function primarySquareDeliveryMethod(method: InvoiceDeliveryMethod): any {
  // Square supports API email delivery or a manually shared payment link.
  // Consent-aware SMS delivery is sent by the application after publication.
  return method === "email" ? "EMAIL" : "SHARE_MANUALLY";
}

function isDeliverableEmail(email: string | null | undefined): email is string {
  const value = String(email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  return !/@(?:jconthemove\.local|example\.(?:com|org|net)|test)$/i.test(value);
}

async function applyDualDelivery(
  client: SquareClient,
  invoiceId: string,
  version: number,
  lead: { phone?: string | null }
): Promise<void> {
  if (!lead.phone) {
    console.warn("[dual-delivery] Skipping SMS — no phone on file for lead");
    return;
  }
  try {
    await client.invoices.update({
      invoiceId,
      invoice: {
        version,
        deliveryMethod: "SMS",
      },
      idempotencyKey: `sms-delivery-${invoiceId}-${Date.now()}`,
    });
  } catch (smsErr: unknown) {
    const msg = smsErr instanceof Error ? smsErr.message : String(smsErr);
    console.warn("[dual-delivery] Could not send additional SMS delivery:", msg);
  }
}

export class SquareInvoiceService {
  private locationId: string | null = null;

  async getLocationId(): Promise<string> {
    if (this.locationId) return this.locationId;

    try {
      const client = await getSquareClient();
      const response = await client.locations.list();
      const locations = response.locations;
      if (!locations || locations.length === 0) {
        throw new Error("No Square locations found. Please set up a location in your Square dashboard.");
      }
      this.locationId = locations[0].id || null;
      if (!this.locationId) {
        throw new Error("Location ID is missing");
      }
      return this.locationId;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error fetching Square locations:", msg);
      const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
      if (msg.includes("401") || msg.includes("UNAUTHORIZED") || msg.includes("AUTHENTICATION_ERROR")) {
        throw new Error(`Square authentication failed. Your access token may be invalid or expired. Make sure SQUARE_ACCESS_TOKEN matches your ${env} environment. Get a new token from developer.squareup.com.`);
      }
      throw new Error(`Failed to get Square location: ${msg}`);
    }
  }

  async createOrGetCustomer(email: string | null | undefined, name: string, phone?: string): Promise<string> {
    try {
      const client = await getSquareClient();
      const customerEmail = isDeliverableEmail(email) ? email.trim() : undefined;

      if (customerEmail) {
        const searchResponse = await client.customers.search({
          query: {
            filter: {
              emailAddress: {
                exact: customerEmail,
              },
            },
          },
        });

        if (searchResponse.customers && searchResponse.customers.length > 0) {
          const existing = searchResponse.customers[0];
          if (phone && !existing.phoneNumber) {
            await client.customers.update({
              customerId: existing.id!,
              phoneNumber: phone,
            });
          }
          return existing.id!;
        }
      }

      const nameParts = name.split(" ");
      const firstName = nameParts[0] || name;
      const lastName = nameParts.slice(1).join(" ") || "";

      const createResponse = await client.customers.create({
        ...(customerEmail ? { emailAddress: customerEmail } : {}),
        givenName: firstName,
        familyName: lastName,
        phoneNumber: phone,
        idempotencyKey: `customer-${customerEmail || phone || name}-${Date.now()}`,
      });

      return createResponse.customer!.id!;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error creating/getting Square customer:", msg);
      throw new Error(`Failed to create customer: ${msg}`);
    }
  }

  async createInvoiceForLead(
    lead: Lead,
    amount: number,
    description?: string,
    dueDate?: string,
    deliveryMethod: InvoiceDeliveryMethod = "email"
  ): Promise<{ invoiceId: string; invoiceUrl: string; squareInvoiceId: string }> {
    const client = await getSquareClient();
    const locationId = await this.getLocationId();
    const customerName = `${lead.firstName} ${lead.lastName}`;
    const customerId = await this.createOrGetCustomer(lead.email, customerName, lead.phone || undefined);

    const amountInCents = BigInt(Math.round(amount * 100));

    const orderResponse = await client.orders.create({
      idempotencyKey: `order-${lead.id}-${Date.now()}`,
      order: {
        locationId,
        customerId,
        lineItems: [
          {
            name: description || `Moving Service - ${lead.serviceType}`,
            quantity: "1",
            basePriceMoney: {
              amount: amountInCents,
              currency: "USD",
            },
          },
        ],
      },
    });

    const orderId = orderResponse.order!.id!;
    const squareDelivery = primarySquareDeliveryMethod(deliveryMethod);

    const invoiceResponse = await client.invoices.create({
      idempotencyKey: `invoice-${lead.id}-${Date.now()}`,
      invoice: {
        orderId,
        locationId,
        primaryRecipient: {
          customerId,
        },
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate: dueDate || this.getDefaultDueDate(),
          },
        ],
        deliveryMethod: squareDelivery,
        acceptedPaymentMethods: {
          card: true,
          bankAccount: true,
          squareGiftCard: false,
          buyNowPayLater: false,
          cashAppPay: true,
        },
        title: `Invoice - JC ON THE MOVE`,
        description: description || `Moving service for ${customerName}`,
      },
    });

    const squareInvoice = invoiceResponse.invoice!;

    const publishResponse = await client.invoices.publish({
      invoiceId: squareInvoice.id!,
      version: squareInvoice.version!,
      idempotencyKey: `publish-${squareInvoice.id}-${Date.now()}`,
    });

    const publishedInvoice = publishResponse.invoice!;

    const invoiceData: InsertSquareInvoice = {
      leadId: safeLeadId(lead.id),
      squareInvoiceId: publishedInvoice.id!,
      squareInvoiceNumber: publishedInvoice.invoiceNumber ?? undefined,
      squareOrderId: orderId,
      customerId,
      customerEmail: lead.email,
      customerName,
      amount: amount.toString(),
      currency: "USD",
      description: description || `Moving service - ${lead.serviceType}`,
      status: "sent",
      invoiceUrl: publishedInvoice.publicUrl,
      dueDate: dueDate || this.getDefaultDueDate(),
    };

    const savedInvoice = await storage.createSquareInvoice(invoiceData);

    return {
      invoiceId: savedInvoice.id,
      invoiceUrl: publishedInvoice.publicUrl || "",
      squareInvoiceId: publishedInvoice.id!,
    };
  }

  async createStandaloneInvoice(
    email: string,
    name: string,
    phone: string | undefined,
    amount: number,
    description: string,
    dueDate?: string,
    deliveryMethod: InvoiceDeliveryMethod = "email"
  ): Promise<{ invoiceId: string; invoiceUrl: string; squareInvoiceId: string }> {
    const client = await getSquareClient();
    const locationId = await this.getLocationId();
    const customerId = await this.createOrGetCustomer(email, name, phone);

    const amountInCents = BigInt(Math.round(amount * 100));

    const orderResponse = await client.orders.create({
      idempotencyKey: `order-standalone-${Date.now()}`,
      order: {
        locationId,
        customerId,
        lineItems: [
          {
            name: description,
            quantity: "1",
            basePriceMoney: {
              amount: amountInCents,
              currency: "USD",
            },
          },
        ],
      },
    });

    const orderId = orderResponse.order!.id!;
    const squareDelivery = primarySquareDeliveryMethod(deliveryMethod);

    const invoiceResponse = await client.invoices.create({
      idempotencyKey: `invoice-standalone-${Date.now()}`,
      invoice: {
        orderId,
        locationId,
        primaryRecipient: {
          customerId,
        },
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate: dueDate || this.getDefaultDueDate(),
          },
        ],
        deliveryMethod: squareDelivery,
        acceptedPaymentMethods: {
          card: true,
          bankAccount: true,
          squareGiftCard: false,
          buyNowPayLater: false,
          cashAppPay: true,
        },
        title: `Invoice - JC ON THE MOVE`,
        description,
      },
    });

    const squareInvoice = invoiceResponse.invoice!;

    const publishResponse = await client.invoices.publish({
      invoiceId: squareInvoice.id!,
      version: squareInvoice.version!,
      idempotencyKey: `publish-${squareInvoice.id}-${Date.now()}`,
    });

    const publishedInvoice = publishResponse.invoice!;

    const invoiceData: InsertSquareInvoice = {
      squareInvoiceId: publishedInvoice.id!,
      squareInvoiceNumber: publishedInvoice.invoiceNumber ?? undefined,
      squareOrderId: orderId,
      customerId,
      customerEmail: email,
      customerName: name,
      amount: amount.toString(),
      currency: "USD",
      description,
      status: "sent",
      invoiceUrl: publishedInvoice.publicUrl,
      dueDate: dueDate || this.getDefaultDueDate(),
    };

    const savedInvoice = await storage.createSquareInvoice(invoiceData);

    return {
      invoiceId: savedInvoice.id,
      invoiceUrl: publishedInvoice.publicUrl || "",
      squareInvoiceId: publishedInvoice.id!,
    };
  }

  async getCatalogMappings(): Promise<Record<string, string>> {
    try {
      const { pool } = await import("../db");
      const { rows } = await pool.query(`SELECT setting_value FROM spin_config WHERE setting_key='square_catalog_mappings' LIMIT 1`);
      return rows.length > 0 ? JSON.parse(rows[0].setting_value) : {};
    } catch (_) { return {}; }
  }

  async createItemizedInvoiceForLead(
    lead: InvoiceRecipient,
    lineItems: Array<{ id?: string; name: string; qty: number; unitPrice: number; total: number; excludeFromBundleDiscount?: boolean }>,
    dueDate?: string,
    deliveryMethod: InvoiceDeliveryMethod = "email"
  ): Promise<{ invoiceId: string; invoiceUrl: string; squareInvoiceId: string }> {
    const client = await getSquareClient();
    const locationId = await this.getLocationId();
    const customerName = `${lead.firstName} ${lead.lastName}`;
    const customerId = await this.createOrGetCustomer(lead.email, customerName, lead.phone || undefined);

    const catalogMappings = await this.getCatalogMappings();

    // Bundle discount (Task #114). Upstream callers pass lineItems whose
    // totals sum to the *already-discounted* lead.totalPrice. To make the
    // discount visible on the customer's invoice (a real Square discount
    // line) without changing the amount they owe, we:
    //   1) Detect the auto-applied case (line-item sum ≈ lead.totalPrice).
    //   2) Scale each line item up to its gross value.
    //   3) Add an order-level FIXED_AMOUNT discount equal to the saved
    //      lead.bundleDiscountAmount.
    // Net total stays the same; the customer sees subtotal + discount line.
    // If line items don't match the discounted total (admin manually edited
    // them), we skip injection to avoid double-discounting.
    const bundleDiscountAmt = parseFloat(String(lead.bundleDiscountAmount || "0")) || 0;
    // Task #199 — split lines into "discountable" (the base service) and
    // "passthrough" (shop-card add-ons). The bundle-discount math only
    // looks at discountable lines so it never tries to take 10% off the
    // shop card itself.
    const discountableLines = lineItems.filter(li => !li.excludeFromBundleDiscount);
    const passthroughLines = lineItems.filter(li => li.excludeFromBundleDiscount);
    const netDiscountableSum = discountableLines.reduce((s, li) => s + li.total, 0);
    const passthroughSum = passthroughLines.reduce((s, li) => s + li.total, 0);
    const expectedNet = parseFloat(String(lead.totalPrice || "0")) || 0;
    // We can only safely scale ad-hoc (non-catalog) line items. If ANY
    // discountable line resolves to a catalog variation, we can't
    // change its price client-side, so injecting an order-level
    // discount on top would undercharge the customer. Skip injection
    // in that case.
    const hasCatalogItem = discountableLines.some(li => li.id && catalogMappings[li.id]);
    const isAutoDiscountCase =
      bundleDiscountAmt > 0 &&
      expectedNet > 0 &&
      !hasCatalogItem &&
      Math.abs(netDiscountableSum - expectedNet) < 0.01;
    const grossMultiplier = isAutoDiscountCase
      ? (netDiscountableSum + bundleDiscountAmt) / netDiscountableSum
      : 1;

    const squareLineItems = lineItems.map(li => {
      const catalogVariationId = li.id ? catalogMappings[li.id] : undefined;
      if (catalogVariationId) {
        return {
          catalogObjectId: catalogVariationId,
          quantity: String(li.qty),
        };
      }
      // Passthrough lines (shop card) keep their full price; only
      // discountable lines get scaled up so the order-level discount
      // can show the savings.
      const scaledUnitPrice = li.excludeFromBundleDiscount
        ? li.unitPrice
        : li.unitPrice * grossMultiplier;
      return {
        name: li.name,
        quantity: String(li.qty),
        basePriceMoney: {
          amount: BigInt(Math.round(scaledUnitPrice * 100)),
          currency: "USD" as const,
        },
      };
    });

    const orderDiscounts = isAutoDiscountCase
      ? [{
          name: "Bundle Discount (10%, capped at $50)",
          type: "FIXED_AMOUNT" as const,
          amountMoney: {
            amount: BigInt(Math.round(bundleDiscountAmt * 100)),
            currency: "USD" as const,
          },
          scope: "ORDER" as const,
        }]
      : undefined;

    // Final amount we expect to charge the customer.
    // Final amount on the invoice = (discounted base service) + (full-price passthrough lines).
    const totalAmount = (isAutoDiscountCase ? expectedNet : netDiscountableSum) + passthroughSum;

    const orderResponse = await client.orders.create({
      idempotencyKey: `order-itemized-${lead.id}-${Date.now()}`,
      order: {
        locationId,
        customerId,
        lineItems: squareLineItems,
        ...(orderDiscounts ? { discounts: orderDiscounts } : {}),
      },
    });

    const orderId = orderResponse.order!.id!;
    const squareDelivery = primarySquareDeliveryMethod(deliveryMethod);

    const invoiceResponse = await client.invoices.create({
      idempotencyKey: `invoice-itemized-${lead.id}-${Date.now()}`,
      invoice: {
        orderId,
        locationId,
        primaryRecipient: { customerId },
        paymentRequests: [{ requestType: "BALANCE", dueDate: dueDate || this.getDefaultDueDate() }],
        deliveryMethod: squareDelivery,
        acceptedPaymentMethods: { card: true, bankAccount: true, squareGiftCard: false, buyNowPayLater: false, cashAppPay: true },
        title: `Invoice - JC ON THE MOVE`,
        description: `Moving service for ${customerName}`,
      },
    });

    const squareInvoice = invoiceResponse.invoice!;
    const publishResponse = await client.invoices.publish({
      invoiceId: squareInvoice.id!,
      version: squareInvoice.version!,
      idempotencyKey: `publish-itemized-${squareInvoice.id}-${Date.now()}`,
    });
    const publishedInvoice = publishResponse.invoice!;

    const invoiceData: InsertSquareInvoice = {
      leadId: safeLeadId(lead.id),
      squareInvoiceId: publishedInvoice.id!,
      squareInvoiceNumber: publishedInvoice.invoiceNumber ?? undefined,
      squareOrderId: orderId,
      customerId,
      customerEmail: lead.email,
      customerName,
      amount: totalAmount.toFixed(2),
      currency: "USD",
      description: `Itemized order — ${lineItems.length} line item(s)`,
      status: "sent",
      invoiceUrl: publishedInvoice.publicUrl,
      dueDate: dueDate || this.getDefaultDueDate(),
    };

    const savedInvoice = await storage.createSquareInvoice(invoiceData);
    return {
      invoiceId: savedInvoice.id,
      invoiceUrl: publishedInvoice.publicUrl || "",
      squareInvoiceId: publishedInvoice.id!,
    };
  }

  async getInvoiceStatus(squareInvoiceId: string): Promise<string> {
    try {
      const client = await getSquareClient();
      const response = await client.invoices.get({ invoiceId: squareInvoiceId });
      return response.invoice?.status || "UNKNOWN";
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error getting invoice status:", msg);
      throw new Error(`Failed to get invoice status: ${msg}`);
    }
  }

  async cancelInvoice(squareInvoiceId: string): Promise<void> {
    try {
      const client = await getSquareClient();
      const getResponse = await client.invoices.get({ invoiceId: squareInvoiceId });
      const version = getResponse.invoice?.version;

      if (!version) {
        throw new Error("Could not get invoice version");
      }

      await client.invoices.cancel({
        invoiceId: squareInvoiceId,
        version,
      });

      await storage.updateSquareInvoiceStatus(squareInvoiceId, "canceled");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error canceling invoice:", msg);
      throw new Error(`Failed to cancel invoice: ${msg}`);
    }
  }

  async syncInvoiceStatus(squareInvoiceId: string): Promise<string> {
    try {
      const client = await getSquareClient();
      const response = await client.invoices.get({ invoiceId: squareInvoiceId });
      const invoice = response.invoice;

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const status = this.mapSquareStatus(invoice.status || "DRAFT");
      await storage.updateSquareInvoiceStatus(squareInvoiceId, status);

      return status;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error syncing invoice status:", msg);
      throw new Error(`Failed to sync invoice status: ${msg}`);
    }
  }

  mapSquareStatus(squareStatus: string): string {
    const statusMap: Record<string, string> = {
      DRAFT: "draft",
      UNPAID: "sent",
      SCHEDULED: "sent",
      PARTIALLY_PAID: "sent",
      PAID: "paid",
      PARTIALLY_REFUNDED: "paid",
      REFUNDED: "paid",
      CANCELED: "canceled",
      FAILED: "failed",
      PAYMENT_PENDING: "sent",
    };
    return statusMap[squareStatus] || "sent";
  }

  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split("T")[0];
  }

  isConfigured(): boolean {
    return !!process.env.SQUARE_ACCESS_TOKEN;
  }
}

export const squareInvoiceService = new SquareInvoiceService();
