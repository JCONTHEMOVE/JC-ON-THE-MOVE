import crypto from "node:crypto";
import type { SquareClient } from "square";
import type { CommerceItem, CommercePromotion } from "@shared/commerceCatalog";
import {
  COMMERCE_MANAGED_OVERLAP_NAMES,
  activatePublication,
  catalogSnapshotHash,
  failPublication,
  getPublication,
  listSquareMappings,
  markPublicationPublishing,
  normalizeName,
  recordSquareMapping,
} from "./commerceCatalog";
import { pool } from "../db";
import { getSquareAccessToken, getSquareEnvironment } from "./squareConfig";

type SquareCatalogObject = any;

export type SquareCatalogChange = {
  action: "create" | "update" | "archive" | "unchanged";
  localType: "category" | "item" | "variation" | "promotion" | "external";
  localCode: string | null;
  name: string;
  squareObjectId: string | null;
  warning?: string;
};

export type CommerceSquareDiff = {
  environment: "sandbox" | "production";
  configured: boolean;
  counts: Record<SquareCatalogChange["action"], number>;
  changes: SquareCatalogChange[];
  generatedAt: string;
};

function squareConfigured(): boolean {
  return Boolean(getSquareAccessToken());
}

async function getSquareClient(): Promise<SquareClient> {
  const { SquareClient, SquareEnvironment } = await import("square");
  return new SquareClient({
    token: getSquareAccessToken(),
    environment: getSquareEnvironment() === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested));
}

function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(jsonSafe(payload))).digest("hex");
}

function tempId(type: string, code: string): string {
  return `#jc_${type}_${code.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80)}`;
}

export async function listAllSquareCatalogObjects(types = "ITEM,DISCOUNT,CATEGORY,CUSTOM_ATTRIBUTE_DEFINITION") {
  if (!squareConfigured()) return [] as SquareCatalogObject[];
  const client = await getSquareClient();
  const page = await client.catalog.list({ types });
  const objects: SquareCatalogObject[] = [];
  for await (const object of page) objects.push(object);
  return objects;
}

export async function listSquareCatalogForAdmin() {
  const objects = await listAllSquareCatalogObjects();
  return objects.filter((object) => object.type === "ITEM").map((object) => ({
    id: object.id,
    version: object.version?.toString?.() || null,
    name: object.itemData?.name || object.id,
    description: object.itemData?.descriptionPlaintext || object.itemData?.description || null,
    archived: Boolean(object.itemData?.isArchived),
    managed: Boolean(object.customAttributeValues?.jc_managed?.booleanValue),
    variations: (object.itemData?.variations || []).map((variation: any) => ({
      id: variation.id,
      version: variation.version?.toString?.() || null,
      name: variation.itemVariationData?.name || variation.id,
      pricingType: variation.itemVariationData?.pricingType || null,
      price: variation.itemVariationData?.priceMoney?.amount == null
        ? null
        : Number(variation.itemVariationData.priceMoney.amount) / 100,
    })),
  }));
}

function definitionObjects(remote: SquareCatalogObject[]) {
  const definitions = [
    { key: "jc_catalog_code", name: "JC Catalog Code", type: "STRING" },
    { key: "jc_managed", name: "JC Managed", type: "BOOLEAN" },
    { key: "jc_revision", name: "JC Catalog Revision", type: "STRING" },
  ];
  const ids: Record<string, string> = {};
  const creates: SquareCatalogObject[] = [];
  for (const definition of definitions) {
    const existing = remote.find((object) => (
      object.type === "CUSTOM_ATTRIBUTE_DEFINITION"
      && object.customAttributeDefinitionData?.key === definition.key
    ));
    if (existing) {
      ids[definition.key] = existing.id;
      continue;
    }
    const id = tempId("attribute", definition.key);
    ids[definition.key] = id;
    creates.push({
      type: "CUSTOM_ATTRIBUTE_DEFINITION",
      id,
      presentAtAllLocations: true,
      customAttributeDefinitionData: {
        type: definition.type,
        name: definition.name,
        key: definition.key,
        description: "Managed by the JC ON THE MOVE commerce catalog.",
        allowedObjectTypes: ["ITEM", "ITEM_VARIATION"],
        sellerVisibility: "SELLER_VISIBILITY_READ_WRITE_VALUES",
        appVisibility: "APP_VISIBILITY_READ_ONLY",
      },
    });
  }
  return { ids, creates };
}

