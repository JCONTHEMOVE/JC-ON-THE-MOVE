import assert from "node:assert/strict";
import {
  decryptMarketingMetaSecret,
  encryptMarketingMetaSecret,
} from "../marketingMetaCrypto";

const encryptionSecret = "test-only-marketing-meta-encryption-key-1234567890";
const plaintext = "EAAB-meta-token-that-must-never-be-returned";
const encrypted = encryptMarketingMetaSecret(plaintext, encryptionSecret);

assert.match(encrypted, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
assert.ok(!encrypted.includes(plaintext), "ciphertext must not contain the Page token");
assert.equal(decryptMarketingMetaSecret(encrypted, encryptionSecret), plaintext);

const parts = encrypted.split(".");
const tamperedCiphertext = Buffer.from(parts[3], "base64url");
tamperedCiphertext[0] ^= 1;
parts[3] = tamperedCiphertext.toString("base64url");
assert.throws(() => decryptMarketingMetaSecret(parts.join("."), encryptionSecret), "tampered ciphertext must fail authentication");
assert.throws(
  () => decryptMarketingMetaSecret(encrypted, "different-test-only-marketing-key-1234567890"),
  "a different key must not decrypt the credential",
);
assert.throws(
  () => encryptMarketingMetaSecret(plaintext, "too-short"),
  "short encryption secrets must fail closed",
);

console.log("marketing rep Meta credential tests passed");
