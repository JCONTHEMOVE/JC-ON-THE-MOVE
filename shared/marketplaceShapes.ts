export type MarketplaceSideId = "customer" | "worker" | "company";

export type MarketplaceRequestShapeId =
  | "fast_quote"
  | "moving_help"
  | "delivery_reuse"
  | "repeat_loop";

export type MarketplaceRequestShape = {
  id: MarketplaceRequestShapeId;
  shape: string;
  references: string;
  customer: string;
  worker: string;
  company: string;
  pricingServices: string[];
};

export type MarketplaceSimpleSide = {
  id: MarketplaceSideId;
  side: string;
  tabs: string;
  tasks: string;
  options: string;
};

export type MarketplaceZoneServiceOption = {
  code: string;
  label: string;
  shapeId: MarketplaceRequestShapeId;
  defaultCrewSize: number;
  defaultHours: number;
  customerPrompt: string;
  workerReality: string;
  companyReality: string;
};

export type MarketplaceFunctionalIdeaStatus = "live" | "in_progress" | "next";

export type MarketplaceFunctionalIdea = {
  reference: string;
  pattern: string;
  jcMove: string;
  customerReality: string;
  workerReality: string;
  companyReality: string;
  surface: string;
  status: MarketplaceFunctionalIdeaStatus;
  shapeIds: MarketplaceRequestShapeId[];
};

export type MarketplaceReferenceBlueprint = {
  reference: string;
  borrow: string;
  avoid: string;
  jcSurface: string;
  customerWin: string;
  workerWin: string;
  companyWin: string;
  nextBuild: string;
  metric: string;
};

export type MarketplaceFlywheelStageId =
  | "attract"
  | "capture"
  | "size"
  | "quote"
  | "dispatch"
  | "complete"
  | "collect"
  | "retain";

export type MarketplaceFlywheelStage = {
  id: MarketplaceFlywheelStageId;
  label: string;
  references: string;
  objective: string;
  customerAction: string;
  workerAction: string;
  companyAction: string;
  automation: string;
  proof: string;
  rewardClose: string;
  primarySurface: string;
  sourceOfTruth: string;
};

export type MarketplaceSourceFlow = {
  id: string;
  source: string;
  category: string;
  borrowedSignal: string;
  start: string;
  progress: string;
  finish: string;
  customerMove: string;
  workerMove: string;
  companyControl: string;
  automationHook: string;
  surfaces: string;
  rewardTrigger: string;
  status: MarketplaceFunctionalIdeaStatus;
  shapeIds: MarketplaceRequestShapeId[];
  flywheelStages: MarketplaceFlywheelStageId[];
};

export type MarketplaceActionPhase = "start" | "progress" | "finish";

export type MarketplaceActionRail =
  | "customer"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

export type MarketplaceActionTask = {
  id: string;
  phase: MarketplaceActionPhase;
  rail: MarketplaceActionRail;
  side: MarketplaceSideId;
  title: string;
  action: string;
  proof: string;
  bonusJcMoves: number;
  customerImpact: string;
  companyGuardrail: string;
  sourcePatterns: string;
  flowIds: string[];
  shapeIds: MarketplaceRequestShapeId[];
};

export type MarketplaceSourceReadinessLevel = "ready" | "watch" | "build";

export type MarketplaceSourceOperationalReadiness = {
  sourceFlowId: string;
  ownerRail: MarketplaceActionRail;
  readiness: MarketplaceSourceReadinessLevel;
  launchQuestion: string;
  nextAction: string;
  publishProof: string;
  automationGate: string;
  rewardClose: string;
};

export type MarketplaceLaunchTask = {
  id: string;
  sourceFlowId: string;
  source: string;
  category: string;
  phase: MarketplaceActionPhase;
  ownerRail: MarketplaceActionRail;
  readiness: MarketplaceSourceReadinessLevel;
  title: string;
  launchQuestion: string;
  action: string;
  acceptanceCriteria: string;
  automationGate: string;
  rewardClose: string;
  linkedActionTaskIds: string[];
  totalMappedBonusJcMoves: number;
  completionBonusJcMoves: number;
  surfaces: string;
  shapeIds: MarketplaceRequestShapeId[];
  flywheelStages: MarketplaceFlywheelStageId[];
};

export type MarketplaceSmartBookingStepId =
  | "where_when"
  | "job_shape"
  | "truck_context"
  | "smart_package"
  | "detail_capture"
  | "contact_recovery";

export type MarketplaceSmartBookingStep = {
  id: MarketplaceSmartBookingStepId;
  order: number;
  label: string;
  prompt: string;
  quickOptions: string[];
  captures: string[];
  autoInterpretation: string;
  customerPromise: string;
  workerSignal: string;
  companyControl: string;
  sourcePatterns: string;
  shapeIds: MarketplaceRequestShapeId[];
};

export type MarketplaceLaunchSourceTargetGroup =
  | "retail"
  | "moving"
  | "trust"
  | "growth"
  | "payments";

export type MarketplaceLaunchSourceTarget = {
  label: string;
  aliases: string[];
  group: MarketplaceLaunchSourceTargetGroup;
  blueprintReferences: string[];
};

export const MARKETPLACE_LAUNCH_SOURCE_TARGETS: MarketplaceLaunchSourceTarget[] = [
  {
    label: "Target",
    aliases: ["target"],
    group: "retail",
    blueprintReferences: ["Target"],
  },
  {
    label: "Walmart",
    aliases: ["walmart"],
    group: "retail",
    blueprintReferences: ["Walmart"],
  },
  {
    label: "Goodwill",
    aliases: ["goodwill", "donation", "reuse"],
    group: "retail",
    blueprintReferences: ["Goodwill"],
  },
  {
    label: "McDonald's",
    aliases: ["mcdonalds", "mc donalds", "mcdonald", "menu"],
    group: "growth",
    blueprintReferences: ["McDonald's"],
  },
  {
    label: "Two Men and a Truck",
    aliases: ["2men and a truck", "two men and a truck", "two men", "two_men"],
    group: "moving",
    blueprintReferences: ["Two Men and a Truck"],
  },
  {
    label: "U-Haul",
    aliases: ["uhaul", "u-haul"],
    group: "moving",
    blueprintReferences: ["U-Haul"],
  },
  {
    label: "MovingHelp / MovingHelper",
    aliases: ["movinghelp.com", "movinghelper.com", "movinghelp", "movinghelper", "moving helper"],
    group: "moving",
    blueprintReferences: ["MovingHelp / MovingHelper"],
  },
  {
    label: "Porch Moving Group",
    aliases: ["porch moving group", "porch"],
    group: "moving",
    blueprintReferences: ["Porch Moving Group"],
  },
  {
    label: "HireAHelper",
    aliases: ["hire-a-helper", "hireahelper", "hire a helper"],
    group: "moving",
    blueprintReferences: ["HireAHelper"],
  },
  {
    label: "Yelp",
    aliases: ["yelp"],
    group: "trust",
    blueprintReferences: ["Yelp"],
  },
  {
    label: "Google",
    aliases: ["google"],
    group: "trust",
    blueprintReferences: ["Google"],
  },
  {
    label: "Facebook",
    aliases: ["facebook"],
    group: "trust",
    blueprintReferences: ["Facebook"],
  },
  {
    label: "Craigslist",
    aliases: ["craigslist", "classified"],
    group: "trust",
    blueprintReferences: ["Craigslist"],
  },
  {
    label: "PODS",
    aliases: ["pods", "pod"],
    group: "moving",
    blueprintReferences: ["PODS / U-Box"],
  },
  {
    label: "U-Box",
    aliases: ["u-box", "ubox", "u_box"],
    group: "moving",
    blueprintReferences: ["PODS / U-Box"],
  },
  {
    label: "Square",
    aliases: ["square", "invoice", "payment"],
    group: "payments",
    blueprintReferences: ["Square"],
  },
  {
    label: "Discord / Solbot",
    aliases: ["discord", "solbot", "solbot webhook", "webhook"],
    group: "growth",
    blueprintReferences: ["Discord + Solbot Webhooks"],
  },
  {
    label: "JCMOVES Crypto",
    aliases: ["jcmoves", "crypto"],
    group: "growth",
    blueprintReferences: ["JCMOVES Crypto"],
  },
  {
    label: "Generosity Fund",
    aliases: ["generosity", "giveback", "mom", "nominee"],
    group: "growth",
    blueprintReferences: ["Generosity Fund"],
  },
];

export const MARKETPLACE_REQUEST_SHAPES: MarketplaceRequestShape[] = [
  {
    id: "fast_quote",
    shape: "Quick Quote",
    references: "Website, Google, Facebook, local posts",
    customer: "ZIP/date, service, contact, notes, optional photos.",
    worker: "Crew sees enough context to help size the request or route it to quote review.",
    company: "Owner alert, funnel tracking, quote_requested lead card, and quote safety checks.",
    pricingServices: [],
  },
  {
    id: "moving_help",
    shape: "Moving Help",
    references: "U-Haul, MovingHelp, MovingHelper, HireAHelper",
    customer: "Load, unload, or both; truck provider; truck size; crew package.",
    worker: "Available job or assigned job with calendar and dispatch steps.",
    company: "Zone rate, minimum hours, Square link, crew payout preview.",
    pricingServices: ["load_unload", "pack_unpack", "ubox"],
  },
  {
    id: "delivery_reuse",
    shape: "Delivery / Small Project",
    references: "Single items, store pickups, furniture, appliances",
    customer: "Pickup, drop-off, item size, photos, timing window, and small-project notes.",
    worker: "Driver/helper task with route, item details, access notes, and completion proof.",
    company: "Travel variables, item handling, route bundling, and small-project lead tracking.",
    pricingServices: ["delivery"],
  },
  {
    id: "repeat_loop",
    shape: "Repeat Loop Jobs",
    references: "Lawn, snow, junk, handyman",
    customer: "Choose repeatable work like lawn care, snow, junk removal, handyman, cleaning, or seasonal help.",
    worker: "Crew sees a route-ready repeat job with service type, address, timing, and proof expectations.",
    company: "Track recurring demand, route density, job counts, margins, and rebooking performance.",
    pricingServices: [],
  },
];