function customAttributes(code: string, revision: number, definitionIds: Record<string, string>) {
  return {
    jc_catalog_code: {
      customAttributeDefinitionId: definitionIds.jc_catalog_code,
      key: "jc_catalog_code",
      type: "STRING",
      stringValue: code,
    },
    jc_managed: {
      customAttributeDefinitionId: definitionIds.jc_managed,
      key: "jc_managed",
      type: "BOOLEAN",
      booleanValue: true,
    },
    jc_revision: {
      customAttributeDefinitionId: definitionIds.jc_revision,
      key: "jc_revision",
      type: "STRING",
      stringValue: String(revision),
    },
  };
}

function variationPayload(input: {
  item: CommerceItem;
  variation: CommerceItem["variations"][number];
  id: string;
  remote?: SquareCatalogObject | null;
  revision: number;
  definitionIds: Record<string, string>;
}) {
  const { variation, remote } = input;
  const fixed = variation.price != null && !["variable", "quote"].includes(variation.pricingMode);
  return {
    ...(remote || {}),
    type: "ITEM_VARIATION",
    id: input.id,
    ...(remote?.version == null ? {} : { version: remote.version }),
    presentAtAllLocations: true,
    customAttributeValues: {
      ...(remote?.customAttributeValues || {}),
      ...customAttributes(variation.code, input.revision, input.definitionIds),
    },
    itemVariationData: {
      ...(remote?.itemVariationData || {}),
      name: variation.name,
      pricingType: fixed ? "FIXED_PRICING" : "VARIABLE_PRICING",
      ...(fixed ? { priceMoney: { amount: BigInt(Math.round(Number(variation.price) * 100)), currency: "USD" } } : { priceMoney: undefined }),
      trackInventory: false,
      sellable: true,
      stockable: false,
      userData: JSON.stringify({ jcCatalogCode: variation.code, jcRevision: input.revision }),
    },
  };
}

function itemPayload(input: {
  item: CommerceItem;
  id: string;
  remote?: SquareCatalogObject | null;
  variationObjects: SquareCatalogObject[];
  categoryId?: string | null;
  revision: number;
  definitionIds: Record<string, string>;
}) {
  const { item, remote } = input;
  return {
    ...(remote || {}),
    type: "ITEM",
    id: input.id,
    ...(remote?.version == null ? {} : { version: remote.version }),
    presentAtAllLocations: true,
    customAttributeValues: {
      ...(remote?.customAttributeValues || {}),
      ...customAttributes(item.code, input.revision, input.definitionIds),
    },
    itemData: {
      ...(remote?.itemData || {}),
      name: item.name,
      description: item.description || undefined,
      descriptionHtml: item.description ? `<p>${escapeSquareHtml(item.description)}</p>` : undefined,
      isTaxable: remote?.itemData?.isTaxable ?? false,
      isArchived: !item.active,
      productType: remote?.itemData?.productType || "REGULAR",
      variations: input.variationObjects,
      ...(input.categoryId ? { categories: [{ id: input.categoryId, ordinal: 0 }] } : {}),
    },
  };
}

function escapeSquareHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function promotionPayload(promotion: CommercePromotion, id: string, remote?: SquareCatalogObject | null) {
  return {
    ...(remote || {}),
    type: "DISCOUNT",
    id,
    ...(remote?.version == null ? {} : { version: remote.version }),
    presentAtAllLocations: true,
    discountData: {
      ...(remote?.discountData || {}),
      name: promotion.name,
      discountType: promotion.discountType === "percent" ? "FIXED_PERCENTAGE" : "FIXED_AMOUNT",
      ...(promotion.discountType === "percent"
        ? {
            percentage: String(promotion.value),
            maximumAmountMoney: promotion.maximumAmount == null ? undefined : {
              amount: BigInt(Math.round(promotion.maximumAmount * 100)), currency: "USD",
            },
            amountMoney: undefined,
          }
        : {
            amountMoney: { amount: BigInt(Math.round(promotion.value * 100)), currency: "USD" },
            percentage: undefined,
            maximumAmountMoney: undefined,
          }),
      modifyTaxBasis: "MODIFY_TAX_BASIS",
    },
  };
}

