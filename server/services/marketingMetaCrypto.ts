import crypto from "crypto";

function encryptionKey(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Meta OAuth token encryption is not configured");
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptMarketingMetaSecret(
  value: string,
  secret = process.env.META_OAUTH_TOKEN_ENCRYPTION_KEY || "",
) {
  if (!value) throw new Error("Cannot encrypt an empty Meta credential");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMarketingMetaSecret(
  value: string,
  secret = process.env.META_OAUTH_TOKEN_ENCRYPTION_KEY || "",
) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = String(value || "").split(".");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Unsupported encrypted Meta credential");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function assertMarketingMetaEncryptionConfigured(secret = process.env.META_OAUTH_TOKEN_ENCRYPTION_KEY || "") {
  encryptionKey(secret);
}
