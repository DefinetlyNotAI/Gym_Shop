import { z } from "zod";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/service";
import { appendDomainEvent } from "@/lib/events/outbox";

export type CatalogMedia={id:string;altEn:string;altAr:string;position:number};
export type CatalogVariant={id:string;sku:string;options:Record<string,string>;priceFils:string;available:number|null};
export type CatalogProduct = {
  id: string; slug: string; name_en: string; name_ar: string; description_en: string | null; description_ar: string | null;
  short_description_en:string|null;short_description_ar:string|null;brand:string|null;audience:string|null;activity:string|null;tags:string[];attributes:Record<string,unknown>;featured:boolean;units_sold:string;
  product_type: string; status: string; base_price_fils: string; variants: CatalogVariant[]; media?:CatalogMedia[]; size_guide?:{id:string;name:string;measurements:Record<string,unknown>}|null;
};

const productInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  nameEn: z.string().min(2).max(200), nameAr: z.string().min(2).max(200),
  shortDescriptionEn:z.string().max(500).optional(),shortDescriptionAr:z.string().max(500).optional(),brand:z.string().max(100).optional(),
  descriptionEn: z.string().max(10000).optional(), descriptionAr: z.string().max(10000).optional(),
  productType: z.string().min(2).max(80),audience:z.string().max(80).optional(),activity:z.string().max(80).optional(),tags:z.array(z.string().min(1).max(80)).max(30).default([]),attributes:z.record(z.string(),z.unknown()).default({}),basePriceFils: z.number().int().min(0),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN","ARCHIVED"]).default("DRAFT"),featured:z.boolean().default(false),sizeGuideId:z.string().uuid().optional(),categoryIds:z.array(z.string().uuid()).max(20).default([]),collectionIds:z.array(z.string().uuid()).max(20).default([]),seo:z.record(z.string(),z.unknown()).default({}),
  options: z.array(z.object({ name: z.string().min(1).max(60), values: z.array(z.string().min(1).max(80)).min(1) })).default([]),
  variants: z.array(z.object({ sku: z.string().min(2).max(80), optionValues: z.record(z.string(), z.string()), priceOverrideFils: z.number().int().min(0).optional(),compareAtFils:z.number().int().min(0).optional(),barcode:z.string().min(1).max(100).optional(),weightGrams:z.number().int().positive().optional(),enabled:z.boolean().default(true),purchasable:z.boolean().default(true),inventoryTracking: z.boolean().default(true), initialStock: z.number().int().min(0).default(0) })).min(1),
}).superRefine((value,context)=>{const names=value.options.map(option=>option.name);if(new Set(names).size!==names.length)context.addIssue({code:"custom",message:"Option names must be unique",path:["options"]});for(const [index,option] of value.options.entries())if(new Set(option.values).size!==option.values.length)context.addIssue({code:"custom",message:"Option values must be unique",path:["options",index,"values"]});for(const [index,variant] of value.variants.entries()){const keys=Object.keys(variant.optionValues);if(keys.length!==names.length||keys.some(key=>!names.includes(key)))context.addIssue({code:"custom",message:"Variant options must exactly match the declared dimensions",path:["variants",index,"optionValues"]});for(const option of value.options)if(!option.values.includes(variant.optionValues[option.name]))context.addIssue({code:"custom",message:`Invalid value for ${option.name}`,path:["variants",index,"optionValues",option.name]});}});