export const MARKETPLACE_FUNCTIONAL_IDEAS: MarketplaceFunctionalIdea[] = [
  {
    reference: "Target + Walmart",
    pattern: "Catalog cards, add-ons, pickup/delivery windows, and simple item choices.",
    jcMove: "Turn services into quick cards with common packages, add-ons, photos, and tracked booking links.",
    customerReality: "Pick the closest service in under a minute, then add address/date and photos.",
    workerReality: "See a clear task type, route, crew need, and add-on handling notes.",
    companyReality: "Bundle work, route nearby stops, and keep pricing snapshots attached to the lead.",
    surface: "Book, Services, Admin Pricing",
    status: "in_progress",
    shapeIds: ["fast_quote", "delivery_reuse"],
  },
  {
    reference: "Goodwill",
    pattern: "Donation, reuse, removal, and visible before/after item flow.",
    jcMove: "Let removal and delivery leads tag items as donate, dispose, deliver, store, or reuse.",
    customerReality: "Upload photos and choose what should happen to each item.",
    workerReality: "Know whether the item is trash, donation, delivery, or special handling before arrival.",
    companyReality: "Create reuse partnerships, donation proof, and clean revenue categories.",
    surface: "Quick Request, Job Detail, Completion Proof",
    status: "next",
    shapeIds: ["delivery_reuse", "fast_quote"],
  },
  {
    reference: "McDonald's",
    pattern: "Fast menu, predictable packages, repeatable local offer.",
    jcMove: "Use simple packages like 2 movers / 3 hours and 3 movers / 2 hours as default buttons.",
    customerReality: "Choose a familiar package without learning the whole pricing system.",
    workerReality: "See standard crew/hour expectations and fewer vague job cards.",
    companyReality: "Quote faster, compare margins, and train Gold/Silver workers on consistent options.",
    surface: "Smart Booking, Quote Consensus, Pricing",
    status: "live",
    shapeIds: ["moving_help", "repeat_loop"],
  },
  {
    reference: "Two Men and a Truck",
    pattern: "Professional moving crew, arrival window, assigned team, completion confirmation.",
    jcMove: "Move lead cards through quoted, available, assigned, in progress, completed, paid.",
    customerReality: "Know the crew is assigned and the job is confirmed.",
    workerReality: "Accept, navigate, start, complete, and upload proof from the crew app.",
    companyReality: "Calendar, dispatch, payout safety, and review requests stay tied to one card.",
    surface: "Ops Board, Dispatch, Crew Jobs",
    status: "in_progress",
    shapeIds: ["moving_help"],
  },
  {
    reference: "U-Haul + MovingHelp + MovingHelper",
    pattern: "Load/unload choices, truck provider, truck size, helper count, hourly minimums.",
    jcMove: "Ask zip/date first, then load/unload/both, truck source, truck size, crew count, hours.",
    customerReality: "Get an estimate range without a phone call for common moving-help jobs.",
    workerReality: "Know whether the customer has the truck and what size crew is expected.",
    companyReality: "Zone rates, minimums, discount thresholds, and travel fees drive the quote snapshot.",
    surface: "Book, Zone Pricing, Lead Quote Dialog",
    status: "in_progress",
    shapeIds: ["moving_help"],
  },
  {
    reference: "Porch Moving Group + HireAHelper",
    pattern: "Marketplace availability, price comparison, service area fit, and quote confidence.",
    jcMove: "Use Bronze/Silver/Gold quote sampling so multiple matching picks can raise confidence before approval.",
    customerReality: "Request does not die while waiting for one person to price it.",
    workerReality: "Marketers can sample quote options and earn JCMOVES for useful answers.",
    companyReality: "Gold/Platinum approval protects pricing while speeding up response time.",
    surface: "Authority Tasks, Pending Quotes, Ops Board",
    status: "live",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    reference: "Yelp + Google",
    pattern: "Local trust, reviews, address search, map intent, and quick contact.",
    jcMove: "Pair address autocomplete and review signals with a request flow that captures abandoned attempts.",
    customerReality: "Find the address quickly and trust the company before submitting.",
    workerReality: "Use reviews and job photos as marketing assets after completion.",
    companyReality: "Track funnel drop-offs, errors, review requests, and local search attribution.",
    surface: "Book, Booking Funnel, Reviews",
    status: "in_progress",
    shapeIds: ["fast_quote", "repeat_loop"],
  },
  {
    reference: "Facebook + Craigslist",
    pattern: "Local demand, quick comments/messages, photos, last-minute jobs, rep links.",
    jcMove: "Crew ad creator generates posts, follow-up text, tracked links, and campaign attribution.",
    customerReality: "Click from a local post and land directly in a simple request path.",
    workerReality: "Post for a couple minutes, copy follow-up, and let the link track the lead.",
    companyReality: "See campaign performance, requests, cards, errors, and rep credit.",
    surface: "Crew Earnings, Marketing Webhooks, Funnel",
    status: "live",
    shapeIds: ["fast_quote", "repeat_loop"],
  },
  {
    reference: "PODS + U-Box",
    pattern: "Container delivery, load/unload, box count, mileage, site access.",
    jcMove: "Add U-Box-style service rows with delivery only, load/unload only, or both.",
    customerReality: "Explain the container job without forcing it into a normal house move.",
    workerReality: "Know container count, site access, and whether delivery or labor is needed.",
    companyReality: "Price box fees, mileage, labor minimums, and quote review cards cleanly.",
    surface: "Zone Pricing, Book, Job Detail",
    status: "next",
    shapeIds: ["moving_help", "delivery_reuse"],
  },
  {
    reference: "Square",
    pattern: "Payment links, invoices, deposits, receipts, and collect-anywhere billing.",
    jcMove: "Prepare a Square payment link after quote approval so any approved worker can collect payment.",
    customerReality: "Pay from a trusted link after staff confirms final pricing.",
    workerReality: "Collect payment without handling private card data.",
    companyReality: "Cash payout records and invoice status protect profit and payout timing.",
    surface: "Finance, Job Detail, Payment Status",
    status: "in_progress",
    shapeIds: ["moving_help", "fast_quote"],
  },
  {
    reference: "Discord + Solbot-style webhooks",
    pattern: "Event bus, reminders, ops alerts, marketing posts, crew broadcasts.",
    jcMove: "Send job lifecycle and marketing events to Discord/webhooks while keeping leads as source of truth.",
    customerReality: "Faster response because the right people are alerted.",
    workerReality: "Only relevant crew get assignment updates after the job is claimed.",
    companyReality: "Owner sees new requests, crew sees available jobs, completion triggers payout flow.",
    surface: "Job Event Bus, Notifications, Marketing Webhooks",
    status: "live",
    shapeIds: ["fast_quote", "repeat_loop"],
  },
  {
    reference: "JCMOVES Crypto",
    pattern: "Rewards, streaks, task bonuses, referral credit, repeat engagement.",
    jcMove: "Issue JCMOVES for useful marketing, quote sampling, completion, review, and repeat booking loops.",
    customerReality: "Earn credits and discounts without making booking complicated.",
    workerReality: "Earn extra JCMOVES for work that helps the marketplace move.",
    companyReality: "Tie rewards to verified actions so bonuses do not outrun real revenue.",
    surface: "Rewards, Authority Tasks, Payout Engine",
    status: "live",
    shapeIds: ["repeat_loop"],
  },
  {
    reference: "Generosity Fund",
    pattern: "A mission-backed giveback rail that grows from verified JCMOVES activity.",
    jcMove: "Keep Mom's fund, nominee pools, and customer/worker giving tied to real wallet events and proof.",
    customerReality: "Can earn, redeem, or send JCMOVES love without learning crypto mechanics.",
    workerReality: "Sees that useful work can support bonuses, family funds, and team morale.",
    companyReality: "Tracks giveback liability separately from payout, discounts, and operating profit.",
    surface: "Wallet, Rewards, Generosity Fund, Admin Playbook",
    status: "live",
    shapeIds: ["repeat_loop"],
  },
];

