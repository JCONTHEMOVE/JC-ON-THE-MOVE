import assert from "node:assert/strict";
import { isAllowedNorthwoodsSender } from "../northwoodsGmailImporter";
import { parseNorthwoodsReservationEmail } from "../northwoodsReservationParser";

const reservation = parseNorthwoodsReservationEmail({
  subject: "New Moving Help Order MH-ABC12345",
  text: `
Moving Help Order: MH-ABC12345
Customer Name: Jamie North
Customer Email: jamie@example.com
Customer Phone: (906) 555-0199
Service Date: 09/12/2026
Start Time: 9:30 AM
Requested Hours: 3
Number of Helpers: 2
Service Address: 101 Main Street, Ironwood, MI 49938
Destination Address: 44 Lake Road, Hurley, WI 54534
Service Details: Load / Unload a 20 foot truck
Order Total: $560.00
`,
});

assert.equal(reservation.externalOrderId, "MH-ABC12345");
assert.equal(reservation.customerFirstName, "Jamie");
assert.equal(reservation.customerLastName, "North");
assert.equal(reservation.serviceDate, "2026-09-12");
assert.equal(reservation.startTime, "09:30");
assert.equal(reservation.durationHours, 3);
assert.equal(reservation.crewSize, 2);
assert.equal(reservation.marketSlug, "ironwood");
assert.equal(reservation.focus, "loading");
assert.equal(reservation.quotedAmountCents, 56000);
assert.deepEqual(reservation.missingFields, []);

const cancellation = parseNorthwoodsReservationEmail({
  subject: "Moving Help reservation cancelled — MH-ABC12345",
  html: "<p>Order ID: MH-ABC12345</p><p>This reservation has been cancelled.</p>",
});
assert.equal(cancellation.emailKind, "cancel");
assert.equal(cancellation.externalOrderId, "MH-ABC12345");
assert.ok(cancellation.missingFields.length > 0, "an incomplete cancellation remains reviewable");

const htmlReservation = parseNorthwoodsReservationEmail({
  subject: "Updated U-Haul reservation UHM-992211",
  html: `
    <div>Order Number: UHM-992211</div>
    <div>Contact Name: Morgan Crew</div>
    <div>Email Address: morgan@example.com</div>
    <div>Phone Number: 906-555-0188</div>
    <div>Move Date: 2026-10-03</div>
    <div>Arrival Time: 1 PM</div>
    <div>Duration: 2.5 hours</div>
    <div>Helpers: 3</div>
    <div>Pickup Address: 25 Lake St, Iron Mountain, MI 49801</div>
    <div>Move Details: Unload one U-Box container</div>
  `,
});
assert.equal(htmlReservation.emailKind, "update");
assert.equal(htmlReservation.focus, "u_box");
assert.equal(htmlReservation.marketSlug, "iron-mountain");
assert.equal(htmlReservation.startTime, "13:00");
assert.equal(htmlReservation.durationHours, 2.5);

assert.equal(isAllowedNorthwoodsSender("Moving Help <orders@movinghelp.com>"), true);
assert.equal(isAllowedNorthwoodsSender("U-Haul <notify@alerts.uhaul.com>"), true);
assert.equal(isAllowedNorthwoodsSender("Not U-Haul <attacker@example.com>"), false);

console.log("northwoods reservation parser tests passed");