export async function listProducts(search = ""): Promise<CatalogProduct[]> {
  return withDatabaseClient(async (client) => {
    const result = await client.execute<CatalogProduct>(
      `SELECT product.id,product.slug,product.name_en,product.name_ar,product.short_description_en,product.short_description_ar,product.description_en,product.description_ar,product.brand,product.audience,product.activity,product.tags,product.attributes,product.featured,(SELECT COALESCE(SUM(line.quantity),0) FROM order_line AS line JOIN shop_order AS sold_order ON sold_order.id=line.order_id WHERE line.product_id=product.id AND sold_order.fulfillment_status='DELIVERED') AS units_sold,
              product.product_type,product.status,product.base_price_fils,
              (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',media.id,'altEn',media.alt_en,'altAr',media.alt_ar,'position',media.position) ORDER BY media.position),'[]') FROM media_object AS media WHERE media.owner_type='PRODUCT' AND media.owner_id=product.id AND media.access_class='PUBLIC' AND media.scan_status='CLEAN' AND media.deleted_at IS NULL) AS media,
              (SELECT jsonb_build_object('id',guide.id,'name',guide.name,'measurements',guide.measurements) FROM size_guide AS guide WHERE guide.id=product.size_guide_id) AS size_guide,
              COALESCE(jsonb_agg(jsonb_build_object('id',variant.id,'sku',variant.sku,'options',variant.option_values,
                'priceFils',COALESCE(variant.price_override_fils,product.base_price_fils),'available',
                CASE WHEN variant.inventory_tracking THEN GREATEST(balance.on_hand-balance.reserved,0) ELSE NULL END)
                ORDER BY variant.sku) FILTER (WHERE variant.id IS NOT NULL),'[]') AS variants
       FROM product
       LEFT JOIN product_variant AS variant ON variant.product_id=product.id AND variant.enabled AND variant.purchasable
       LEFT JOIN inventory_balance AS balance ON balance.variant_id=variant.id
       WHERE product.status='ACTIVE' AND ($1='' OR product.slug=$1 OR product.name_en ILIKE '%'||$1||'%' OR product.name_ar ILIKE '%'||$1||'%' OR product.description_en ILIKE '%'||$1||'%' OR product.description_ar ILIKE '%'||$1||'%' OR product.product_type ILIKE '%'||$1||'%' OR product.tags::text ILIKE '%'||$1||'%' OR variant.sku ILIKE '%'||$1||'%' OR variant.option_values::text ILIKE '%'||$1||'%' OR EXISTS(SELECT 1 FROM product_category JOIN category ON category.id=product_category.category_id WHERE product_category.product_id=product.id AND (category.name_en ILIKE '%'||$1||'%' OR category.name_ar ILIKE '%'||$1||'%')) OR EXISTS(SELECT 1 FROM product_collection JOIN collection ON collection.id=product_collection.collection_id WHERE product_collection.product_id=product.id AND (collection.name_en ILIKE '%'||$1||'%' OR collection.name_ar ILIKE '%'||$1||'%')))
       GROUP BY product.id ORDER BY product.published_at DESC NULLS LAST,product.created_at DESC LIMIT 100`,
      [search.trim()],
    );
    return result.rows;
  });
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  const products = await listProducts(slug);
  return products.find((product) => product.slug === slug) ?? null;
}
export async function listTaxonomy(kind:'category'|'collection'){return withDatabaseClient(async client=>(await client.execute(`SELECT id,slug,name_en,name_ar${kind==='collection'?',description_en,description_ar':''} FROM ${kind} WHERE active ORDER BY name_en`)).rows);}
export async function productsByTaxonomy(kind:'category'|'collection',slug:string){return withDatabaseClient(async client=>{const result=await client.execute<CatalogProduct>(`SELECT product.id,product.slug,product.name_en,product.name_ar,product.short_description_en,product.short_description_ar,product.description_en,product.description_ar,product.brand,product.audience,product.activity,product.tags,product.attributes,product.featured,(SELECT COALESCE(SUM(line.quantity),0) FROM order_line AS line JOIN shop_order AS sold_order ON sold_order.id=line.order_id WHERE line.product_id=product.id AND sold_order.fulfillment_status='DELIVERED') AS units_sold,product.product_type,product.status,product.base_price_fils,COALESCE(jsonb_agg(jsonb_build_object('id',variant.id,'sku',variant.sku,'options',variant.option_values,'priceFils',COALESCE(variant.price_override_fils,product.base_price_fils),'available',CASE WHEN variant.inventory_tracking THEN GREATEST(balance.on_hand-balance.reserved,0) ELSE NULL END) ORDER BY variant.sku) FILTER(WHERE variant.id IS NOT NULL),'[]') AS variants FROM ${kind} AS taxonomy JOIN product_${kind} AS membership ON membership.${kind}_id=taxonomy.id JOIN product ON product.id=membership.product_id LEFT JOIN product_variant AS variant ON variant.product_id=product.id AND variant.enabled AND variant.purchasable LEFT JOIN inventory_balance AS balance ON balance.variant_id=variant.id WHERE taxonomy.slug=$1 AND taxonomy.active AND product.status='ACTIVE' GROUP BY product.id ORDER BY product.created_at DESC`,[slug]);return result.rows;});}
export async function createTaxonomy(kind:'category'|'collection',input:{slug:string;nameEn:string;nameAr:string;descriptionEn?:string;descriptionAr?:string},actorId:string){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))throw new Error('SLUG_INVALID');return withTransaction(async client=>{const result=kind==='category'?await client.execute<{id:string}>("INSERT INTO category(slug,name_en,name_ar) VALUES($1,$2,$3) RETURNING id",[input.slug,input.nameEn,input.nameAr]):await client.execute<{id:string}>("INSERT INTO collection(slug,name_en,name_ar,description_en,description_ar) VALUES($1,$2,$3,$4,$5) RETURNING id",[input.slug,input.nameEn,input.nameAr,input.descriptionEn??null,input.descriptionAr??null]);await appendAudit(client,{actorId,action:`${kind}.created`,targetType:kind,targetId:result.rows[0].id,domain:'catalog',after:input});return result.rows[0];});}

