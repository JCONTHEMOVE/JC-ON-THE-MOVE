import assert from "node:assert/strict";
import {
  MARKETPLACE_ACTION_TASKS,
  MARKETPLACE_LAUNCH_SOURCE_TARGETS,
  MARKETPLACE_OPERATING_FLYWHEEL,
  MARKETPLACE_REFERENCE_BLUEPRINTS,
  MARKETPLACE_REQUEST_SHAPES,
  MARKETPLACE_SIMPLE_SIDES,
  MARKETPLACE_SOURCE_FLOW_MATRIX,
  MARKETPLACE_SOURCE_READINESS,
  MARKETPLACE_SMART_BOOKING_STEPS,
  getMarketplaceShapeForServiceCode,
  getMarketplaceLaunchTasks,
  getMarketplaceLaunchTasksForRail,
  getMarketplaceLaunchTasksForReadiness,
  getMarketplaceReadinessForSourceFlow,
  getMarketplaceReferenceBlueprintsForSource,
  getMarketplaceSourceFlowForSource,
  getMarketplaceSourceFlowsForActionTask,
  getMarketplaceSourceFlowsForContext,
  type MarketplaceActionPhase,
  type MarketplaceActionRail,
  type MarketplaceRequestShapeId,
  type MarketplaceSideId,
} from "../../../shared/marketplaceShapes";
import {
  SERVICE_PRICE_MENU,
  SERVICE_PRICE_MENU_CATEGORIES,
  formatServicePriceRange,
  sourceSignalForServicePriceMenuTask,
} from "../../../shared/servicePriceMenu";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok ${name}`);
  } catch (error) {
    console.error(`  fail ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function assertFilled(value: string, label: string) {
  assert.ok(value.trim().length > 0, `${label} must be filled`);
}

console.log("marketplaceShapes()");

const expectedSourceAliases: Array<[string, string]> = [
  ["target", "target_walmart_catalog"],
  ["walmart", "target_walmart_catalog"],
  ["goodwill", "goodwill_reuse"],
  ["mcdonalds", "mcdonalds_menu"],
  ["mc donalds", "mcdonalds_menu"],
  ["2men and a truck", "two_men_ops"],
  ["two men and a truck", "two_men_ops"],
  ["uhaul", "uhaul_movinghelp"],
  ["u-haul", "uhaul_movinghelp"],
  ["movinghelp.com", "uhaul_movinghelp"],
  ["movinghelper.com", "uhaul_movinghelp"],
  ["porch moving group", "porch_hireahelper_consensus"],
  ["hire-a-helper", "porch_hireahelper_consensus"],
  ["yelp", "google_yelp_trust"],
  ["google", "google_yelp_trust"],
  ["facebook", "facebook_craigslist_ads"],
  ["craigslist", "facebook_craigslist_ads"],
  ["pods", "pods_ubox_containers"],
  ["u-box", "pods_ubox_containers"],
  ["square", "square_collect"],
  ["discord", "discord_webhooks"],
  ["solbot webhook", "discord_webhooks"],
  ["jcmoves", "jcmoves_rewards"],
  ["crypto", "jcmoves_rewards"],
  ["generosity", "generosity_fund"],
  ["mom", "generosity_fund"],
  ["nominee", "generosity_fund"],
];

const requiredBlueprintReferences = Array.from(new Set(
  MARKETPLACE_LAUNCH_SOURCE_TARGETS.flatMap((target) => target.blueprintReferences),
));

test("resolves every named inspiration source to an operational flow", () => {
  for (const target of MARKETPLACE_LAUNCH_SOURCE_TARGETS) {
    for (const alias of target.aliases) {
      assert.ok(getMarketplaceSourceFlowForSource(alias), `${target.label} alias "${alias}" should resolve to a marketplace flow`);
    }
  }

  for (const [alias, expectedId] of expectedSourceAliases) {
    const flow = getMarketplaceSourceFlowForSource(alias);
    assert.ok(flow, `${alias} should resolve to a marketplace flow`);
    assert.equal(flow?.id, expectedId, `${alias} should resolve to ${expectedId}`);
  }
});

test("keeps best-of-best references visible as blueprints", () => {
  const referenceText = normalize(MARKETPLACE_REFERENCE_BLUEPRINTS.map((blueprint) => blueprint.reference).join(" "));

  for (const reference of requiredBlueprintReferences) {
    assert.ok(
      referenceText.includes(normalize(reference)),
      `${reference} should be represented in reference blueprints`,
    );
  }
});