async function compileSquarePublication(snapshot: any, revision: number) {
  const [remote, mappingRows] = await Promise.all([listAllSquareCatalogObjects(), listSquareMappings()]);
  const remoteById = new Map<string, any>(remote.map((object) => [object.id, object]));
  const mappingByKey = new Map<string, any>((mappingRows as any[]).map((row: any) => [`${row.local_type}:${row.local_code}`, row]));
  const { ids: definitionIds, creates: definitionCreates } = definitionObjects(remote);
  const objects: SquareCatalogObject[] = [...definitionCreates];
  const changes: SquareCatalogChange[] = definitionCreates.map((object) => ({
    action: "create", localType: "external", localCode: object.customAttributeDefinitionData.key,
    name: object.customAttributeDefinitionData.name, squareObjectId: null,
  }));
  const localPayloadHashes = new Map<string, string>();
  const tempCodeById = new Map<string, { localType: "category" | "item" | "variation" | "promotion"; localCode: string; parentCode?: string }>();

  const categoryIds = new Map<string, string>();
  const categories = Array.from(new Set((snapshot.items as CommerceItem[]).map((item) => item.category))).sort();
  for (const category of categories) {
    const code = `category_${normalizeName(category).replace(/ /g, "_")}`;
    const mapping = mappingByKey.get(`category:${code}`);
    const remoteObject = mapping ? remoteById.get(mapping.square_object_id) : null;
    const id = remoteObject?.id || tempId("category", code);
    categoryIds.set(category, id);
    const payload = {
      ...(remoteObject || {}), type: "CATEGORY", id,
      ...(remoteObject?.version == null ? {} : { version: remoteObject.version }),
      presentAtAllLocations: true,
      categoryData: { ...(remoteObject?.categoryData || {}), name: category },
    };
    const payloadHash = hashPayload({ type: payload.type, categoryData: payload.categoryData });
    localPayloadHashes.set(`category:${code}`, payloadHash);
    const unchanged = mapping?.payload_hash === payloadHash && remoteObject;
    changes.push({ action: unchanged ? "unchanged" : remoteObject ? "update" : "create", localType: "category", localCode: code, name: category, squareObjectId: remoteObject?.id || null });
    if (!unchanged) objects.push(payload);
    if (!remoteObject) tempCodeById.set(id, { localType: "category", localCode: code });
  }

  for (const item of snapshot.items as CommerceItem[]) {
    const itemMapping = mappingByKey.get(`item:${item.code}`);
    const remoteItem = itemMapping ? remoteById.get(itemMapping.square_object_id) : null;
    const itemId = remoteItem?.id || tempId("item", item.code);
    const variationObjects: SquareCatalogObject[] = [];

    const localVariations = item.variations.length ? item.variations : [{
      code: `${item.code}_default`, itemCode: item.code, name: "Regular", description: item.description,
      pricingMode: item.pricingMode, unit: item.unit, price: item.price,
      discountEligible: item.discountEligible, publicVisible: item.publicVisible, active: item.active,
      sortOrder: 1, metadata: {},
    }];
    for (const variation of localVariations) {
      const variationMapping = mappingByKey.get(`variation:${variation.code}`);
      const remoteVariation = variationMapping ? remoteById.get(variationMapping.square_object_id) : null;
      const variationId = remoteVariation?.id || tempId("variation", variation.code);
      const payload = variationPayload({ item, variation, id: variationId, remote: remoteVariation, revision, definitionIds });
      variationObjects.push(payload);
      const payloadHash = hashPayload({ itemVariationData: payload.itemVariationData, customAttributeValues: payload.customAttributeValues });
      localPayloadHashes.set(`variation:${variation.code}`, payloadHash);
      if (!remoteVariation) tempCodeById.set(variationId, { localType: "variation", localCode: variation.code, parentCode: item.code });
    }

    const payload = itemPayload({ item, id: itemId, remote: remoteItem, variationObjects, categoryId: categoryIds.get(item.category), revision, definitionIds });
    const payloadHash = hashPayload({ itemData: payload.itemData, customAttributeValues: payload.customAttributeValues });
    localPayloadHashes.set(`item:${item.code}`, payloadHash);
    const unchanged = itemMapping?.payload_hash === payloadHash && remoteItem;
    changes.push({
      action: unchanged ? "unchanged" : remoteItem ? "update" : "create",
      localType: "item", localCode: item.code, name: item.name, squareObjectId: remoteItem?.id || null,
      warning: item.price == null && item.variations.every((variation) => variation.price == null)
        ? "Variable/quote pricing is set at invoice time." : undefined,
    });
    for (const variation of localVariations) {
      const mapping = mappingByKey.get(`variation:${variation.code}`);
      const remoteVariation = mapping ? remoteById.get(mapping.square_object_id) : null;
      const hash = localPayloadHashes.get(`variation:${variation.code}`)!;
      changes.push({
        action: mapping?.payload_hash === hash && remoteVariation ? "unchanged" : remoteVariation ? "update" : "create",
        localType: "variation", localCode: variation.code, name: `${item.name} — ${variation.name}`,
        squareObjectId: remoteVariation?.id || null,
      });
    }
    if (!unchanged) objects.push(payload);
    if (!remoteItem) tempCodeById.set(itemId, { localType: "item", localCode: item.code });
  }

  for (const promotion of (snapshot.promotions || []) as CommercePromotion[]) {
    if (!promotion.active) continue;
    const mapping = mappingByKey.get(`promotion:${promotion.code}`);
    const remotePromotion = mapping ? remoteById.get(mapping.square_object_id) : null;
    const id = remotePromotion?.id || tempId("promotion", promotion.code);
    const payload = promotionPayload(promotion, id, remotePromotion);
    const payloadHash = hashPayload(payload.discountData);
    localPayloadHashes.set(`promotion:${promotion.code}`, payloadHash);
    const unchanged = mapping?.payload_hash === payloadHash && remotePromotion;
    changes.push({ action: unchanged ? "unchanged" : remotePromotion ? "update" : "create", localType: "promotion", localCode: promotion.code, name: promotion.name, squareObjectId: remotePromotion?.id || null });
    if (!unchanged) objects.push(payload);
    if (!remotePromotion) tempCodeById.set(id, { localType: "promotion", localCode: promotion.code });
  }

  const mappedRemoteIds = new Set(mappingRows.map((row: any) => row.square_object_id));
  for (const object of remote) {
    if (object.type !== "ITEM" || object.itemData?.isArchived || mappedRemoteIds.has(object.id)) continue;
    if (!COMMERCE_MANAGED_OVERLAP_NAMES.has(normalizeName(object.itemData?.name))) continue;
    objects.push({ ...object, itemData: { ...object.itemData, isArchived: true } });
    changes.push({
      action: "archive", localType: "external", localCode: null,
      name: object.itemData?.name || object.id, squareObjectId: object.id,
      warning: "Existing overlapping Square service item; unrelated material items are preserved.",
    });
  }

  return { objects, changes, localPayloadHashes, tempCodeById };
}

