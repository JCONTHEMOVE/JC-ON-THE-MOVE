import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JOB_SCHEDULE_OPTIONS, jobScheduleLabelForStart } from "../../../shared/jcOperations";

assert.equal(jobScheduleLabelForStart("07:00"), "7:00 AM – 8:00 AM");
assert.equal(jobScheduleLabelForStart("16:00"), "4:00 PM – 5:00 PM");
assert.equal(JOB_SCHEDULE_OPTIONS.at(-1)?.label, "Flexible / TBD");

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
assert.match(appSource, /const MultiServiceBookPage = lazy/);
assert.doesNotMatch(appSource, /const InstantBookingPage = lazy/);
assert.doesNotMatch(appSource, /const CustomerBookPage = lazy/);
assert.match(appSource, /<Route path="\/book">\s*<MultiServiceBookPage \/>/);
assert.match(appSource, /<Route path="\/book\/chat">\s*<MultiServiceBookPage \/>/);

const flowSource = readFileSync(resolve(process.cwd(), "client/src/components/MultiBookingFlow.tsx"), "utf8");
assert.match(flowSource, /JOB_SCHEDULE_OPTIONS\.map/);
assert.match(flowSource, /One-hour Central-time arrival windows/);
assert.doesNotMatch(flowSource, /const START_TIME_OPTIONS/);
assert.doesNotMatch(flowSource.slice(
  flowSource.indexOf("function PreferredScheduleFields"),
  flowSource.indexOf("// ── ServiceSelector"),
), /type="time"/);

const bookSource = readFileSync(resolve(process.cwd(), "client/src/pages/book.tsx"), "utf8");
assert.match(bookSource, /workerModeRequested && \["admin", "employee", "business_owner"\]\.includes/);
assert.match(bookSource, /sendConfirmationEmail: isWorker \? workerSendCustomerEmail : true/);
assert.match(bookSource, /Email the customer a request receipt/);
assert.match(bookSource, /Service Request Submitted/);

const routeSource = readFileSync(resolve(process.cwd(), "server/routes/bookings.ts"), "utf8");
assert.match(routeSource, /notifyCustomerBookingRequestReceived/);
assert.match(routeSource, /!isWorkerCreated \|\| body\.sendConfirmationEmail === true/);
assert.match(routeSource, /confirmationEmailSent/);

const emailSource = readFileSync(resolve(process.cwd(), "server/services/email.ts"), "utf8");
assert.match(emailSource, /generateBookingRequestReceipt/);
assert.match(emailSource, /request receipt, not a final price/);
assert.match(emailSource, /escapeEmailHtml/);

console.log("mobile booking experience alignment tests passed");
