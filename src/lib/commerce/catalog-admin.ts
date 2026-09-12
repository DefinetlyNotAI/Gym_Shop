import { z } from "zod";
import { appendAudit } from "@/lib/audit/service";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";

/** Staff-safe editing data: no storage keys or other owners' uploads. */
export async function getStaffCatalog(actorId: string) {
  return withDatabaseClient(async (client) => {
    const products = (await client.execute<{ id: string; [key: string]: unknown }>(`
      SELECT product.id,product.slug,product.name_en,product.name_ar,
        product.description_en,product.description_ar,product.product_type,
        product.status,product.base_price_fils,product.featured,product.size_guide_id,
        COALESCE((SELECT jsonb_agg(category_id ORDER BY primary_category DESC,category_id) FROM product_category WHERE product_id=product.id),'[]') AS "categoryIds",
        COALESCE((SELECT jsonb_agg(collection_id ORDER BY collection_id) FROM product_collection WHERE product_id=product.id),'[]') AS "collectionIds",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',variant.id,'sku',variant.sku,'options',variant.option_values,
          'enabled',variant.enabled,'purchasable',variant.purchasable,'inventoryTracking',variant.inventory_tracking,
          'priceOverrideFils',variant.price_override_fils,'compareAtFils',variant.compare_at_fils,'barcode',variant.barcode,'weightGrams',variant.weight_grams) ORDER BY variant.sku)
          FROM product_variant AS variant WHERE variant.product_id=product.id),'[]') AS variants,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',media.id,'altEn',media.alt_en,'altAr',media.alt_ar,'position',media.position) ORDER BY media.position,media.id)
          FROM media_object AS media WHERE media.owner_type='PRODUCT' AND media.owner_id=product.id AND media.access_class='PUBLIC' AND media.scan_status='CLEAN' AND media.deleted_at IS NULL),'[]') AS media
      FROM product ORDER BY product.updated_at DESC,product.id`)).rows;
    const categories = (await client.execute("SELECT id,slug,name_en,name_ar,active FROM category ORDER BY name_en,id")).rows;
    const collections = (await client.execute("SELECT id,slug,name_en,name_ar,active FROM collection ORDER BY name_en,id")).rows;
    const sizeGuides = (await client.execute("SELECT id,name,measurements FROM size_guide ORDER BY name,id")).rows;
    const uploads = (await client.execute<{ id: string; [key: string]: unknown }>("SELECT id,verified_mime,scan_status FROM media_object WHERE owner_type='ACCOUNT_UPLOAD' AND owner_id=$1 AND deleted_at IS NULL AND verified_mime IN ('image/jpeg','image/png','image/webp') ORDER BY created_at DESC LIMIT 50", [actorId])).rows;
    return { products, categories, collections, sizeGuides, uploads };
  });
}

const sizeGuide = z.object({ name: z.string().min(2).max(100), measurements: z.record(z.string(), z.unknown()) });
export async function createSizeGuide(actorId: string, raw: unknown) { const input = sizeGuide.parse(raw); return withTransaction(async (client) => { const row = (await client.execute<{ id: string }>("INSERT INTO size_guide(name,measurements) VALUES($1,$2::jsonb) RETURNING id", [input.name, JSON.stringify(input.measurements)])).rows[0]; await appendAudit(client, { actorId, action: "size_guide.created", targetType: "size_guide", targetId: row.id, domain: "catalog", after: input }); return row; }); }