function summarizeChanges(changes: SquareCatalogChange[]): CommerceSquareDiff["counts"] {
  return changes.reduce((counts, change) => {
    counts[change.action] += 1;
    return counts;
  }, { create: 0, update: 0, archive: 0, unchanged: 0 });
}

export async function previewSquareCatalogDiff(snapshot: unknown, revision: number): Promise<CommerceSquareDiff> {
  if (!squareConfigured()) {
    return {
      environment: getSquareEnvironment(),
      configured: false,
      counts: { create: 0, update: 0, archive: 0, unchanged: 0 },
      changes: [],
      generatedAt: new Date().toISOString(),
    };
  }
  const compiled = await compileSquarePublication(snapshot, revision);
  return {
    environment: getSquareEnvironment(),
    configured: true,
    counts: summarizeChanges(compiled.changes),
    changes: compiled.changes,
    generatedAt: new Date().toISOString(),
  };
}

export async function publishSquareCatalogPublication(publicationId: string, actorId: string | null) {
  const publication = await getPublication(publicationId);
  if (!publication) throw new Error("Catalog publication was not found");
  if (publication.status !== "previewed" && publication.status !== "failed") {
    throw new Error(`Catalog publication cannot be published from status ${publication.status}`);
  }
  if (!squareConfigured()) throw new Error("Square is not configured");
  if (catalogSnapshotHash(publication.snapshot) !== publication.snapshot_hash) {
    throw new Error("Catalog publication snapshot failed its integrity check");
  }

  await markPublicationPublishing(publicationId, actorId);
  try {
    const compiled = await compileSquarePublication(publication.snapshot, Number(publication.revision));
    const client = await getSquareClient();
    const changedObjects = compiled.objects;
    let response: any = { objects: [], idMappings: [] };
    if (changedObjects.length > 0) {
      response = await client.catalog.batchUpsert({
        idempotencyKey: publication.idempotency_key,
        batches: [{ objects: changedObjects }],
      } as any);
      if (response.errors?.length) throw new Error(`Square rejected the catalog publication: ${response.errors.map((error: any) => error.detail || error.code).join("; ")}`);
    }

    const permanentByTemp = new Map<string, string>((response.idMappings || [])
      .filter((mapping: any) => mapping.clientObjectId && mapping.objectId)
      .map((mapping: any) => [mapping.clientObjectId, mapping.objectId]));
    const returnedById = new Map<string, any>();
    for (const object of response.objects || []) {
      returnedById.set(object.id, object);
      for (const variation of object.itemData?.variations || []) returnedById.set(variation.id, variation);
    }

    for (const [temp, identity] of compiled.tempCodeById.entries()) {
      const permanent = permanentByTemp.get(temp);
      if (!permanent) continue;
      const returned = returnedById.get(permanent);
      await recordSquareMapping({
        localType: identity.localType,
        localCode: identity.localCode,
        squareObjectId: permanent,
        squareParentId: identity.parentCode ? permanentByTemp.get(tempId("item", identity.parentCode)) || null : null,
        squareVersion: returned?.version?.toString?.() || null,
        payloadHash: compiled.localPayloadHashes.get(`${identity.localType}:${identity.localCode}`) || null,
      });
    }
    for (const mapping of await listSquareMappings()) {
      const key = `${mapping.local_type}:${mapping.local_code}`;
      const returned = returnedById.get(mapping.square_object_id);
      const hash = compiled.localPayloadHashes.get(key);
      if (!hash) continue;
      await recordSquareMapping({
        localType: mapping.local_type,
        localCode: mapping.local_code,
        squareObjectId: mapping.square_object_id,
        squareParentId: mapping.square_parent_id,
        squareVersion: returned?.version?.toString?.() || mapping.square_version,
        payloadHash: hash,
      } as any);
    }
    await activatePublication(publicationId);
    return { ok: true, revision: Number(publication.revision), diff: summarizeChanges(compiled.changes) };
  } catch (error) {
    await failPublication(publicationId, error);
    throw error;
  }
}

export async function scanSquareCatalogDrift() {
  const [remote, mappings] = await Promise.all([listAllSquareCatalogObjects(), listSquareMappings()]);
  const remoteById = new Map<string, any>();
  for (const object of remote) {
    remoteById.set(object.id, object);
    for (const variation of object.itemData?.variations || []) remoteById.set(variation.id, variation);
  }
  const drift: Array<{ localType: string; localCode: string; status: string; squareObjectId: string }> = [];
  for (const mapping of mappings) {
    const object = remoteById.get(mapping.square_object_id);
    const status = !object ? "error" : object.version?.toString?.() !== mapping.square_version ? "drifted" : "synced";
    await pool.query(`
      UPDATE commerce_square_mappings SET sync_status=$2, last_error=$3, updated_at=now() WHERE id=$1
    `, [mapping.id, status, !object ? "Square object is missing or archived" : null]);
    if (status !== "synced") drift.push({ localType: mapping.local_type, localCode: mapping.local_code, status, squareObjectId: mapping.square_object_id });
  }
  return { checked: mappings.length, drift };
}