export const MARKETPLACE_REFERENCE_BLUEPRINTS: MarketplaceReferenceBlueprint[] = [
  {
    reference: "Target",
    borrow: "Clean category cards, add-ons, pickup windows, and a calm checkout feel.",
    avoid: "Too many retail-style choices before the customer has told us the job shape.",
    jcSurface: "Services, Book, Customer Portal",
    customerWin: "Feels organized and familiar when choosing help.",
    workerWin: "Gets service category, add-ons, and timing without guessing.",
    companyWin: "Can bundle local delivery, reuse, and labor into repeatable offers.",
    nextBuild: "Service cards with photo-backed add-ons and one recommended package.",
    metric: "Package selection rate",
  },
  {
    reference: "Walmart",
    borrow: "Everyday practical pricing, delivery/pickup logic, and broad local coverage.",
    avoid: "Race-to-bottom pricing that breaks travel, labor, and payout math.",
    jcSurface: "Zone Pricing, Quote Preview, Dispatch",
    customerWin: "Gets a practical range fast, even outside the core town.",
    workerWin: "Knows travel and truck expectations before accepting.",
    companyWin: "Can cover more areas when the zone price reflects distance.",
    nextBuild: "Map-based zone editor with radius/polygon preview and travel variables.",
    metric: "Out-of-zone quote conversion",
  },
  {
    reference: "Goodwill",
    borrow: "Reuse, donation, item disposition, and proof that stuff went somewhere useful.",
    avoid: "Treating every removal as trash when it could become donation, resale, or delivery.",
    jcSurface: "Quick Request, Job Detail, Completion Proof",
    customerWin: "Can say donate, dispose, store, or deliver with photos.",
    workerWin: "Knows item destiny before loading.",
    companyWin: "Creates reuse partnerships and cleaner job categories.",
    nextBuild: "Per-item tags: donate, dispose, deliver, store, reuse.",
    metric: "Reuse-tagged jobs",
  },
  {
    reference: "McDonald's",
    borrow: "Simple menu, predictable packages, fast repeat choices.",
    avoid: "Hiding all pricing behind custom work when common jobs are predictable.",
    jcSurface: "Smart Booking, Pricing, Quote Consensus",
    customerWin: "Picks 2 movers / 3 hours or 3 movers / 2 hours quickly.",
    workerWin: "Sees a standard crew/hour expectation.",
    companyWin: "Quotes faster and compares margin across repeated packages.",
    nextBuild: "Default package buttons tied to zone rates and minimums.",
    metric: "Under-60-second quote starts",
  },
  {
    reference: "Two Men and a Truck",
    borrow: "Professional crew assignment, arrival windows, and completed-job confirmation.",
    avoid: "Letting the calendar fill with unconfirmed quote clutter.",
    jcSurface: "Ops Board, Dispatch, Crew Jobs, Schedule",
    customerWin: "Sees when the job is actually confirmed.",
    workerWin: "Gets assigned job details, route, start, and completion flow.",
    companyWin: "Tracks status from quote to paid without losing the card.",
    nextBuild: "White-to-green calendar status and dismissible ops notifications.",
    metric: "Confirmed jobs completed on schedule",
  },
  {
    reference: "U-Haul",
    borrow: "Truck size, load/unload, customer truck vs provider truck, and time windows.",
    avoid: "Forcing truck/container jobs through a generic moving form.",
    jcSurface: "Book, Lead Quote Dialog, Zone Pricing",
    customerWin: "Explains the move in the same language they already know.",
    workerWin: "Knows truck size and access details.",
    companyWin: "Can price truck, travel, and labor separately.",
    nextBuild: "Truck-size prompts that auto-suggest crew and hours.",
    metric: "Truck-size completion rate",
  },
  {
    reference: "MovingHelp / MovingHelper",
    borrow: "Hourly helper rates by crew size, minimums, and discounts after longer bookings.",
    avoid: "Final hard pricing before staff confirms risk, access, and travel.",
    jcSurface: "Zone Rates, Quote Preview, Lead Quote Dialog",
    customerWin: "Gets a credible estimate range before commitment.",
    workerWin: "Sees helper count and expected hours.",
    companyWin: "Keeps rates adjustable by zone while freezing old quote snapshots.",
    nextBuild: "Rate rows per service, crew size, minimum hours, and discount threshold.",
    metric: "Quote approval time",
  },
  {
    reference: "Porch Moving Group",
    borrow: "Marketplace routing, service fit, and fast lead handling.",
    avoid: "Selling the lead to nowhere or making ownership unclear.",
    jcSurface: "Ops Board, Authority Tasks, Notifications",
    customerWin: "Request reaches people who can act.",
    workerWin: "Can help classify or quote without owning final risk.",
    companyWin: "Uses Bronze/Silver/Gold/Platinum rails to speed response safely.",
    nextBuild: "Consensus quote queue where matching samples raise confidence.",
    metric: "Time to first useful quote action",
  },
  {
    reference: "HireAHelper",
    borrow: "Price comparison, availability confidence, and service-area matching.",
    avoid: "Letting customer comparison turn into unmanaged low-bid chaos.",
    jcSurface: "Quote Consensus, Zone Pricing, Crew Availability",
    customerWin: "Gets a range and availability signal quickly.",
    workerWin: "Can choose from clear available cards.",
    companyWin: "Balances speed with Gold/Platinum approval gates.",
    nextBuild: "Availability-aware quote confidence badges.",
    metric: "Available-to-assigned conversion",
  },
  {
    reference: "Yelp",
    borrow: "Reviews, local trust, photos, and quick contact intent.",
    avoid: "Untracked messages that never become lead cards.",
    jcSurface: "Reviews, Funnel, Marketing Webhooks",
    customerWin: "Trusts the crew before entering contact info.",
    workerWin: "Can use real review/photo assets in local posts.",
    companyWin: "Sees review-driven traffic and request recovery.",
    nextBuild: "Review/photo picker for ad creation.",
    metric: "Review-attributed requests",
  },
  {
    reference: "Google",
    borrow: "Address autocomplete, local search intent, maps, and fast answers.",
    avoid: "Manual address typing that slows booking and creates bad travel math.",
    jcSurface: "Book, Zone Map, Booking Funnel",
    customerWin: "Finds address in seconds.",
    workerWin: "Gets cleaner route and access info.",
    companyWin: "Uses better address data for zone, travel, and dispatch.",
    nextBuild: "Address autocomplete everywhere a job can be created.",
    metric: "Address resolved rate",
  },
  {
    reference: "Facebook",
    borrow: "Local groups, comments, Messenger follow-up, photos, and last-minute demand.",
    avoid: "Posting without a tracked link or follow-up path.",
    jcSurface: "Crew Earn / Ads, Marketing Webhooks, Funnel",
    customerWin: "Clicks a post and lands in a simple request path.",
    workerWin: "Creates ad kit and earns JCMOVES for useful campaigns.",
    companyWin: "Tracks which posts turn into cards.",
    nextBuild: "Campaign scoreboard plus saved ad templates by area/focus.",
    metric: "Campaign-attributed cards",
  },
  {
    reference: "Craigslist",
    borrow: "Simple classified demand and direct local service offers.",
    avoid: "Anonymous, unqualified back-and-forth with no quote card.",
    jcSurface: "Ad Creator, Quick Request, Funnel Recovery",
    customerWin: "Gets a simple link instead of a vague reply thread.",
    workerWin: "Can paste a short ad and fast reply.",
    companyWin: "Turns classified traffic into tracked quote_requested cards.",
    nextBuild: "Craigslist-safe short-copy mode in the ad builder.",
    metric: "Classified link starts",
  },
  {
    reference: "PODS / U-Box",
    borrow: "Container count, delivery vs load/unload, mileage, and site access.",
    avoid: "Pricing container jobs like regular house moves.",
    jcSurface: "Book, Zone Pricing, Job Detail",
    customerWin: "Describes box/container work clearly.",
    workerWin: "Sees box count and site constraints.",
    companyWin: "Prices mileage, box fees, and labor with a snapshot.",
    nextBuild: "U-Box-style service rows and container-specific intake.",
    metric: "Container quote accuracy",
  },
  {
    reference: "Square",
    borrow: "Payment links, invoices, deposits, receipts, and collect-anywhere trust.",
    avoid: "Letting workers handle private card data or payout before payment safety checks.",
    jcSurface: "Finance, Job Detail, Payment Status",
    customerWin: "Pays through a trusted link.",
    workerWin: "Can collect with a link, not a card number.",
    companyWin: "Keeps invoice, deposit, payout, and profit states aligned.",
    nextBuild: "One-click Square invoice/link from approved quote.",
    metric: "Approved quote to paid time",
  },
  {
    reference: "Discord + Solbot Webhooks",
    borrow: "Webhook-style event delivery, channel reminders, crew broadcasts, and marketing nudges.",
    avoid: "Blasting raw customer requests to everyone forever or treating Discord as the source of truth.",
    jcSurface: "Notifications, Marketing Webhooks, Crew Jobs",
    customerWin: "Gets faster response because requests reach the right operators.",
    workerWin: "Receives relevant available-job, assignment, reminder, and marketing prompts.",
    companyWin: "Keeps leads as the source of truth while mirroring lifecycle events to useful channels.",
    nextBuild: "Event rules that route new requests to admin, available jobs to eligible crew, assignments to assigned crew, and marketing reminders by area.",
    metric: "Useful event-to-action rate",
  },
  {
    reference: "JCMOVES Crypto",
    borrow: "Rewards, streaks, referrals, task bonuses, and repeat engagement.",
    avoid: "Issuing rewards without verified value or completed work.",
    jcSurface: "Rewards, Authority Tasks, Payout Engine",
    customerWin: "Gets useful credits without booking becoming complicated.",
    workerWin: "Earns for marketing, quote help, completion, and reviews.",
    companyWin: "Rewards behavior that creates or completes real work.",
    nextBuild: "Task completion ledger with bonus JCMOVES by tier.",
    metric: "Verified reward actions",
  },
  {
    reference: "Generosity Fund",
    borrow: "Visible giveback, family/community support, and repeat goodwill tied to real transactions.",
    avoid: "Mixing donations, reward liability, and worker payout math in one unclear bucket.",
    jcSurface: "Wallet, Generosity Fund, Admin Playbook",
    customerWin: "Can send JCMOVES love or see that completed jobs support something real.",
    workerWin: "Understands how verified marketplace work can also support team and family funds.",
    companyWin: "Separates generosity, nominee pools, rewards, discounts, and operating profit cleanly.",
    nextBuild: "Simple admin panel for Mom fund, nominee balances, and verified giveback events.",
    metric: "Verified giveback events",
  },
];

