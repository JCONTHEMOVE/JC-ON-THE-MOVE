import assert from "node:assert/strict";
import {
  assertNorthwoodsOfficialUrl,
  parseMarketResultsHtml,
  parseNorthwoodsProfileHtml,
} from "../northwoodsMarketScanner";

const profile = parseNorthwoodsProfileHtml(`
  <h1>Northwoods Moving and Junk Removing</h1>
  <p>Labor Rate: $560.00</p>
  <p>After 2 hours, discounted hourly rate of $240.00</p>
  <p>Piano Fee $350</p><p>Gun Safe Fee $500</p>
  <p>Customer Rating: 4.8</p><p>31 reviews</p><p>Completed Jobs: 92</p>
  <p>Load / Unload · Pack / Unpack · U-Box</p>
`, "https://www.uhaul.com/MovingHelp/Iron-Mountain-MI-49801/1/Northwoods/?id=404EEC12FC5143");

assert.equal(profile.twoHourRateCents, 56000);
assert.equal(profile.additionalHourRateCents, 24000);
assert.equal(profile.pianoFeeCents, 35000);
assert.equal(profile.safeFeeCents, 50000);
assert.equal(profile.rating, 4.8);
assert.deepEqual(profile.services.slice(0, 4), ["loading", "unloading", "packing", "u_box"]);

const results = parseMarketResultsHtml(`
  <section><h2>Northwoods Moving and Junk Removing</h2><p>Price quote: $500</p><p>Overall Rating: 4.9</p>
  <a href="/MovingHelp/Wausau-WI-54402/1/Northwoods/?id=404EEC12FC5143">Northwoods Moving and Junk Removing</a></section>
  <section><h2>Other Moving Crew</h2><p>Price quote: $420</p>
  <a href="/MovingHelp/Wausau-WI-54402/1/Other/?id=PROVIDER2">Other Moving Crew</a></section>
`, "https://www.uhaul.com/MovingHelp/Wausau-WI-54402/1/Results/");
assert.equal(results.length, 2);
assert.equal(results[0].isNorthwoods, true);
assert.equal(results[0].listingRank, 1);
assert.equal(results[1].listingRank, 2);

assert.equal(assertNorthwoodsOfficialUrl("https://www.uhaul.com/MovingHelp/Test/1/Results/").hostname, "www.uhaul.com");
assert.throws(() => assertNorthwoodsOfficialUrl("http://www.uhaul.com/MovingHelp/Test"), /official public/);
assert.throws(() => assertNorthwoodsOfficialUrl("https://example.com/MovingHelp/Test"), /official public/);

console.log("northwoods market scanner tests passed");
