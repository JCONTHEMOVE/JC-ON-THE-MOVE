import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
const publicLeadStart = routesSource.indexOf("// Submit quote request");
const publicLeadEnd = routesSource.indexOf("// Upload photo/video for a job request", publicLeadStart);

assert.ok(publicLeadStart >= 0 && publicLeadEnd > publicLeadStart, "public lead route markers should exist");

const publicLeadRoute = routesSource.slice(publicLeadStart, publicLeadEnd);
assert.match(publicLeadRoute, /await emitJobEvent\("quote_requested", lead, \{/);
assert.match(publicLeadRoute, /eventId: `public-quote:\$\{lead\.id\}`/);
assert.match(publicLeadRoute, /source: "public_quote_form"/);

console.log("public lead Discord alert route wiring test passed");