export const MARKETPLACE_SOURCE_FLOW_MATRIX: MarketplaceSourceFlow[] = [
  {
    id: "target_walmart_catalog",
    source: "Target + Walmart",
    category: "Retail catalog / delivery ops",
    borrowedSignal: "Fast category choice, add-ons, delivery windows, practical price expectations.",
    start: "Customer chooses a simple service card or package instead of describing everything from scratch.",
    progress: "Lead stores item/service choices, address, date, photos, route notes, and quote snapshot.",
    finish: "Completion can recommend related add-ons, repeat service, review, or JCMOVES credit.",
    customerMove: "Pick the closest package, add photos/details, get a range.",
    workerMove: "See service type, route, handling notes, and add-ons before accepting.",
    companyControl: "Bundle nearby work, protect margins, and freeze the quoted snapshot on the lead.",
    automationHook: "Smart package defaults plus address/zone quote preview.",
    surfaces: "Book, Services, Pricing, Jobs",
    rewardTrigger: "Marketing or add-on task credit only when the card is created or converted.",
    status: "in_progress",
    shapeIds: ["fast_quote", "delivery_reuse"],
    flywheelStages: ["capture", "size", "retain"],
  },
  {
    id: "goodwill_reuse",
    source: "Goodwill",
    category: "Reuse / donation / removal",
    borrowedSignal: "Items have a destiny: donate, dispose, deliver, store, reuse.",
    start: "Customer uploads photos and tags what should happen to each item.",
    progress: "Worker sees item destiny, access notes, and proof requirements.",
    finish: "Completion proof feeds donation/reuse notes and follow-up offers.",
    customerMove: "Say what stays useful and what leaves.",
    workerMove: "Handle items correctly without guessing at the curb.",
    companyControl: "Separate revenue categories, reuse partners, disposal costs, and proof.",
    automationHook: "Photo/item tags on quick requests and job completion proof.",
    surfaces: "Quick Request, Job Detail, Completion Proof",
    rewardTrigger: "Bonus JCMOVES for verified reuse/donation proof when enabled.",
    status: "next",
    shapeIds: ["delivery_reuse", "fast_quote"],
    flywheelStages: ["capture", "complete", "retain"],
  },
  {
    id: "mcdonalds_menu",
    source: "McDonald's",
    category: "Simple menu / repeat habit",
    borrowedSignal: "Predictable packages make decisions fast.",
    start: "Customer sees common choices like 2 movers / 3 hours or 3 movers / 2 hours.",
    progress: "Smart sizing adjusts crew, hours, truck size, and zone travel.",
    finish: "Repeat shortcut offers the same package again with current date/address.",
    customerMove: "Answer one question at a time and accept the closest package.",
    workerMove: "Receive standard crew/hour expectations with fewer vague cards.",
    companyControl: "Train quote helpers on repeatable packages and margin comparisons.",
    automationHook: "Smart Booking Engine package recommendation.",
    surfaces: "Book, Quote Consensus, Pricing",
    rewardTrigger: "Quote-sampling JCMOVES only for matching, useful guided picks.",
    status: "live",
    shapeIds: ["moving_help", "repeat_loop"],
    flywheelStages: ["size", "quote", "retain"],
  },
  {
    id: "two_men_ops",
    source: "Two Men and a Truck",
    category: "Professional moving operations",
    borrowedSignal: "Confirmed crew, arrival window, calendar clarity, completion confirmation.",
    start: "Admin converts a quote card into scheduled/available/assigned work.",
    progress: "Assigned crew gets route, start, completion, proof, and update notifications.",
    finish: "Completed job turns calendar marker green and unlocks payout/review flow.",
    customerMove: "See that the job is confirmed, assigned, and moving.",
    workerMove: "Accept, navigate, start, complete, upload proof.",
    companyControl: "Keep status, crew, calendar, payout, and review tied to the lead card.",
    automationHook: "Job lifecycle event bus and assignment notifications.",
    surfaces: "Ops Board, Dispatch, Crew Jobs, Schedule",
    rewardTrigger: "Completion JCMOVES only after verified completion event.",
    status: "in_progress",
    shapeIds: ["moving_help"],
    flywheelStages: ["dispatch", "complete", "collect"],
  },
  {
    id: "uhaul_movinghelp",
    source: "U-Haul + MovingHelp + MovingHelper",
    category: "Moving helper marketplace",
    borrowedSignal: "Load/unload choice, truck provider, truck size, helper count, hourly minimums.",
    start: "Ask ZIP/date, then load/unload/both, truck source, truck size, and suggested crew package.",
    progress: "Zone rates and minimums produce an estimate range until staff confirms.",
    finish: "Approved quote creates Square link, calendar entry, and crew assignment path.",
    customerMove: "Describe the job in familiar moving-helper language.",
    workerMove: "Know if customer supplies truck, what size, crew count, and expected hours.",
    companyControl: "Manage rates by zone, crew size, minimum hours, discount threshold, and travel.",
    automationHook: "Zone quote preview with quote snapshot stored on the lead.",
    surfaces: "Book, Zone Pricing, Lead Quote Dialog",
    rewardTrigger: "Quote helper bonuses after approved or useful quote actions.",
    status: "in_progress",
    shapeIds: ["moving_help"],
    flywheelStages: ["capture", "size", "quote"],
  },
  {
    id: "porch_hireahelper_consensus",
    source: "Porch Moving Group + HireAHelper",
    category: "Lead marketplace / quote confidence",
    borrowedSignal: "Availability matching, fast lead handling, comparison, and confidence.",
    start: "Bronze/Silver helpers see guided multiple-choice quote tasks when a new request lands.",
    progress: "Matching choices raise confidence; Gold/Platinum approve final price and crew path.",
    finish: "Approved quote moves into available/assigned work without losing the original request.",
    customerMove: "Gets a response quickly instead of waiting on one person.",
    workerMove: "Samples quotes inside guardrails and earns only for useful actions.",
    companyControl: "Approval rails protect pricing, profit, and customer promises.",
    automationHook: "Consensus quote queue with authority-tier gates.",
    surfaces: "Authority Tasks, Pending Quotes, Ops Board",
    rewardTrigger: "Bonus JCMOVES when quote task contributes to approved card.",
    status: "live",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
    flywheelStages: ["quote", "dispatch"],
  },
  {
    id: "google_yelp_trust",
    source: "Google + Yelp",
    category: "Local search / trust",
    borrowedSignal: "Address autocomplete, reviews, photos, map intent, and fast contact.",
    start: "Customer finds the address quickly and lands in a tracked quote path.",
    progress: "Funnel events preserve partial contact/job info if they leave or hit an error.",
    finish: "Completed work requests review and feeds future search/social proof.",
    customerMove: "Trust the company and finish the request in under a minute.",
    workerMove: "Use approved reviews/photos for local ads and rep pages.",
    companyControl: "Track abandoned attempts, errors, review attribution, and recovered cards.",
    automationHook: "Address autocomplete plus booking funnel recovery.",
    surfaces: "Book, Funnel Analytics, Reviews",
    rewardTrigger: "Review/marketing JCMOVES after verified review or campaign usage.",
    status: "in_progress",
    shapeIds: ["fast_quote", "repeat_loop"],
    flywheelStages: ["attract", "capture", "retain"],
  },
  {
    id: "facebook_craigslist_ads",
    source: "Facebook + Craigslist",
    category: "Local demand / classified ads",
    borrowedSignal: "Photos, comments, quick replies, last-minute jobs, and neighborhood trust.",
    start: "Crew creates a simple local post with a tracked request link.",
    progress: "Lead attribution stores campaign, rep, promo, and source on the card.",
    finish: "Converted/completed jobs reward useful marketing and generate next ad proof.",
    customerMove: "Tap from a post into the same simple request path.",
    workerMove: "Post a clean ad, paste a follow-up reply, and watch attributed requests.",
    companyControl: "Approve campaign templates and see what actually turns into work.",
    automationHook: "Ad creator, Discord/webhook reminders, and quote attribution.",
    surfaces: "Crew Earn / Ads, Marketing Webhooks, Funnel",
    rewardTrigger: "Marketing JCMOVES when a campaign creates a recoverable or converted lead.",
    status: "live",
    shapeIds: ["fast_quote", "repeat_loop"],
    flywheelStages: ["attract", "capture", "retain"],
  },
  {
    id: "pods_ubox_containers",
    source: "PODS + U-Box",
    category: "Container logistics",
    borrowedSignal: "Container count, delivery/load/unload split, mileage, access, and box fees.",
    start: "Customer selects container-style work instead of forcing it into a generic move.",
    progress: "Quote uses box count, labor, delivery/mileage, site access, and zone rules.",
    finish: "Completion proof confirms container count/access and invoice status.",
    customerMove: "Explain box/container work clearly.",
    workerMove: "See container count, delivery/labor split, and site constraints.",
    companyControl: "Price mileage, box fees, labor minimums, and travel separately.",
    automationHook: "U-Box-style rate rows and container-specific intake.",
    surfaces: "Book, Zone Pricing, Job Detail",
    rewardTrigger: "Completion JCMOVES only after container job is verified complete.",
    status: "next",
    shapeIds: ["moving_help", "delivery_reuse"],
    flywheelStages: ["size", "quote", "complete"],
  },
  {
    id: "square_collect",
    source: "Square",
    category: "Payment links / invoices",
    borrowedSignal: "Trusted invoice link, deposit, receipt, and collect-anywhere flow.",
    start: "Approved quote prepares a Square invoice or payment link.",
    progress: "Payment/deposit status gates dispatch and payout decisions.",
    finish: "Paid/completed job triggers payout math, profit split, and receipt/review follow-up.",
    customerMove: "Pay through a trusted link after final quote confirmation.",
    workerMove: "Collect with a link without touching private card data.",
    companyControl: "Protect deposits, final payment, company profit, and manual cash payouts.",
    automationHook: "Square invoice link generation after quote approval.",
    surfaces: "Finance, Job Detail, Payment Status",
    rewardTrigger: "Customer spend JCMOVES after payment clears; worker payout bonus after completion approval.",
    status: "in_progress",
    shapeIds: ["moving_help", "fast_quote"],
    flywheelStages: ["quote", "collect"],
  },
  {
    id: "discord_webhooks",
    source: "Discord + Solbot-style webhooks",
    category: "Event bus / reminders",
    borrowedSignal: "Lifecycle alerts, reminders, marketing prompts, and channel visibility.",
    start: "New request alerts owner/admin; available jobs alert eligible crew.",
    progress: "Assigned job updates notify only assigned crew plus admin.",
    finish: "Completed job triggers payout/reward notifications and marketing/review prompts.",
    customerMove: "Gets faster response because internal routing is clean.",
    workerMove: "Receives relevant posts instead of noise.",
    companyControl: "Control who gets raw leads, available jobs, assignments, updates, and completion events.",
    automationHook: "Job event bus with Discord/webhook delivery.",
    surfaces: "Notifications, Marketing Webhooks, Crew Jobs",
    rewardTrigger: "Reminder/task JCMOVES only when the prompted action is completed.",
    status: "live",
    shapeIds: ["fast_quote", "repeat_loop"],
    flywheelStages: ["attract", "dispatch", "complete"],
  },
  {
    id: "jcmoves_rewards",
    source: "JCMOVES Crypto",
    category: "Rewards / loyalty / task economy",
    borrowedSignal: "Credits, streaks, referrals, task bonuses, spend rewards, and repeat loops.",
    start: "Attach eligible reward actions to booking, marketing, quote, and completion tasks.",
    progress: "Workers and customers see simple earning opportunities tied to real operational events.",
    finish: "Verified completion, review, referral, or repeat booking credits the ledger once.",
    customerMove: "Earn useful service credit without booking complexity.",
    workerMove: "Earn extra for useful marketing, quote help, completion, and review support.",
    companyControl: "Prevent rewards from outrunning real revenue by tying them to proof.",
    automationHook: "Idempotent reward ledger by source type/source id.",
    surfaces: "Rewards, Authority Tasks, Payout Engine",
    rewardTrigger: "Verified action only: created lead, useful quote, completed job, review, referral, repeat booking.",
    status: "live",
    shapeIds: ["repeat_loop"],
    flywheelStages: ["complete", "collect", "retain"],
  },
  {
    id: "generosity_fund",
    source: "Generosity Fund",
    category: "Giveback / community trust",
    borrowedSignal: "A visible mission rail turns completed work and wallet activity into goodwill.",
    start: "Customer or worker sees a simple receive/redeem/give option inside the wallet or rewards flow.",
    progress: "Verified wallet credits can contribute to Mom's fund, nominee pools, or approved giveback actions.",
    finish: "Giveback events remain separate from job payout, discounts, and company profit records.",
    customerMove: "Earns, redeems, or sends JCMOVES love from a simple wallet action.",
    workerMove: "Knows useful marketplace work can also support family/community funds.",
    companyControl: "Keeps generosity accounting isolated from payout safety and reward redemption limits.",
    automationHook: "Internal wallets are excluded from circular rewards; giveback credits use verified wallet events.",
    surfaces: "Wallet, Generosity Fund, Rewards, Admin Playbook",
    rewardTrigger: "Giveback JCMOVES only after a verified wallet credit, donation, nominee allocation, or approved task.",
    status: "live",
    shapeIds: ["repeat_loop"],
    flywheelStages: ["collect", "retain"],
  },
];

export const MARKETPLACE_SIMPLE_SIDES: MarketplaceSimpleSide[] = [
  {
    id: "customer",
    side: "Customer",
    tabs: "Jobs, Book, Options",
    tasks: "Request help, track status, pay, review.",
    options: "Home, rewards, wallet, earn, profile.",
  },
  {
    id: "worker",
    side: "Worker",
    tabs: "Tasks, Options",
    tasks: "Accept, navigate, start, complete, advertise.",
    options: "Schedule, reviews, earnings, add job.",
  },
  {
    id: "company",
    side: "Company",
    tabs: "Tasks, Options",
    tasks: "Ops Board, Dispatch, Jobs, Schedule.",
    options: "Pricing, People, Finance, Funnel, Marketing, Launch.",
  },
];