export async function createProduct(raw: unknown, actorId: string) {
  const input = productInput.parse(raw);
  return withTransaction(async (client) => {
    const product = await client.execute<{ id: string; slug: string }>(
      `INSERT INTO product(slug,name_en,name_ar,short_description_en,short_description_ar,description_en,description_ar,brand,product_type,audience,activity,tags,attributes,base_price_fils,status,featured,size_guide_id,seo,created_by,updated_by,published_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18::jsonb,$19,$19,CASE WHEN $15='ACTIVE' THEN now() END) RETURNING id,slug`,
      [input.slug,input.nameEn,input.nameAr,input.shortDescriptionEn??null,input.shortDescriptionAr??null,input.descriptionEn??null,input.descriptionAr??null,input.brand??null,input.productType,input.audience??null,input.activity??null,input.tags,JSON.stringify(input.attributes),input.basePriceFils,input.status,input.featured,input.sizeGuideId??null,JSON.stringify(input.seo),actorId],
    );
    if(input.categoryIds.length){const categories=await client.execute("INSERT INTO product_category(product_id,category_id,primary_category) SELECT $1,id,row_number() OVER(ORDER BY array_position($2::uuid[],id))=1 FROM category WHERE id=ANY($2::uuid[]) RETURNING category_id",[product.rows[0].id,input.categoryIds]);if(categories.rowCount!==input.categoryIds.length)throw new Error("CATEGORY_INVALID");}
    if(input.collectionIds.length){const collections=await client.execute("INSERT INTO product_collection(product_id,collection_id) SELECT $1,id FROM collection WHERE id=ANY($2::uuid[]) RETURNING collection_id",[product.rows[0].id,input.collectionIds]);if(collections.rowCount!==input.collectionIds.length)throw new Error("COLLECTION_INVALID");}
    for (const [position, option] of input.options.entries()) {
      await client.execute("INSERT INTO product_option_definition(product_id,name,position,values) VALUES($1,$2,$3,$4::jsonb)", [product.rows[0].id,option.name,position,JSON.stringify(option.values)]);
    }
    for (const variant of input.variants) {
      const created = await client.execute<{ id: string }>(
        `INSERT INTO product_variant(product_id,sku,option_values,price_override_fils,compare_at_fils,barcode,weight_grams,enabled,purchasable,inventory_tracking)
         VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [product.rows[0].id,variant.sku,JSON.stringify(variant.optionValues),variant.priceOverrideFils??null,variant.compareAtFils??null,variant.barcode??null,variant.weightGrams??null,variant.enabled,variant.purchasable,variant.inventoryTracking],
      );
      await client.execute("INSERT INTO inventory_balance(variant_id,on_hand) VALUES($1,$2)", [created.rows[0].id,variant.initialStock]);
      if (variant.initialStock > 0) await client.execute(
        `INSERT INTO stock_movement(variant_id,kind,on_hand_delta,on_hand_after,reserved_after,source_type,source_id,actor_id,reason)
         VALUES($1,'RESTOCK',$2,$2,0,'PRODUCT_CREATE',$3,$4,'Initial stock')`, [created.rows[0].id,variant.initialStock,product.rows[0].id,actorId],
      );
    }
    await appendAudit(client,{actorId,action:"product.created",targetType:"product",targetId:product.rows[0].id,domain:"catalog",after:{slug:input.slug,status:input.status}});
    await appendDomainEvent(client,{eventType:"catalog.product.created.v1",aggregateType:"product",aggregateId:product.rows[0].id,payload:{productId:product.rows[0].id}});
    return product.rows[0];
  });
}