const variantEdit = z.object({ id: z.string().uuid(), sku: z.string().min(2).max(80).optional(), optionValues: z.record(z.string(), z.string()).optional(), priceOverrideFils: z.number().int().nonnegative().nullable().optional(), compareAtFils: z.number().int().nonnegative().nullable().optional(), barcode: z.string().min(1).max(100).nullable().optional(), weightGrams: z.number().int().positive().nullable().optional(), enabled: z.boolean().optional(), purchasable: z.boolean().optional(), inventoryTracking: z.boolean().optional() });
const edit = z.object({
  nameEn: z.string().min(2).max(200).optional(), nameAr: z.string().min(2).max(200).optional(), shortDescriptionEn: z.string().max(500).nullable().optional(), shortDescriptionAr: z.string().max(500).nullable().optional(),
  descriptionEn: z.string().max(10000).nullable().optional(), descriptionAr: z.string().max(10000).nullable().optional(), brand: z.string().max(100).nullable().optional(), productType: z.string().min(2).max(80).optional(), audience: z.string().max(80).nullable().optional(), activity: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).max(30).optional(), attributes: z.record(z.string(), z.unknown()).optional(), seo: z.record(z.string(), z.unknown()).optional(), status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "ARCHIVED"]).optional(), featured:z.boolean().optional(),basePriceFils: z.number().int().nonnegative().optional(), sizeGuideId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).max(20).optional(), collectionIds: z.array(z.string().uuid()).max(20).optional(), variants: z.array(variantEdit).max(100).optional(),
}).refine((input) => Object.keys(input).length > 0);

export async function editProduct(productId: string, actorId: string, raw: unknown) {
  const input = edit.parse(raw);
  return withTransaction(async (client) => {
    const before = (await client.execute("SELECT name_en,name_ar,short_description_en,short_description_ar,description_en,description_ar,brand,product_type,audience,activity,tags,attributes,seo,status,featured,base_price_fils,size_guide_id FROM product WHERE id=$1 FOR UPDATE", [productId])).rows[0];
    if (!before) throw new Error("PRODUCT_NOT_FOUND");
    await client.execute(`UPDATE product SET name_en=COALESCE($2,name_en),name_ar=COALESCE($3,name_ar),short_description_en=CASE WHEN $4 THEN $5 ELSE short_description_en END,short_description_ar=CASE WHEN $6 THEN $7 ELSE short_description_ar END,description_en=CASE WHEN $8 THEN $9 ELSE description_en END,description_ar=CASE WHEN $10 THEN $11 ELSE description_ar END,brand=CASE WHEN $12 THEN $13 ELSE brand END,product_type=COALESCE($14,product_type),audience=CASE WHEN $15 THEN $16 ELSE audience END,activity=CASE WHEN $17 THEN $18 ELSE activity END,tags=COALESCE($19,tags),attributes=COALESCE($20::jsonb,attributes),seo=COALESCE($21::jsonb,seo),status=COALESCE($22,status),base_price_fils=COALESCE($23,base_price_fils),size_guide_id=CASE WHEN $24 THEN $25 ELSE size_guide_id END,published_at=CASE WHEN $22='ACTIVE' AND published_at IS NULL THEN now() ELSE published_at END,updated_by=$26,featured=COALESCE($27,featured),updated_at=now() WHERE id=$1`, [productId, input.nameEn ?? null, input.nameAr ?? null, Object.hasOwn(input, "shortDescriptionEn"), input.shortDescriptionEn ?? null, Object.hasOwn(input, "shortDescriptionAr"), input.shortDescriptionAr ?? null, Object.hasOwn(input, "descriptionEn"), input.descriptionEn ?? null, Object.hasOwn(input, "descriptionAr"), input.descriptionAr ?? null, Object.hasOwn(input, "brand"), input.brand ?? null, input.productType ?? null, Object.hasOwn(input, "audience"), input.audience ?? null, Object.hasOwn(input, "activity"), input.activity ?? null, input.tags ?? null, input.attributes ? JSON.stringify(input.attributes) : null, input.seo ? JSON.stringify(input.seo) : null, input.status ?? null, input.basePriceFils ?? null, Object.hasOwn(input, "sizeGuideId"), input.sizeGuideId ?? null, actorId,input.featured??null]);
    if (input.categoryIds) { await client.execute("DELETE FROM product_category WHERE product_id=$1", [productId]); const rows = await client.execute("INSERT INTO product_category(product_id,category_id,primary_category) SELECT $1,id,row_number() OVER(ORDER BY array_position($2::uuid[],id))=1 FROM category WHERE id=ANY($2::uuid[]) RETURNING category_id", [productId, input.categoryIds]); if (rows.rowCount !== input.categoryIds.length) throw new Error("CATEGORY_INVALID"); }
    if (input.collectionIds) { await client.execute("DELETE FROM product_collection WHERE product_id=$1", [productId]); const rows = await client.execute("INSERT INTO product_collection(product_id,collection_id) SELECT $1,id FROM collection WHERE id=ANY($2::uuid[]) RETURNING collection_id", [productId, input.collectionIds]); if (rows.rowCount !== input.collectionIds.length) throw new Error("COLLECTION_INVALID"); }
    const definitions = await client.execute<{ name: string; values: string[] }>("SELECT name,ARRAY(SELECT jsonb_array_elements_text(values)) AS values FROM product_option_definition WHERE product_id=$1 ORDER BY position", [productId]);
    for (const variant of input.variants ?? []) {
      if (variant.optionValues) { const keys = Object.keys(variant.optionValues); if (keys.length !== definitions.rows.length || definitions.rows.some((definition) => !keys.includes(definition.name) || !definition.values.includes(variant.optionValues![definition.name]))) throw new Error("VARIANT_OPTIONS_INVALID"); }
      const changed = await client.execute(`UPDATE product_variant SET sku=COALESCE($3,sku),option_values=COALESCE($4::jsonb,option_values),price_override_fils=CASE WHEN $5 THEN $6 ELSE price_override_fils END,compare_at_fils=CASE WHEN $7 THEN $8 ELSE compare_at_fils END,barcode=CASE WHEN $9 THEN $10 ELSE barcode END,weight_grams=CASE WHEN $11 THEN $12 ELSE weight_grams END,enabled=COALESCE($13,enabled),purchasable=COALESCE($14,purchasable),inventory_tracking=COALESCE($15,inventory_tracking),updated_at=now() WHERE id=$1 AND product_id=$2`, [variant.id, productId, variant.sku ?? null, variant.optionValues ? JSON.stringify(variant.optionValues) : null, Object.hasOwn(variant, "priceOverrideFils"), variant.priceOverrideFils ?? null, Object.hasOwn(variant, "compareAtFils"), variant.compareAtFils ?? null, Object.hasOwn(variant, "barcode"), variant.barcode ?? null, Object.hasOwn(variant, "weightGrams"), variant.weightGrams ?? null, variant.enabled ?? null, variant.purchasable ?? null, variant.inventoryTracking ?? null]);
      if (!changed.rowCount) throw new Error("VARIANT_NOT_FOUND");
    }
    await appendAudit(client, { actorId, action: "product.updated", targetType: "product", targetId: productId, domain: "catalog", before, after: input });
    return { updated: true };
  });
}