export const MARKETPLACE_OPERATING_FLYWHEEL: MarketplaceFlywheelStage[] = [
  {
    id: "attract",
    label: "Attract",
    references: "Facebook, Craigslist, Yelp, Google, rep links",
    objective: "Bring local intent into one tracked JC doorway instead of scattered messages.",
    customerAction: "Sees a local post, review, search result, or rep page and taps the quote link.",
    workerAction: "Creates a simple ad with photo/text, posts it, and copies the fast follow-up message.",
    companyAction: "Tracks source, campaign, promo code, rep slug, and funnel health.",
    automation: "Crew ad creator generates copy, tracked links, Discord/webhook reminders, and bonus eligibility.",
    proof: "marketing_webhook_campaigns row, booking_funnel_events row, quote_attributions row.",
    rewardClose: "Marketing task JCMOVES for useful tracked campaigns.",
    primarySurface: "Crew Earn / Ads, Marketing Webhooks, Booking Funnel",
    sourceOfTruth: "marketing_webhook_campaigns + quote_attributions",
  },
  {
    id: "capture",
    label: "Capture",
    references: "Google forms, Yelp leads, MovingHelp intake",
    objective: "Turn every request into a recoverable lead card within seconds.",
    customerAction: "Enters ZIP/address, estimated date, service choice, contact, notes, and optional photos.",
    workerAction: "Can enter a request on behalf of a customer from worker mode.",
    companyAction: "Receives owner/admin notification and can recover abandoned attempts.",
    automation: "Booking bridge creates or links a quote_requested lead and records partial funnel snapshots.",
    proof: "Lead card exists with source, quote snapshot, funnel event, photos/media context.",
    rewardClose: "Lead creation and marketing attribution can feed task credit later.",
    primarySurface: "Book, Quick Request, Admin Funnel, Admin Jobs",
    sourceOfTruth: "leads",
  },
  {
    id: "size",
    label: "Size",
    references: "McDonald's menu, Walmart catalog, U-Haul truck sizing",
    objective: "Make job sizing feel like picking the closest package, not filling out a long form.",
    customerAction: "Chooses load/unload/both, truck provider, truck size, and a common crew/hour package.",
    workerAction: "Sees clear crew count, hours, truck/access notes, and job shape.",
    companyAction: "Adjusts package, hours, crew, zone, travel, and special handling before approval.",
    automation: "Smart defaults suggest 2 movers / 3 hours or 3 movers / 2 hours and preserve item/photos detail.",
    proof: "Lead quote snapshot includes service selections, crew, hours, truck, zone preview, and notes.",
    rewardClose: "Quote sampling tasks can reward matching Bronze/Silver/Gold picks.",
    primarySurface: "Smart Booking, Lead Quote Dialog, Authority Tasks",
    sourceOfTruth: "lead.quoteSnapshot",
  },
  {
    id: "quote",
    label: "Quote",
    references: "MovingHelp rates, HireAHelper comparison, PODS/U-Box pricing",
    objective: "Convert rough request detail into a price range and confirmed staff quote.",
    customerAction: "Sees estimate range first and waits for final staff confirmation.",
    workerAction: "Silver can build quote cards; Gold can approve when guided picks match.",
    companyAction: "Sets final price, deposit, Square link, crew pay preview, and company profit guardrails.",
    automation: "Zone rates, hourly minimums, discounts, travel padding, and quote consensus reduce manual work.",
    proof: "Quoted lead has base/total price, quote notes, zone snapshot, approval record, and payment/deposit status.",
    rewardClose: "Quote task JCMOVES only after useful quote work, not loose guesses.",
    primarySurface: "Pricing, Jobs, Quote Review, Finance",
    sourceOfTruth: "leads + quote_approvals + zone snapshots",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    references: "Two Men and a Truck, Porch Moving Group",
    objective: "Move a confirmed card onto calendar and into the right crew hands.",
    customerAction: "Gets confirmation that the crew/date/window is set.",
    workerAction: "Receives only relevant available or assigned job notifications, then accepts/navigates/starts.",
    companyAction: "Assigns crew, resolves leave/availability, and watches calendar coverage.",
    automation: "Job events notify admin, eligible crew, assigned crew, and webhooks by lifecycle stage.",
    proof: "Crew assignment, calendar entry, dispatch timestamp, status transition, notification record.",
    rewardClose: "Accepted assignment prepares payout but does not issue premature payout.",
    primarySurface: "Dispatch, Crew Jobs, Schedule, Ops Board",
    sourceOfTruth: "leads + job_assignments + notifications",
  },
  {
    id: "complete",
    label: "Complete",
    references: "Professional mover workflow, review platforms",
    objective: "Prove the job happened and trigger rewards/payout flow once.",
    customerAction: "Confirms service, receives review/tip follow-up, and can rebook.",
    workerAction: "Completes job, uploads proof/photos/notes, and closes status.",
    companyAction: "Reviews completion, resolves exceptions, and protects payout safety.",
    automation: "Completion event is idempotent so JCMOVES and payout records do not duplicate.",
    proof: "Completed status, completion timestamp, proof notes/photos, payout calculation.",
    rewardClose: "Worker/customer JCMOVES and lottery/review loops attach after verified completion.",
    primarySurface: "Crew Jobs, Job Detail, Reviews, Payouts",
    sourceOfTruth: "leads + job_payout_calculations",
  },
  {
    id: "collect",
    label: "Collect",
    references: "Square invoice links, cash payout records",
    objective: "Make payment collection simple while preserving company profit and crew cash payout math.",
    customerAction: "Pays deposit/final invoice through Square link or approved cash/payment path.",
    workerAction: "Can collect through trusted link without handling card data.",
    companyAction: "Marks payment/payout status and verifies reserves, profit, bonus, referral, and growth splits.",
    automation: "Square link, deposit gate, payout preview, and manual payout status keep money movement controlled.",
    proof: "Square payment URL/status, deposit flag, payout status, paid timestamp, profit-share record.",
    rewardClose: "Cash payout now; automatic invoice/payment setup as Square token/config matures.",
    primarySurface: "Finance, Job Detail, Job Payouts",
    sourceOfTruth: "leads + payment/payout tables",
  },
  {
    id: "retain",
    label: "Retain",
    references: "Target loyalty, McDonald's repeat habit, Goodwill reuse loop, JCMOVES",
    objective: "Turn a completed job into the next booking, review, referral, or reuse opportunity.",
    customerAction: "Leaves review, uses JCMOVES, rebooks, refers someone, or asks for related services.",
    workerAction: "Uses completed photos/reviews for the next local post and follows up with warm leads.",
    companyAction: "Measures campaign performance, reviews, repeat jobs, and reward liability.",
    automation: "Review links, rep pages, webhook reminders, wallet rewards, and campaign analytics feed the loop.",
    proof: "Review, reward ledger, attribution, repeat lead, recovered funnel card, campaign performance row.",
    rewardClose: "JCMOVES reinforces useful behavior without replacing actual payment discipline.",
    primarySurface: "Reviews, Rewards, Marketing Network, Analytics",
    sourceOfTruth: "rewards + reviews + quote_attributions",
  },
];

