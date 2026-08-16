import assert from "node:assert/strict";
import {
  eventTypeForStatus,
  formatJobWebhookBody,
  parseJobEventWebhookUrls,
} from "../jobEventBus";

const discordUrl = "https://discord.com/api/webhooks/test/token";
const slackUrl = "https://hooks.slack.com/services/a/b/c";
assert.deepEqual(parseJobEventWebhookUrls({
  JC_JOB_EVENT_WEBHOOK_URLS: ` ${discordUrl},${slackUrl}`,
  DISCORD_WEBHOOK_URL: discordUrl,
}), [discordUrl, slackUrl], "webhook configuration should trim and deduplicate aliases");

assert.deepEqual(parseJobEventWebhookUrls({
  JC_JOB_EVENT_WEBHOOK_URLS: "not-a-url,ftp://example.com/hook",
}), [], "invalid and non-HTTP webhook targets must be rejected");

assert.equal(eventTypeForStatus("quote_requested"), "quote_requested");
assert.equal(eventTypeForStatus("confirmed"), "job_available");
assert.equal(eventTypeForStatus("assigned"), "crew_assigned");
assert.equal(eventTypeForStatus("completed"), "job_completed");

const discordBody = JSON.parse(formatJobWebhookBody(discordUrl, {
  id: "event-1",
  type: "quote_requested",
  title: "Possible Job Opportunity",
  message: "A moving request is ready for crew-size and quote sampling.",
  source: "booking_request",
  createdAt: "2026-08-15T12:00:00.000Z",
  adminUrl: "https://www.jconthemove.com/lead/job-1",
  lead: {
    id: "job-1",
    orderNumber: 77,
    customerName: "Test Customer",
    customerEmail: "private@example.com",
    customerPhone: "555-555-5555",
    serviceType: "moving",
    moveDate: "2026-08-18",
    status: "quote_requested",
  },
}));

assert.equal(discordBody.username, "JC Job Events");
assert.match(discordBody.content, /^@everyone\n/, "crew-wide job alerts should trigger a Discord notification");
assert.deepEqual(discordBody.allowed_mentions, { parse: ["everyone"] }, "Discord should parse only the controlled everyone mention");
assert.match(discordBody.content, /Possible Job Opportunity/);
assert.equal(discordBody.embeds[0].fields[0].value, "JC-77");
assert.ok(!JSON.stringify(discordBody).includes("private@example.com"), "Discord payload must not expose customer email");
assert.ok(!JSON.stringify(discordBody).includes("555-555-5555"), "Discord payload must not expose customer phone");

const announcementBody = JSON.parse(formatJobWebhookBody(discordUrl, {
  id: "announcement-1",
  type: "crew_announcement",
  title: "Payday Reminder",
  message: "Payday is tomorrow.",
  createdAt: "2026-08-16T12:00:00.000Z",
  lead: {},
}));

assert.match(announcementBody.content, /^@everyone\n/, "crew announcements should notify the shared Discord channel");
assert.deepEqual(announcementBody.allowed_mentions, { parse: ["everyone"] });

const quietUpdateBody = JSON.parse(formatJobWebhookBody(discordUrl, {
  id: "event-2",
  type: "job_updated",
  title: "Job Updated",
  message: "Admin note containing @everyone must not create an alert.",
  createdAt: "2026-08-16T12:00:00.000Z",
  lead: { id: "job-2" },
}));

assert.deepEqual(quietUpdateBody.allowed_mentions, { parse: [] }, "non-alert payloads must suppress embedded mentions");

console.log("job event bus configuration and Discord formatting tests passed");
