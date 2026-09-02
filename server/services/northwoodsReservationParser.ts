import {
  northwoodsParsedReservationSchema,
  type NorthwoodsParsedReservation,
} from "@shared/northwoodsMarketing";

function decodeHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capture(text: string, labels: string[], valuePattern = "[^\\n]{2,500}") {
  const label = labels.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.match(new RegExp(`(?:${label})\\s*(?:#|number|no\\.)?\\s*[:\\-]\\s*(${valuePattern})`, "i"))?.[1]?.trim() || null;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = value.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function time24(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function amountCents(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Math.round(Number(match[1].replaceAll(",", "")) * 100) : null;
}

function numberValue(value: string | null): number | null {
  const match = value?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function splitName(value: string | null) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: null, last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") || "Unknown" };
}

function inferFocus(text: string): NorthwoodsParsedReservation["focus"] {
  if (/u[ -]?box/i.test(text)) return "u_box";
  if (/gun safe|\bsafe\b/i.test(text)) return "safe";
  if (/piano/i.test(text)) return "piano";
  if (/pack\s*\/\s*unpack|packing|unpacking/i.test(text)) return "packing";
  if (/unload/i.test(text) && !/load\s*\/\s*unload/i.test(text)) return "unloading";
  if (/load/i.test(text)) return "loading";
  return null;
}

function inferMarket(text: string): string | null {
  const options: Array<[RegExp, string]> = [
    [/Ironwood|49938/i, "ironwood"],
    [/Iron Mountain|49801/i, "iron-mountain"],
    [/Eagle River|54521/i, "eagle-river"],
    [/Iron River|49935/i, "iron-river"],
    [/Houghton|49931/i, "houghton"],
    [/Wausau|54402/i, "wausau"],
  ];
  return options.find(([pattern]) => pattern.test(text))?.[1] || null;
}

function requiredFields(parsed: Omit<NorthwoodsParsedReservation, "missingFields">) {
  const checks: Array<[string, unknown]> = [
    ["externalOrderId", parsed.externalOrderId],
    ["customerFirstName", parsed.customerFirstName],
    ["customerLastName", parsed.customerLastName],
    ["customerEmail", parsed.customerEmail],
    ["customerPhone", parsed.customerPhone],
    ["serviceDate", parsed.serviceDate],
    ["startTime", parsed.startTime],
    ["durationHours", parsed.durationHours],
    ["crewSize", parsed.crewSize],
    ["fromAddress", parsed.fromAddress],
    ["focus", parsed.focus],
  ];
  return checks.filter(([, value]) => value === null || value === "").map(([key]) => key);
}

export function parseNorthwoodsReservationEmail(input: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): NorthwoodsParsedReservation {
  const subject = String(input.subject || "").trim();
  const body = [String(input.text || ""), decodeHtml(String(input.html || ""))].filter(Boolean).join("\n");
  const content = `${subject}\n${body}`.replace(/\u0000/g, "");
  const name = splitName(capture(content, ["Customer", "Customer Name", "Contact Name", "Name"]));
  const email = capture(content, ["Customer Email", "Email Address", "Email"], "[^\\s<>,;]+@[^\\s<>,;]+")
    || content.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]
    || null;
  const phone = capture(content, ["Primary Phone", "Customer Phone", "Phone Number", "Phone"], "(?:\\+?1[ .-]?)?\\(?\\d{3}\\)?[ .-]?\\d{3}[ .-]?\\d{4}")
    || content.match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/)?.[0]
    || null;
  const orderId = capture(content, ["Moving Help Order", "Order ID", "Order Number", "Reservation ID", "Reservation Number", "Job ID"], "[A-Z0-9][A-Z0-9-]{4,159}")
    || content.match(/\b(?:MH|UHM|ORDER)[-#]?[A-Z0-9-]{5,}\b/i)?.[0]
    || null;
  const serviceDate = isoDate(capture(content, ["Service Date", "Move Date", "Job Date", "Date"], "[^\\n]{4,80}"));
  const startTime = time24(capture(content, ["Job Time", "Start Time", "Service Time", "Arrival Time", "Time"], "[^\\n]{2,40}"));
  const durationHours = numberValue(capture(content, ["Hours Needed", "Requested Hours", "Duration", "Hours"], "[^\\n]{1,40}"));
  const crewSize = numberValue(capture(content, ["Number of Helpers", "Crew Size", "Helpers", "Movers"], "[^\\n]{1,40}"));
  const fromAddress = capture(content, ["Service Address", "Load Address", "Pickup Address", "From Address", "Address"], "[^\\n]{5,500}");
  const toAddress = capture(content, ["Unload Address", "Destination Address", "Drop Off Address", "Drop-off Address", "To Address"], "[^\\n]{5,500}");
  const quote = capture(content, ["Order Total", "Your Price", "Total", "Subtotal", "Labor Rate"], "\\$\\s*[\\d,.]+");
  const focus = inferFocus(content);
  const emailKind: NorthwoodsParsedReservation["emailKind"] = /cancel(?:led|ation)?/i.test(subject)
    ? "cancel"
    : /updated?|changed?|rescheduled?/i.test(subject) ? "update" : "new";

  const withoutMissing = {
    externalOrderId: orderId,
    customerFirstName: name.first,
    customerLastName: name.last,
    customerEmail: email,
    customerPhone: phone,
    serviceDate,
    startTime,
    durationHours,
    crewSize,
    fromAddress,
    toAddress,
    marketSlug: inferMarket(`${fromAddress || ""}\n${toAddress || ""}\n${content}`),
    focus,
    quotedAmountCents: amountCents(quote),
    notes: capture(content, ["Details Of Your Move", "Move Details", "Service Details", "Notes"], "[^\\n]{2,5000}"),
    emailKind,
  };
  return northwoodsParsedReservationSchema.parse({
    ...withoutMissing,
    missingFields: requiredFields(withoutMissing),
  });
}

export { decodeHtml as northwoodsEmailTextFromHtml };