export const MARKETPLACE_ACTION_TASKS: MarketplaceActionTask[] = [
  {
    id: "customer_seed_request",
    phase: "start",
    rail: "customer",
    side: "customer",
    title: "Submit the seed request",
    action: "Answer ZIP/address, estimated date, service, truck/provider, contact, notes, and optional photos.",
    proof: "quote_requested lead card plus booking funnel event.",
    bonusJcMoves: 0,
    customerImpact: "A customer can start the job in under 60 seconds and recover it later if they leave.",
    companyGuardrail: "No final price is promised until staff confirms the quote.",
    sourcePatterns: "Google, Yelp, MovingHelp, Walmart catalog flow",
    flowIds: ["google_yelp_trust", "uhaul_movinghelp", "target_walmart_catalog"],
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "customer_confirm_path",
    phase: "progress",
    rail: "customer",
    side: "customer",
    title: "Confirm the job path",
    action: "Review the estimate, answer any missing scheduling questions, and use the approved payment link when ready.",
    proof: "customer-visible status, confirmed date/window, quote/payment status, or message history.",
    bonusJcMoves: 0,
    customerImpact: "The customer knows the quote is being handled and what is needed to lock it in.",
    companyGuardrail: "Customer sees an estimate range or confirmed price, not unapproved internal guesses.",
    sourcePatterns: "MovingHelp confirmation, Square payment link, Google/Yelp trust",
    flowIds: ["uhaul_movinghelp", "square_collect", "google_yelp_trust"],
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse"],
  },
  {
    id: "customer_review_rebook",
    phase: "finish",
    rail: "customer",
    side: "customer",
    title: "Review, reward, or rebook",
    action: "Leave a review, use earned JCMOVES credit, refer someone, or start the next related service.",
    proof: "review, reward ledger, referral attribution, repeat lead, or rebook event.",
    bonusJcMoves: 0,
    customerImpact: "The finished job becomes trust, credit, and a faster next booking.",
    companyGuardrail: "Rewards attach after verified completion and payment rules pass.",
    sourcePatterns: "Target loyalty, McDonald's repeat habit, JCMOVES rewards",
    flowIds: ["target_walmart_catalog", "mcdonalds_menu", "jcmoves_rewards"],
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "customer_giveback_or_nominate",
    phase: "finish",
    rail: "customer",
    side: "customer",
    title: "Send love or nominate giveback",
    action: "Use Wallet to send JCMOVES love to Mom's fund, nominate a giveback recipient, or choose approved service credit.",
    proof: "mom heart, nominee allocation, generosity fund ledger entry, or approved redemption record.",
    bonusJcMoves: 0,
    customerImpact: "Rewards feel connected to real family/community support instead of being abstract points.",
    companyGuardrail: "Giveback accounting stays separate from job payout, customer discounts, and company profit.",
    sourcePatterns: "JCMOVES crypto, Generosity Fund, Goodwill community loop",
    flowIds: ["jcmoves_rewards", "generosity_fund", "goodwill_reuse"],
    shapeIds: ["repeat_loop"],
  },
  {
    id: "bronze_local_ad",
    phase: "start",
    rail: "bronze",
    side: "worker",
    title: "Post a tracked local ad",
    action: "Use the ad creator, choose area/focus, attach a real photo when possible, and share the tracked link.",
    proof: "marketing campaign row with source, rep code, and tracked link.",
    bonusJcMoves: 250,
    customerImpact: "More local people find a simple booking doorway instead of sending scattered messages.",
    companyGuardrail: "Only tracked campaigns count for bonuses; no unverifiable ad credit.",
    sourcePatterns: "Facebook, Craigslist, Google local intent",
    flowIds: ["facebook_craigslist_ads", "google_yelp_trust", "discord_webhooks"],
    shapeIds: ["fast_quote", "repeat_loop"],
  },
  {
    id: "bronze_capture_quick_request",
    phase: "start",
    rail: "bronze",
    side: "worker",
    title: "Capture a quick request",
    action: "Collect name, phone, ZIP/address, estimated date, service shape, and one useful note.",
    proof: "lead card or recoverable funnel event with worker/source attribution.",
    bonusJcMoves: 350,
    customerImpact: "A caller or message thread becomes a real card before the opportunity goes cold.",
    companyGuardrail: "Bronze can submit/request, not approve final pricing.",
    sourcePatterns: "Yelp lead capture, Facebook messenger, Porch/HireAHelper intake",
    flowIds: ["google_yelp_trust", "facebook_craigslist_ads", "porch_hireahelper_consensus"],
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse"],
  },
  {
    id: "silver_sample_quote",
    phase: "progress",
    rail: "silver",
    side: "worker",
    title: "Pick a sample quote path",
    action: "Choose the guided package/range that best matches the card: crew size, hours, travel, and service.",
    proof: "quote consensus vote saved on the lead.",
    bonusJcMoves: 300,
    customerImpact: "The customer gets a faster recommendation while still waiting for final confirmation.",
    companyGuardrail: "Multiple matching picks raise confidence; one pick alone does not finalize the quote.",
    sourcePatterns: "HireAHelper comparison, MovingHelp rate rows, McDonald's simple menu",
    flowIds: ["porch_hireahelper_consensus", "uhaul_movinghelp", "mcdonalds_menu"],
    shapeIds: ["moving_help", "fast_quote"],
  },
  {
    id: "silver_build_quote_card",
    phase: "progress",
    rail: "silver",
    side: "worker",
    title: "Build the quote card",
    action: "Fill crew size, hours, window, zone, notes, estimate range, and missing customer details.",
    proof: "lead quote snapshot has enough detail for approval.",
    bonusJcMoves: 500,
    customerImpact: "The request becomes understandable and schedulable.",
    companyGuardrail: "Silver builds the card; Gold or Platinum approves customer-facing price.",
    sourcePatterns: "MovingHelper provider profile, U-Haul crew sizing, PODS/U-Box details",
    flowIds: ["uhaul_movinghelp", "pods_ubox_containers"],
    shapeIds: ["moving_help", "delivery_reuse"],
  },
  {
    id: "gold_approve_quote",
    phase: "progress",
    rail: "gold",
    side: "worker",
    title: "Approve the quote recommendation",
    action: "Check zone pricing, travel, crew availability, minimums, discount threshold, and margin.",
    proof: "quote approval record or quoted status on lead.",
    bonusJcMoves: 700,
    customerImpact: "The estimate becomes a real confirmed quote path.",
    companyGuardrail: "Gold approval protects price quality before the card becomes available or assigned.",
    sourcePatterns: "MovingHelp pricing control, Yelp trust, Square invoice readiness",
    flowIds: ["uhaul_movinghelp", "google_yelp_trust", "square_collect"],
    shapeIds: ["moving_help", "delivery_reuse", "fast_quote"],
  },
  {
    id: "platinum_dispatch_ready",
    phase: "progress",
    rail: "platinum",
    side: "company",
    title: "Dispatch the card",
    action: "Set date/window, assign crew, resolve leave/availability, and push the card to calendar.",
    proof: "assignment, calendar date, dispatch status, and assigned-crew notification.",
    bonusJcMoves: 900,
    customerImpact: "The customer knows who is coming and when.",
    companyGuardrail: "Only assigned crew get future job updates after dispatch.",
    sourcePatterns: "Two Men and a Truck dispatch, Porch Moving Group ops",
    flowIds: ["two_men_ops", "discord_webhooks"],
    shapeIds: ["moving_help", "delivery_reuse"],
  },
  {
    id: "platinum_payment_ready",
    phase: "progress",
    rail: "platinum",
    side: "company",
    title: "Prepare collection",
    action: "Attach Square link or approved cash path, deposit rule, payout preview, and company profit split.",
    proof: "payment URL/status, deposit flag, payout preview, and finance notes.",
    bonusJcMoves: 600,
    customerImpact: "Anyone trusted can collect payment with a link instead of handling card data.",
    companyGuardrail: "No payout release before payment/deposit approval rules pass.",
    sourcePatterns: "Square invoice links, cash payout ledger, JCMOVES rewards",
    flowIds: ["square_collect", "jcmoves_rewards"],
    shapeIds: ["moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "worker_complete_proof",
    phase: "finish",
    rail: "bronze",
    side: "worker",
    title: "Close with proof",
    action: "Mark complete, add notes/photos when useful, and flag any payment or customer issue.",
    proof: "completed status, completion timestamp, proof notes/photos.",
    bonusJcMoves: 500,
    customerImpact: "The customer gets a clean closeout and review/rebook path.",
    companyGuardrail: "Completion rewards and payouts must run idempotently once.",
    sourcePatterns: "Professional mover closeout, Google/Yelp review loop",
    flowIds: ["two_men_ops", "google_yelp_trust", "jcmoves_rewards"],
    shapeIds: ["moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "gold_review_recovery",
    phase: "finish",
    rail: "gold",
    side: "worker",
    title: "Recover the next opportunity",
    action: "Request review, identify add-on/rebook/referral, and connect the customer to the next simple action.",
    proof: "review, repeat lead, referral attribution, or campaign follow-up row.",
    bonusJcMoves: 450,
    customerImpact: "A completed job turns into trust, credit, and the next useful service.",
    companyGuardrail: "Bonuses attach to verified review/recovery behavior, not vague follow-up claims.",
    sourcePatterns: "Target loyalty, McDonald's repeat habit, Goodwill reuse loop",
    flowIds: ["target_walmart_catalog", "mcdonalds_menu", "goodwill_reuse", "jcmoves_rewards"],
    shapeIds: ["repeat_loop", "delivery_reuse", "fast_quote"],
  },
  {
    id: "platinum_payout_close",
    phase: "finish",
    rail: "platinum",
    side: "company",
    title: "Approve payout and rewards",
    action: "Confirm payment, worker payout, company reserves, bonuses, JCMOVES, and exception notes.",
    proof: "payout status, reward ledger, paid timestamp, and profit-share record.",
    bonusJcMoves: 750,
    customerImpact: "The job is financially closed and ready for future service credit/rewards.",
    companyGuardrail: "Cash payout now; Square/JCMOVES automation later, with no duplicate payout records.",
    sourcePatterns: "Square collection, JCMOVES crypto, company profit rails",
    flowIds: ["square_collect", "jcmoves_rewards"],
    shapeIds: ["moving_help", "delivery_reuse", "repeat_loop"],
  },
];

export const MARKETPLACE_SOURCE_READINESS: MarketplaceSourceOperationalReadiness[] = [
  {
    sourceFlowId: "target_walmart_catalog",
    ownerRail: "silver",
    readiness: "watch",
    launchQuestion: "Do the most common service cards create a real quote_requested lead with add-ons and photos?",
    nextAction: "Keep service cards short, route them through smart package defaults, and attach add-ons to the lead snapshot.",
    publishProof: "A package, add-on, address, date, and photo can be seen on the lead card after submit.",
    automationGate: "Smart booking package defaults and address/zone preview must run before quote approval.",
    rewardClose: "Marketing or add-on JCMOVES only after a recoverable or converted lead exists.",
  },
  {
    sourceFlowId: "goodwill_reuse",
    ownerRail: "silver",
    readiness: "build",
    launchQuestion: "Can removal or delivery requests say donate, dispose, deliver, store, or reuse without a phone call?",
    nextAction: "Add item destiny choices to photo/item capture and show those tags on job detail and completion proof.",
    publishProof: "A test lead stores item photos plus disposition tags and workers can see the handling plan.",
    automationGate: "Completion proof should separate donation/reuse notes from disposal, payout, and invoice records.",
    rewardClose: "Reuse or donation JCMOVES only after approved proof is attached to the completed card.",
  },
  {
    sourceFlowId: "mcdonalds_menu",
    ownerRail: "silver",
    readiness: "ready",
    launchQuestion: "Can a customer pick the obvious package in under 60 seconds?",
    nextAction: "Keep the default choices visible: 2 movers / 3 hours, 3 movers / 2 hours, or quote review.",
    publishProof: "The smart booking path turns a package pick into crew size, hours, estimate range, and lead card context.",
    automationGate: "Package suggestions must stay estimates until Gold or Platinum confirms pricing.",
    rewardClose: "Quote-sampling JCMOVES only count when the sample helps an approved quote path.",
  },
  {
    sourceFlowId: "two_men_ops",
    ownerRail: "platinum",
    readiness: "watch",
    launchQuestion: "Does a priced card become scheduled, assigned, dispatched, completed, and green on the calendar?",
    nextAction: "Keep lead status, date/window, assigned crew, and completion proof tied to the same operational card.",
    publishProof: "A test card appears on admin and crew calendars, then completion closes the payout/review path once.",
    automationGate: "Assigned job updates must notify assigned crew and admin, not the entire crew forever.",
    rewardClose: "Completion JCMOVES and payout math run once after verified completion.",
  },
  {
    sourceFlowId: "uhaul_movinghelp",
    ownerRail: "gold",
    readiness: "watch",
    launchQuestion: "Do ZIP/date, load/unload/both, truck provider, truck size, crew, hours, and zone rate all land on the card?",
    nextAction: "Keep MovingHelp-style rate rows connected to zone quote preview and quote snapshots.",
    publishProof: "A moving-help test request shows the zone, rate row, minimum hours, discount threshold, and estimate range.",
    automationGate: "No hard final price until Gold or Platinum approves the quote snapshot.",
    rewardClose: "Quote helper JCMOVES unlock only after the quote card is useful or approved.",
  },
  {
    sourceFlowId: "porch_hireahelper_consensus",
    ownerRail: "gold",
    readiness: "ready",
    launchQuestion: "Can marketers or workers sample quote choices without accidentally approving price?",
    nextAction: "Keep Bronze/Silver choices multiple-choice and require matching confidence or Gold/Platinum approval.",
    publishProof: "Two or three matching guided quote picks raise confidence without bypassing authority rails.",
    automationGate: "Consensus can recommend; approval rail controls the customer-facing quote.",
    rewardClose: "Consensus bonuses pay only when the contribution ties to an approved card.",
  },
  {
    sourceFlowId: "google_yelp_trust",
    ownerRail: "platinum",
    readiness: "watch",
    launchQuestion: "Can a customer find an address fast, leave partial info, and still become recoverable if something fails?",
    nextAction: "Keep smart address input, funnel events, errors, and recover-this-request connected to lead creation.",
    publishProof: "An abandoned attempt with phone/email is visible in funnel analytics and can become quote_requested.",
    automationGate: "Owner/admin alert fires on new request; funnel error capture preserves useful partial context.",
    rewardClose: "Review or recovery JCMOVES require verified review, recovered card, or attributed booking.",
  },
  {
    sourceFlowId: "facebook_craigslist_ads",
    ownerRail: "bronze",
    readiness: "ready",
    launchQuestion: "Can a crew member make one simple tracked post and see whether it becomes a lead?",
    nextAction: "Keep ad creation focused on area, photo, short text, tracked link, and Discord reminder.",
    publishProof: "A campaign link stores source, rep, promo, and campaign on any resulting card or funnel event.",
    automationGate: "Only tracked campaign links and recoverable requests count toward marketing credit.",
    rewardClose: "Marketing JCMOVES pay after a recoverable or converted lead, not just a posted message.",
  },
  {
    sourceFlowId: "pods_ubox_containers",
    ownerRail: "silver",
    readiness: "build",
    launchQuestion: "Can container jobs price labor, box count, delivery, mileage, and access separately?",
    nextAction: "Add container-specific intake and U-Box-style rate rows to the quote card path.",
    publishProof: "A test U-Box/container request stores container count, access notes, labor split, mileage, and estimate.",
    automationGate: "Container pricing must not collapse into a generic moving-labor estimate.",
    rewardClose: "Container completion JCMOVES require verified box count/access completion proof.",
  },
  {
    sourceFlowId: "square_collect",
    ownerRail: "platinum",
    readiness: "watch",
    launchQuestion: "Can a confirmed quote produce a trusted payment link while cash payout remains safe for now?",
    nextAction: "Keep Square link generation behind approval, with deposit gate, payment status, and payout preview visible.",
    publishProof: "A test approved quote has payment URL/status, deposit flag, payout preview, and finance notes.",
    automationGate: "No payout release before payment/deposit approval rules pass.",
    rewardClose: "Customer spend JCMOVES only after payment clears; worker payout bonuses wait for completion approval.",
  },
  {
    sourceFlowId: "discord_webhooks",
    ownerRail: "platinum",
    readiness: "ready",
    launchQuestion: "Do lifecycle events notify the right audience without blasting everyone forever?",
    nextAction: "Keep new-request alerts for owner/admin, available-job alerts for eligible crew, and assigned updates targeted.",
    publishProof: "A test event posts to Discord and internal notifications with event type and audience recorded.",
    automationGate: "Webhook delivery follows job lifecycle events, not loose manual blasts.",
    rewardClose: "Reminder/task JCMOVES require the prompted action to be completed.",
  },
  {
    sourceFlowId: "jcmoves_rewards",
    ownerRail: "platinum",
    readiness: "ready",
    launchQuestion: "Do customers and workers have simple receive and redeem rails backed by one-safe ledger events?",
    nextAction: "Keep receive/redeem visible in Wallet and Rewards, and keep idempotent source ids on reward writes.",
    publishProof: "A verified booking, review, referral, completion, or redemption creates one ledger-safe reward event.",
    automationGate: "Rewards must be tied to proof and source ids so duplicate payouts cannot sneak in.",
    rewardClose: "Verified actions only: created lead, useful quote, completed job, review, referral, repeat booking.",
  },
  {
    sourceFlowId: "generosity_fund",
    ownerRail: "platinum",
    readiness: "ready",
    launchQuestion: "Is Mom's fund visible while staying separate from payout, discounts, and company profit?",
    nextAction: "Keep Mom wallet, platform fund, nominees, and heart donations visible in admin and wallet surfaces.",
    publishProof: "Mom stats, heart donations, nominee totals, and generosity ledger rows are visible and separated.",
    automationGate: "Internal wallets are excluded from circular rewards and giveback credits use verified wallet events.",
    rewardClose: "Giveback JCMOVES only after verified wallet credit, donation, nominee allocation, or approved task.",
  },
];

export const MARKETPLACE_SMART_BOOKING_STEPS: MarketplaceSmartBookingStep[] = [
  {
    id: "where_when",
    order: 1,
    label: "Where and when",
    prompt: "Add the service ZIP or address and the best date or route day.",
    quickOptions: ["Use current ZIP", "I know the address", "Date flexible"],
    captures: ["zip", "address", "estimated date", "time window"],
    autoInterpretation: "Resolve address/ZIP, match pricing zone, estimate travel, and create a recoverable funnel event.",
    customerPromise: "The customer starts with the two facts that make every quote possible.",
    workerSignal: "Workers see area, likely route, and timing before thinking about the job.",
    companyControl: "Zone pricing, calendar fit, travel padding, and abandoned-request recovery start immediately.",
    sourcePatterns: "Google address search, Yelp local intent, Walmart pickup/delivery ZIP checks",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse"],
  },
  {
    id: "job_shape",
    order: 2,
    label: "Choose the job shape",
    prompt: "Choose delivery/small project, moving help, or repeat work like lawn, snow, junk, or handyman.",
    quickOptions: ["Delivery / small project", "Load", "Unload", "Load + unload", "Repeat work", "Not sure"],
    captures: ["service shape", "load/unload choice", "pickup/drop-off intent", "repeat-service intent", "uncertainty flag"],
    autoInterpretation: "Map the answer to a marketplace request shape and the matching source play.",
    customerPromise: "One tap gets them into the right lane without learning internal service codes.",
    workerSignal: "The card shows whether this is moving labor, delivery/small project, or repeat route work.",
    companyControl: "The lead card can route to the right quote rules, zone rates, and approval rail.",
    sourcePatterns: "MovingHelp service picker, Target/Walmart category cards, Goodwill item flow",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "truck_context",
    order: 3,
    label: "Truck and access",
    prompt: "For moving or delivery, add pickup/drop-off, truck/container, stairs, elevator, and access notes.",
    quickOptions: ["Customer truck", "Need JC truck", "U-Haul", "Trailer", "Storage/container", "Stairs"],
    captures: ["pickup/drop-off", "truck provider", "truck size", "stairs", "elevator", "access notes", "container count"],
    autoInterpretation: "Suggest crew/hours and flag travel, truck, stairs, or container risk before quote approval.",
    customerPromise: "The quote feels simple, but the system still catches the details that change price.",
    workerSignal: "Workers know if they are loading a customer truck, using JC equipment, or handling containers.",
    companyControl: "Truck fees, minimums, access risk, and container/mileage variables stay visible on the card.",
    sourcePatterns: "U-Haul truck sizes, PODS/U-Box access notes, Two Men and a Truck move readiness",
    shapeIds: ["moving_help", "delivery_reuse"],
  },
  {
    id: "smart_package",
    order: 4,
    label: "Smart package",
    prompt: "Pick a common crew/hour package or keep the request in quote review.",
    quickOptions: ["2 movers / 3 hours", "3 movers / 2 hours", "2 movers / 2 hours", "Need quote review"],
    captures: ["crew size", "estimated hours", "package choice", "quote review flag"],
    autoInterpretation: "Use zone rates, minimum hours, discounts, travel, and padding to show an estimate range.",
    customerPromise: "Common jobs move fast; unusual jobs still become a quote card instead of a dead end.",
    workerSignal: "Crew sees a standard starting expectation and whether the card needs quote review.",
    companyControl: "Gold/Platinum can override package, margin, final price, deposit, and payout preview.",
    sourcePatterns: "McDonald's menu simplicity, MovingHelper hourly rates, HireAHelper comparison confidence",
    shapeIds: ["moving_help", "fast_quote"],
  },
  {
    id: "detail_capture",
    order: 5,
    label: "Details and proof",
    prompt: "Add photos, item list, or repeat-work notes where they help price the job.",
    quickOptions: ["Add photos", "Heavy item", "Fragile item", "Lawn/snow/junk/handyman notes", "No extra details"],
    captures: ["photos", "item list", "repeat-work notes", "heavy items", "fragile items", "donate/dispose/deliver/store tags", "notes"],
    autoInterpretation: "Attach media and item tags to the lead so pricing and completion proof stay connected.",
    customerPromise: "Customers can be detailed without being forced through a long form.",
    workerSignal: "Workers see photos, special items, and item destiny before arrival.",
    companyControl: "Photos, risk tags, reuse categories, and completion proof connect to the same card.",
    sourcePatterns: "Goodwill disposition, Yelp/Facebook photo trust, Target add-ons",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
  {
    id: "contact_recovery",
    order: 6,
    label: "Contact and recovery",
    prompt: "Add name, phone, and email so the request can be saved and followed up.",
    quickOptions: ["Text me", "Email me", "Call me", "I need help now"],
    captures: ["name", "phone", "email", "preferred contact", "urgency", "lead source"],
    autoInterpretation: "Create/link the lead, notify owner/admin, and keep partial info recoverable if they leave.",
    customerPromise: "Their request is locked in and someone can follow up quickly.",
    workerSignal: "Assigned crew gets clean customer contact only when the job is ready for them.",
    companyControl: "Notifications, attribution, recover-this-request, quote approval, and payment setup all begin from one card.",
    sourcePatterns: "Porch lead routing, Facebook/Craigslist follow-up, Discord/Solbot event bus, Square payment path",
    shapeIds: ["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"],
  },
];

export const MARKETPLACE_ZONE_SERVICE_OPTIONS: MarketplaceZoneServiceOption[] = [
  {
    code: "load_unload",
    label: "Load/Unload",
    shapeId: "moving_help",
    defaultCrewSize: 2,
    defaultHours: 3,
    customerPrompt: "Load, unload, or both.",
    workerReality: "Crew count, window, truck access, stairs, completion proof.",
    companyReality: "Hourly rate, minimum hours, discount threshold, travel fee.",
  },
  {
    code: "pack_unpack",
    label: "Pack/Unpack",
    shapeId: "moving_help",
    defaultCrewSize: 2,
    defaultHours: 3,
    customerPrompt: "Rooms, boxes, fragile items, and packing supplies.",
    workerReality: "Labor-only task with supplies and room priority notes.",
    companyReality: "Hourly rate, minimum hours, materials note, add-on option.",
  },
  {
    code: "delivery",
    label: "Delivery",
    shapeId: "delivery_reuse",
    defaultCrewSize: 2,
    defaultHours: 2,
    customerPrompt: "Pickup, drop-off, item size, and timing window.",
    workerReality: "Driver/helper route with access notes and photo proof.",
    companyReality: "Travel rate, item handling, route bundling, Square link.",
  },
  {
    code: "ubox",
    label: "U-Box Style",
    shapeId: "moving_help",
    defaultCrewSize: 2,
    defaultHours: 2,
    customerPrompt: "Delivery only, load/unload only, or both.",
    workerReality: "Container job with site access, box count, and time window.",
    companyReality: "Box fee, hourly minimum, mileage, and quote snapshot.",
  },
];

export function getMarketplaceRequestShape(id: MarketplaceRequestShapeId) {
  return MARKETPLACE_REQUEST_SHAPES.find((shape) => shape.id === id);
}

export function getMarketplaceFunctionalIdeasForShape(id: MarketplaceRequestShapeId) {
  return MARKETPLACE_FUNCTIONAL_IDEAS.filter((idea) => idea.shapeIds.includes(id));
}

export function getMarketplaceActionTasksForRail(rail: MarketplaceActionRail) {
  return MARKETPLACE_ACTION_TASKS.filter((task) => task.rail === rail);
}

export function getMarketplaceActionTasksForPhase(phase: MarketplaceActionPhase) {
  return MARKETPLACE_ACTION_TASKS.filter((task) => task.phase === phase);
}

export function getMarketplaceSourceFlowsForActionTask(task: Pick<MarketplaceActionTask, "flowIds">, limit = 4) {
  const flowById = new Map(MARKETPLACE_SOURCE_FLOW_MATRIX.map((flow) => [flow.id, flow]));
  return task.flowIds
    .map((flowId) => flowById.get(flowId))
    .filter((flow): flow is MarketplaceSourceFlow => Boolean(flow))
    .slice(0, Math.max(0, limit));
}

export function getMarketplaceReadinessForSourceFlow(sourceFlowId: string | null | undefined) {
  return MARKETPLACE_SOURCE_READINESS.find((item) => item.sourceFlowId === sourceFlowId) || null;
}

const launchTaskPhaseByReadiness: Record<MarketplaceSourceReadinessLevel, MarketplaceActionPhase> = {
  build: "start",
  watch: "progress",
  ready: "finish",
};

const launchTaskTitleByReadiness: Record<MarketplaceSourceReadinessLevel, string> = {
  build: "Build",
  watch: "Verify",
  ready: "Protect",
};

const launchTaskBonusByReadiness: Record<MarketplaceSourceReadinessLevel, number> = {
  build: 400,
  watch: 250,
  ready: 150,
};

export function getMarketplaceLaunchTasks(): MarketplaceLaunchTask[] {
  const flowById = new Map(MARKETPLACE_SOURCE_FLOW_MATRIX.map((flow) => [flow.id, flow]));

  return MARKETPLACE_SOURCE_READINESS
    .map((readiness): MarketplaceLaunchTask | null => {
      const flow = flowById.get(readiness.sourceFlowId);
      if (!flow) return null;
      const linkedTasks = MARKETPLACE_ACTION_TASKS.filter((task) => task.flowIds.includes(flow.id));
      const ownerTasks = linkedTasks.filter((task) => task.rail === readiness.ownerRail);
      const visibleTasks = ownerTasks.length > 0 ? ownerTasks : linkedTasks;
      const readinessVerb = launchTaskTitleByReadiness[readiness.readiness];

      return {
        id: `launch_${flow.id}`,
        sourceFlowId: flow.id,
        source: flow.source,
        category: flow.category,
        phase: launchTaskPhaseByReadiness[readiness.readiness],
        ownerRail: readiness.ownerRail,
        readiness: readiness.readiness,
        title: `${readinessVerb} ${flow.source}`,
        launchQuestion: readiness.launchQuestion,
        action: readiness.nextAction,
        acceptanceCriteria: readiness.publishProof,
        automationGate: readiness.automationGate,
        rewardClose: readiness.rewardClose,
        linkedActionTaskIds: visibleTasks.map((task) => task.id),
        totalMappedBonusJcMoves: visibleTasks.reduce((sum, task) => sum + Math.max(0, task.bonusJcMoves || 0), 0),
        completionBonusJcMoves: launchTaskBonusByReadiness[readiness.readiness],
        surfaces: flow.surfaces,
        shapeIds: flow.shapeIds,
        flywheelStages: flow.flywheelStages,
      };
    })
    .filter((task): task is MarketplaceLaunchTask => Boolean(task));
}

export function getMarketplaceLaunchTasksForRail(rail: MarketplaceActionRail) {
  return getMarketplaceLaunchTasks().filter((task) => task.ownerRail === rail);
}

export function getMarketplaceLaunchTasksForReadiness(readiness: MarketplaceSourceReadinessLevel) {
  return getMarketplaceLaunchTasks().filter((task) => task.readiness === readiness);
}

export function getMarketplaceSmartBookingStepsForShape(id: MarketplaceRequestShapeId) {
  return MARKETPLACE_SMART_BOOKING_STEPS
    .filter((step) => step.shapeIds.includes(id))
    .sort((a, b) => a.order - b.order);
}

function normalizeMarketplaceText(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sourceTokens(flow: MarketplaceSourceFlow): string[] {
  const base = [
    flow.id,
    flow.source,
    flow.category,
    flow.surfaces,
    ...flow.shapeIds,
    ...flow.flywheelStages,
  ];
  return base.flatMap((value) => normalizeMarketplaceText(value).split("_")).filter(Boolean);
}

export function getMarketplaceSourceFlowForSource(source: string | null | undefined) {
  const normalized = normalizeMarketplaceText(source);
  if (!normalized) return null;

  const directAliases: Record<string, string> = {
    target: "target_walmart_catalog",
    walmart: "target_walmart_catalog",
    retail: "target_walmart_catalog",
    catalog: "target_walmart_catalog",
    goodwill: "goodwill_reuse",
    donation: "goodwill_reuse",
    donate: "goodwill_reuse",
    reuse: "goodwill_reuse",
    mcdonalds: "mcdonalds_menu",
    mc_donalds: "mcdonalds_menu",
    mc_donald_s: "mcdonalds_menu",
    menu: "mcdonalds_menu",
    package: "mcdonalds_menu",
    package_quote: "mcdonalds_menu",
    "2men": "two_men_ops",
    "2men_and_a_truck": "two_men_ops",
    two_men: "two_men_ops",
    two_men_and_a_truck: "two_men_ops",
    uhaul: "uhaul_movinghelp",
    u_haul: "uhaul_movinghelp",
    movinghelp: "uhaul_movinghelp",
    movinghelper: "uhaul_movinghelp",
    moving_helper: "uhaul_movinghelp",
    porch: "porch_hireahelper_consensus",
    porch_moving_group: "porch_hireahelper_consensus",
    hireahelper: "porch_hireahelper_consensus",
    hire_a_helper: "porch_hireahelper_consensus",
    google: "google_yelp_trust",
    yelp: "google_yelp_trust",
    search: "google_yelp_trust",
    quick_request: "google_yelp_trust",
    chatbot: "google_yelp_trust",
    booking_funnel: "google_yelp_trust",
    facebook: "facebook_craigslist_ads",
    craigslist: "facebook_craigslist_ads",
    classified: "facebook_craigslist_ads",
    ad: "facebook_craigslist_ads",
    ads: "facebook_craigslist_ads",
    pods: "pods_ubox_containers",
    pod: "pods_ubox_containers",
    ubox: "pods_ubox_containers",
    u_box: "pods_ubox_containers",
    square: "square_collect",
    invoice: "square_collect",
    payment: "square_collect",
    discord: "discord_webhooks",
    solbot: "discord_webhooks",
    webhook: "discord_webhooks",
    webhooks: "discord_webhooks",
    jcmoves: "jcmoves_rewards",
    rewards: "jcmoves_rewards",
    crypto: "jcmoves_rewards",
    generosity: "generosity_fund",
    generosity_fund: "generosity_fund",
    giveback: "generosity_fund",
    mom: "generosity_fund",
    nominee: "generosity_fund",
    nominees: "generosity_fund",
  };

  const exactId = directAliases[normalized];
  if (exactId) return MARKETPLACE_SOURCE_FLOW_MATRIX.find((flow) => flow.id === exactId) || null;

  const parts = normalized.split("_").filter(Boolean);
  const partAlias = parts.map((part) => directAliases[part]).find(Boolean);
  if (partAlias) return MARKETPLACE_SOURCE_FLOW_MATRIX.find((flow) => flow.id === partAlias) || null;

  return MARKETPLACE_SOURCE_FLOW_MATRIX.find((flow) => {
    const tokens = new Set(sourceTokens(flow));
    return parts.some((part) => tokens.has(part));
  }) || null;
}

export function getMarketplaceLaunchSourceTargetsForFlow(sourceFlowId: string | null | undefined) {
  if (!sourceFlowId) return [];

  return MARKETPLACE_LAUNCH_SOURCE_TARGETS.filter((target) =>
    target.aliases.some((alias) => getMarketplaceSourceFlowForSource(alias)?.id === sourceFlowId)
  );
}

export function getMarketplaceSourceFlowsForShape(id: MarketplaceRequestShapeId) {
  return MARKETPLACE_SOURCE_FLOW_MATRIX.filter((flow) => flow.shapeIds.includes(id));
}

function meaningfulReferenceTokens(value: string): string[] {
  const stopwords = new Set(["a", "an", "and", "the", "com"]);
  return normalizeMarketplaceText(value)
    .split("_")
    .filter((token) => token && !stopwords.has(token));
}

export function getMarketplaceReferenceBlueprintsForSource(source: string | null | undefined, limit = 4) {
  const flow = getMarketplaceSourceFlowForSource(source);
  if (!flow) return [];

  const flowTokens = new Set(sourceTokens(flow));
  const matches = MARKETPLACE_REFERENCE_BLUEPRINTS.filter((blueprint) => {
    const referenceTokens = meaningfulReferenceTokens(blueprint.reference);
    return referenceTokens.length > 0 && referenceTokens.every((token) => flowTokens.has(token));
  });

  return matches.slice(0, Math.max(0, limit));
}

export function getMarketplaceSourceFlowsForContext({
  source,
  shapeId,
  serviceCode,
  serviceLabel,
  limit = 2,
}: {
  source?: string | null;
  shapeId?: string | null;
  serviceCode?: string | null;
  serviceLabel?: string | null;
  limit?: number;
}) {
  const shape = shapeId
    ? getMarketplaceRequestShape(shapeId as MarketplaceRequestShapeId) || getMarketplaceShapeForServiceCode(serviceCode || serviceLabel)
    : getMarketplaceShapeForServiceCode(serviceCode || serviceLabel);
  const fromSource = getMarketplaceSourceFlowForSource(source);
  const fromShape = getMarketplaceSourceFlowsForShape(shape.id);
  const unique = new Map<string, MarketplaceSourceFlow>();

  if (fromSource) unique.set(fromSource.id, fromSource);
  for (const flow of fromShape) unique.set(flow.id, flow);

  return Array.from(unique.values()).slice(0, Math.max(0, limit));
}

export function getMarketplaceShapeForServiceCode(serviceCode: string | null | undefined) {
  const normalized = String(serviceCode || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized) return getMarketplaceRequestShape("delivery_reuse")!;

  if (
    normalized.includes("rebook") ||
    normalized.includes("review") ||
    normalized.includes("reward") ||
    normalized.includes("rep_link") ||
    normalized.includes("referral")
  ) {
    return getMarketplaceRequestShape("repeat_loop")!;
  }

  if (
    normalized.includes("clean") ||
    normalized.includes("junk") ||
    normalized.includes("trash") ||
    normalized.includes("snow") ||
    normalized.includes("lawn") ||
    normalized.includes("paint") ||
    normalized.includes("floor") ||
    normalized.includes("roof") ||
    normalized.includes("handyman") ||
    normalized.includes("demo")
  ) {
    return getMarketplaceRequestShape("repeat_loop")!;
  }

  if (
    normalized.includes("ubox") ||
    normalized.includes("u_box") ||
    normalized.includes("moving") ||
    normalized.includes("move") ||
    normalized.includes("residential") ||
    normalized.includes("commercial") ||
    normalized.includes("load_unload") ||
    normalized.includes("unload") ||
    normalized.includes("pack_unpack") ||
    normalized.includes("packing") ||
    normalized === "labor"
  ) {
    return getMarketplaceRequestShape("moving_help")!;
  }

  if (
    normalized.includes("delivery") ||
    normalized.includes("pickup") ||
    normalized.includes("pods") ||
    normalized.includes("store") ||
    normalized.includes("reuse") ||
    normalized.includes("haul")
  ) {
    return getMarketplaceRequestShape("delivery_reuse")!;
  }

  if (
    normalized.includes("custom") ||
    normalized.includes("other") ||
    normalized.includes("something_else") ||
    normalized.includes("justask") ||
    normalized.includes("just_ask") ||
    normalized.includes("small_project") ||
    normalized.includes("single_item")
  ) {
    return getMarketplaceRequestShape("delivery_reuse")!;
  }

  return getMarketplaceRequestShape("delivery_reuse")!;
}