test("maps each operational source flow back to reference blueprints", () => {
  for (const flow of MARKETPLACE_SOURCE_FLOW_MATRIX) {
    const blueprints = getMarketplaceReferenceBlueprintsForSource(flow.source);
    assert.ok(blueprints.length > 0, `${flow.id} should expose at least one operating blueprint`);
  }

  const expectedBlueprints: Array<[string, string[]]> = [
    ["Target + Walmart", ["Target", "Walmart"]],
    ["U-Haul + MovingHelp + MovingHelper", ["U-Haul", "MovingHelp / MovingHelper"]],
    ["Google + Yelp", ["Google", "Yelp"]],
    ["Facebook + Craigslist", ["Facebook", "Craigslist"]],
    ["Discord + Solbot-style webhooks", ["Discord + Solbot Webhooks"]],
    ["JCMOVES Crypto", ["JCMOVES Crypto"]],
    ["Generosity Fund", ["Generosity Fund"]],
  ];

  for (const [source, expectedReferences] of expectedBlueprints) {
    const references = getMarketplaceReferenceBlueprintsForSource(source).map((blueprint) => blueprint.reference);
    for (const expectedReference of expectedReferences) {
      assert.ok(
        references.includes(expectedReference),
        `${source} should expose ${expectedReference} as an operating blueprint`,
      );
    }
  }
});

test("defines complete customer, worker, company, automation, and reward details for every source flow", () => {
  const shapeIds = new Set(MARKETPLACE_REQUEST_SHAPES.map((shape) => shape.id));
  const flywheelStageIds = new Set(MARKETPLACE_OPERATING_FLYWHEEL.map((stage) => stage.id));

  for (const flow of MARKETPLACE_SOURCE_FLOW_MATRIX) {
    assertFilled(flow.source, `${flow.id}.source`);
    assertFilled(flow.borrowedSignal, `${flow.id}.borrowedSignal`);
    assertFilled(flow.start, `${flow.id}.start`);
    assertFilled(flow.progress, `${flow.id}.progress`);
    assertFilled(flow.finish, `${flow.id}.finish`);
    assertFilled(flow.customerMove, `${flow.id}.customerMove`);
    assertFilled(flow.workerMove, `${flow.id}.workerMove`);
    assertFilled(flow.companyControl, `${flow.id}.companyControl`);
    assertFilled(flow.automationHook, `${flow.id}.automationHook`);
    assertFilled(flow.surfaces, `${flow.id}.surfaces`);
    assertFilled(flow.rewardTrigger, `${flow.id}.rewardTrigger`);
    assert.ok(flow.shapeIds.length > 0, `${flow.id} must be attached to at least one request shape`);
    assert.ok(flow.flywheelStages.length > 0, `${flow.id} must be attached to at least one flywheel stage`);

    for (const shapeId of flow.shapeIds) {
      assert.ok(shapeIds.has(shapeId), `${flow.id} references unknown shape ${shapeId}`);
    }

    for (const stageId of flow.flywheelStages) {
      assert.ok(flywheelStageIds.has(stageId), `${flow.id} references unknown flywheel stage ${stageId}`);
    }
  }
});

test("keeps simple surfaces and smart booking steps tied to valid sides and shapes", () => {
  const expectedSides: MarketplaceSideId[] = ["customer", "worker", "company"];
  assert.deepEqual(
    MARKETPLACE_SIMPLE_SIDES.map((side) => side.id).sort(),
    expectedSides.sort(),
  );

  const shapeIds = new Set(MARKETPLACE_REQUEST_SHAPES.map((shape) => shape.id));
  for (const step of MARKETPLACE_SMART_BOOKING_STEPS) {
    assertFilled(step.prompt, `${step.id}.prompt`);
    assertFilled(step.autoInterpretation, `${step.id}.autoInterpretation`);
    assertFilled(step.customerPromise, `${step.id}.customerPromise`);
    assertFilled(step.workerSignal, `${step.id}.workerSignal`);
    assertFilled(step.companyControl, `${step.id}.companyControl`);
    assert.ok(step.quickOptions.length > 0, `${step.id} must provide quick options`);

    for (const shapeId of step.shapeIds) {
      assert.ok(shapeIds.has(shapeId), `${step.id} references unknown shape ${shapeId}`);
    }
  }
});

