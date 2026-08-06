import assert from "node:assert/strict";
import { decryptJobAccessDetails, encryptJobAccessDetails } from "../job-access";

const encrypted = encryptJobAccessDetails({
  accessCode: "4932",
  entryInstructions: "Use the side entrance after 8 AM.",
});

assert.ok(encrypted);
assert.ok(!encrypted!.includes("4932"));
assert.deepEqual(decryptJobAccessDetails(encrypted), {
  accessCode: "4932",
  entryInstructions: "Use the side entrance after 8 AM.",
});
assert.equal(encryptJobAccessDetails({ accessCode: "", entryInstructions: "" }), null);

console.log("job access encryption tests passed");
