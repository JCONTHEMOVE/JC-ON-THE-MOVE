import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type JobAccessDetails = {
  accessCode?: string;
  entryInstructions?: string;
};

const VERSION = "v1";

/**
 * Access codes are operationally useful but should not be mixed into general
 * job notes. A dedicated key can be supplied for rotation; the existing
 * session secret remains a secure production fallback so deployment does not
 * depend on a new secret being set first.
 */
function jobAccessKey() {
  const secret = process.env.JOB_ACCESS_ENCRYPTION_KEY
    || process.env.ENCRYPTION_KEY
    || process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? "" : "job-access-development-only-key");
  if (!secret) throw new Error("Secure job-access encryption is not configured");
  return createHash("sha256").update(secret).digest();
}

export function encryptJobAccessDetails(details: JobAccessDetails): string | null {
  const normalized = {
    accessCode: String(details.accessCode || "").trim(),
    entryInstructions: String(details.entryInstructions || "").trim(),
  };
  if (!normalized.accessCode && !normalized.entryInstructions) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", jobAccessKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalized), "utf8"),
    cipher.final(),
  ]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptJobAccessDetails(ciphertext: string | null | undefined): JobAccessDetails | null {
  if (!ciphertext) return null;
  try {
    const [version, ivEncoded, tagEncoded, encryptedEncoded] = ciphertext.split(".");
    if (version !== VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded) return null;
    const decipher = createDecipheriv("aes-256-gcm", jobAccessKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final(),
    ]);
    const value = JSON.parse(decrypted.toString("utf8")) as JobAccessDetails;
    return {
      accessCode: String(value.accessCode || "").trim() || undefined,
      entryInstructions: String(value.entryInstructions || "").trim() || undefined,
    };
  } catch {
    // Treat an unreadable value as unavailable rather than leaking cryptographic
    // details or blocking all other job information.
    return null;
  }
}