test("covers every action rail and phase with proof, guardrails, source flow links, and JCMOVES math", () => {
  const expectedRails: MarketplaceActionRail[] = ["customer", "bronze", "silver", "gold", "platinum"];
  const expectedPhases: MarketplaceActionPhase[] = ["start", "progress", "finish"];
  const rails = new Set(MARKETPLACE_ACTION_TASKS.map((task) => task.rail));
  const phases = new Set(MARKETPLACE_ACTION_TASKS.map((task) => task.phase));
  const sides = new Set(MARKETPLACE_SIMPLE_SIDES.map((side) => side.id));
  const shapeIds = new Set(MARKETPLACE_REQUEST_SHAPES.map((shape) => shape.id));
  const flowIds = new Set(MARKETPLACE_SOURCE_FLOW_MATRIX.map((flow) => flow.id));

  for (const rail of expectedRails) {
    assert.ok(rails.has(rail), `${rail} rail should have at least one task`);
  }

  for (const phase of expectedPhases) {
    assert.ok(phases.has(phase), `${phase} phase should have at least one task`);
  }

  for (const task of MARKETPLACE_ACTION_TASKS) {
    assertFilled(task.title, `${task.id}.title`);
    assertFilled(task.action, `${task.id}.action`);
    assertFilled(task.proof, `${task.id}.proof`);
    assertFilled(task.customerImpact, `${task.id}.customerImpact`);
    assertFilled(task.companyGuardrail, `${task.id}.companyGuardrail`);
    assertFilled(task.sourcePatterns, `${task.id}.sourcePatterns`);
    assert.ok(task.bonusJcMoves >= 0, `${task.id} bonus JCMOVES cannot be negative`);
    assert.ok(sides.has(task.side), `${task.id} references unknown side ${task.side}`);

    for (const flowId of task.flowIds) {
      assert.ok(flowIds.has(flowId), `${task.id} references unknown source flow ${flowId}`);
    }

    for (const shapeId of task.shapeIds) {
      assert.ok(shapeIds.has(shapeId), `${task.id} references unknown shape ${shapeId}`);
    }
  }
});

test("links every source flow to at least one operational action task", () => {
  const linkedFlowIds = new Set(MARKETPLACE_ACTION_TASKS.flatMap((task) => task.flowIds));

  for (const flow of MARKETPLACE_SOURCE_FLOW_MATRIX) {
    assert.ok(linkedFlowIds.has(flow.id), `${flow.id} should be linked to at least one action task`);
  }
});

test("assigns every source flow a publish-readiness owner, proof, gate, and reward close", () => {
  const flowIds = new Set(MARKETPLACE_SOURCE_FLOW_MATRIX.map((flow) => flow.id));
  const rails = new Set<MarketplaceActionRail>(["customer", "bronze", "silver", "gold", "platinum"]);
  const levels = new Set(MARKETPLACE_SOURCE_READINESS.map((item) => item.readiness));
  const seen = new Set<string>();

  assert.equal(MARKETPLACE_SOURCE_READINESS.length, flowIds.size, "source readiness should track every source flow once");
  for (const requiredLevel of ["ready", "watch", "build"] as const) {
    assert.ok(levels.has(requiredLevel), `source readiness should include ${requiredLevel} work`);
  }

  for (const item of MARKETPLACE_SOURCE_READINESS) {
    assert.ok(flowIds.has(item.sourceFlowId), `${item.sourceFlowId} should reference a known source flow`);
    assert.ok(!seen.has(item.sourceFlowId), `${item.sourceFlowId} should have only one readiness row`);
    assert.ok(rails.has(item.ownerRail), `${item.sourceFlowId} references unknown owner rail ${item.ownerRail}`);
    assertFilled(item.launchQuestion, `${item.sourceFlowId}.launchQuestion`);
    assertFilled(item.nextAction, `${item.sourceFlowId}.nextAction`);
    assertFilled(item.publishProof, `${item.sourceFlowId}.publishProof`);
    assertFilled(item.automationGate, `${item.sourceFlowId}.automationGate`);
    assertFilled(item.rewardClose, `${item.sourceFlowId}.rewardClose`);
    assert.equal(
      getMarketplaceReadinessForSourceFlow(item.sourceFlowId)?.sourceFlowId,
      item.sourceFlowId,
      `${item.sourceFlowId} readiness helper should resolve the row`,
    );
    seen.add(item.sourceFlowId);
  }

  for (const flow of MARKETPLACE_SOURCE_FLOW_MATRIX) {
    assert.ok(seen.has(flow.id), `${flow.id} should be represented in source readiness`);
  }
});