const media = z.object({ mediaId: z.string().uuid(), productId: z.string().uuid(), altEn: z.string().min(1).max(300), altAr: z.string().min(1).max(300), position: z.number().int().min(0).max(100) });
export async function publishProductMedia(actorId: string, raw: unknown) { const input = media.parse(raw); return withTransaction(async (client) => { const product = await client.execute("SELECT 1 FROM product WHERE id=$1", [input.productId]); if (!product.rowCount) throw new Error("PRODUCT_NOT_FOUND"); const updated = await client.execute("UPDATE media_object SET owner_type='PRODUCT',owner_id=$3,access_class='PUBLIC',alt_en=$4,alt_ar=$5,position=$6 WHERE id=$1 AND owner_type='ACCOUNT_UPLOAD' AND owner_id=$2 AND scan_status='CLEAN' AND verified_mime IN ('image/jpeg','image/png','image/webp') AND deleted_at IS NULL", [input.mediaId, actorId, input.productId, input.altEn, input.altAr, input.position]); if (!updated.rowCount) throw new Error("MEDIA_NOT_READY"); await appendAudit(client, { actorId, action: "product.media.published", targetType: "media_object", targetId: input.mediaId, domain: "catalog", after: { productId: input.productId, position: input.position } }); return { published: true }; }); }
