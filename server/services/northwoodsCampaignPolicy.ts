export function appendNorthwoodsCampaignFacts(input: {
  text: string;
  destinationUrl: string;
  marketLabel: string;
}) {
  const parts = [input.text.trim()];
  const combined = input.text;
  if (!/Northwoods Moving and Junk Removing/i.test(combined)) {
    parts.push("Northwoods Moving and Junk Removing serves this regional market.");
  }
  if (!/Moving Help powered by U-Haul/i.test(combined)) {
    parts.push("Live pricing and reservations are handled through Moving Help powered by U-Haul.");
  }
  if (!combined.includes(input.destinationUrl)) parts.push(input.destinationUrl);
  return parts.filter(Boolean).join("\n\n");
}

export function validateNorthwoodsCampaignSafety(input: {
  headline: string;
  facebookCaption: string;
  instagramCaption: string;
  googleBusinessSummary: string;
  shortCaption: string;
  destinationUrl: string;
}) {
  const combined = [input.headline, input.facebookCaption, input.instagramCaption, input.googleBusinessSummary, input.shortCaption].join("\n");
  const checks = [
    { key: "brand", label: "Northwoods brand present", ok: /Northwoods Moving and Junk Removing/i.test(combined) },
    { key: "marketplace", label: "Moving Help booking disclosure present", ok: /Moving Help powered by U-Haul/i.test(combined) },
    { key: "url", label: "Tracked Northwoods landing page present", ok: combined.includes(input.destinationUrl) },
    { key: "price", label: "No cached price claim", ok: !/\$\s*\d|\d+\s*%\s*off/i.test(combined) },
    { key: "office", label: "No unsupported local office claim", ok: !/(?:our|the)\s+(?:Ironwood|Iron Mountain|Eagle River|Iron River|Houghton|Wausau)\s+(?:office|storefront|location)/i.test(combined) },
    { key: "length", label: "Channel length limits pass", ok: input.facebookCaption.length <= 2000 && input.instagramCaption.length <= 2000 && input.googleBusinessSummary.length <= 1500 },
  ];
  return { passed: checks.every((check) => check.ok), checks };
}