test("derives launch tasks from source readiness with rail, proof, and mapped JCMOVES context", () => {
  const launchTasks = getMarketplaceLaunchTasks();
  const flowIds = new Set(MARKETPLACE_SOURCE_FLOW_MATRIX.map((flow) => flow.id));
  const readinessIds = new Set(MARKETPLACE_SOURCE_READINESS.map((item) => item.sourceFlowId));
  const actionTaskIds = new Set(MARKETPLACE_ACTION_TASKS.map((task) => task.id));

  assert.equal(launchTasks.length, flowIds.size, "launch task queue should contain one task per source flow");

  for (const task of launchTasks) {
    assert.ok(flowIds.has(task.sourceFlowId), `${task.id} should reference a known source flow`);
    assert.ok(readinessIds.has(task.sourceFlowId), `${task.id} should be backed by readiness data`);
    assertFilled(task.title, `${task.id}.title`);
    assertFilled(task.launchQuestion, `${task.id}.launchQuestion`);
    assertFilled(task.action, `${task.id}.action`);
    assertFilled(task.acceptanceCriteria, `${task.id}.acceptanceCriteria`);
    assertFilled(task.automationGate, `${task.id}.automationGate`);
    assertFilled(task.rewardClose, `${task.id}.rewardClose`);
    assertFilled(task.surfaces, `${task.id}.surfaces`);
    assert.ok(task.linkedActionTaskIds.length > 0, `${task.id} should link to at least one bonus/action task`);
    assert.ok(task.totalMappedBonusJcMoves >= 0, `${task.id} mapped JCMOVES cannot be negative`);
    assert.ok(task.completionBonusJcMoves > 0, `${task.id} should have a controlled completion bonus`);
    assert.ok(
      task.completionBonusJcMoves <= task.totalMappedBonusJcMoves || task.totalMappedBonusJcMoves === 0,
      `${task.id} launch bonus should stay below mapped operational task context when context exists`,
    );

    for (const linkedTaskId of task.linkedActionTaskIds) {
      assert.ok(actionTaskIds.has(linkedTaskId), `${task.id} references unknown action task ${linkedTaskId}`);
    }
  }

  assert.equal(
    getMarketplaceLaunchTasksForRail("platinum").every((task) => task.ownerRail === "platinum"),
    true,
    "rail filter should only return the requested owner rail",
  );
  assert.equal(
    getMarketplaceLaunchTasksForReadiness("build").every((task) => task.readiness === "build"),
    true,
    "readiness filter should only return the requested readiness state",
  );
});

test("resolves every action task into visible source play chips", () => {
  for (const task of MARKETPLACE_ACTION_TASKS) {
    const flows = getMarketplaceSourceFlowsForActionTask(task);
    assert.equal(flows.length, task.flowIds.length, `${task.id} should resolve every flow id`);
    assert.deepEqual(
      flows.map((flow) => flow.id),
      task.flowIds,
      `${task.id} source chips should preserve configured flow order`,
    );
  }
});

test("keeps the smart service price menu usable and tied to valid request shapes", () => {
  const shapeIds = new Set(MARKETPLACE_REQUEST_SHAPES.map((shape) => shape.id));
  const categoryIds = new Set(SERVICE_PRICE_MENU_CATEGORIES.map((category) => category.id));

  assert.ok(SERVICE_PRICE_MENU.length >= 20, "service price menu should cover the core launch paths");

  for (const task of SERVICE_PRICE_MENU) {
    assertFilled(task.id, "task.id");
    assertFilled(task.serviceCode, `${task.id}.serviceCode`);
    assertFilled(task.label, `${task.id}.label`);
    assertFilled(task.description, `${task.id}.description`);
    assertFilled(task.priceUnit, `${task.id}.priceUnit`);
    assertFilled(task.operationsSignal, `${task.id}.operationsSignal`);
    assert.ok(categoryIds.has(task.categoryId), `${task.id} references unknown category ${task.categoryId}`);
    assert.ok(shapeIds.has(task.shapeId), `${task.id} references unknown shape ${task.shapeId}`);
    assert.ok(task.priceMin > 0, `${task.id} must have a positive minimum estimate`);
    assert.ok(task.priceMax >= task.priceMin, `${task.id} maximum estimate cannot be below minimum`);
    assert.ok(task.defaultCrew >= 1, `${task.id} must suggest at least one worker`);
    assert.ok(task.defaultHours >= 1, `${task.id} must suggest at least one hour`);
    assert.ok(task.tags.length > 0, `${task.id} should have searchable tags`);
    assert.ok(task.customerNeeds.length > 0, `${task.id} should tell the intake what to ask for`);
    assert.match(formatServicePriceRange(task), /^\$[\d,]+-\$[\d,]+$/, `${task.id} should format a customer range`);
    assertFilled(sourceSignalForServicePriceMenuTask(task), `${task.id}.sourceSignal`);
  }
});

test("keeps each service menu category tied to the intended outside-source pattern", () => {
  const expectedSignals: Array<[string, string[]]> = [
    ["store_pickup", ["Target", "Walmart", "Google"]],
    ["donation_or_dump_run", ["Goodwill", "Craigslist", "Facebook"]],
    ["load_truck", ["MovingHelp", "MovingHelper", "U-Haul", "PODS"]],
    ["lawn_one_time", ["McDonald's", "Google", "Facebook", "JCMOVES"]],
    ["handyman_small_repair", ["Porch", "HireAHelper", "Yelp", "Google"]],
  ];

  for (const [taskId, references] of expectedSignals) {
    const task = SERVICE_PRICE_MENU.find((entry) => entry.id === taskId);
    assert.ok(task, `${taskId} should exist in the service price menu`);
    const signal = sourceSignalForServicePriceMenuTask(task!);
    for (const reference of references) {
      assert.ok(signal.includes(reference), `${taskId} source signal should include ${reference}`);
    }
  }
});

test("routes every service menu source signal into an operational source flow", () => {
  for (const task of SERVICE_PRICE_MENU) {
    const signal = sourceSignalForServicePriceMenuTask(task);
    const [flow] = getMarketplaceSourceFlowsForContext({
      source: signal,
      serviceCode: task.serviceCode,
      serviceLabel: task.label,
      limit: 1,
    });

    assert.ok(flow, `${task.id} source signal should resolve to an operational flow`);
    assert.ok(
      task.shapeId === flow.shapeIds[0] || flow.shapeIds.includes(task.shapeId),
      `${task.id} source signal should keep ${task.shapeId} in scope`,
    );
  }
});

test("routes service menu task codes to the same shape shown on the customer picker", () => {
  for (const task of SERVICE_PRICE_MENU) {
    const routed = getMarketplaceShapeForServiceCode(task.serviceCode);
    assert.equal(
      routed.id,
      task.shapeId,
      `${task.id} serviceCode ${task.serviceCode} should route to ${task.shapeId}`,
    );
  }
});

test("keeps common marketplace service aliases pointed at the intended operational card shape", () => {
  const examples: Array<[string, MarketplaceRequestShapeId]> = [
    ["moving", "moving_help"],
    ["load_unload", "moving_help"],
    ["ubox", "moving_help"],
    ["pack_unpack", "moving_help"],
    ["delivery", "delivery_reuse"],
    ["store_pickup", "delivery_reuse"],
    ["single_item", "delivery_reuse"],
    ["small_project_labor", "delivery_reuse"],
    ["lawn_care", "repeat_loop"],
    ["snow_removal", "repeat_loop"],
    ["junk_removal", "repeat_loop"],
    ["handyman", "repeat_loop"],
    ["roofing", "repeat_loop"],
    ["flooring", "repeat_loop"],
    ["painting", "repeat_loop"],
    ["demolition", "repeat_loop"],
  ];

  for (const [serviceCode, expectedShapeId] of examples) {
    assert.equal(
      getMarketplaceShapeForServiceCode(serviceCode).id,
      expectedShapeId,
      `${serviceCode} should route to ${expectedShapeId}`,
    );
  }
});

if (process.exitCode && process.exitCode !== 0) {
  console.error(`marketplaceShapes(): ${passed} test(s) passed before failure`);
} else {
  console.log(`marketplaceShapes(): ${passed} test(s) passed`);
}
