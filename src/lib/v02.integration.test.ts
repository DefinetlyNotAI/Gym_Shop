import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/db/client";

let database: PGlite;
let client: DatabaseClient;
let orm: ReturnType<typeof drizzlePglite>;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    withDatabaseClient: async <T>(work: (databaseClient: DatabaseClient) => Promise<T>) => work(client),
    withTransaction: async <T>(work: (databaseClient: DatabaseClient) => Promise<T>) =>
      orm.transaction((transaction) => work(actual.createDatabaseClient(transaction))),
  };
});

import { checkout, quoteSelectedCart } from "@/lib/commerce/orders";
import { createDatabaseClient } from "@/lib/db/client";
import {
  createCampaign,
  duplicateCampaign,
  listCampaigns,
  updateCampaignLifecycle,
  updatePromotionRule,
} from "@/lib/pricing/admin";
import { loadPricingRulesForQuote } from "@/lib/pricing/service";

async function tableNames(names: string[]) {
  const result = await client.execute<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name",
    [names],
  );
  return result.rows.map((row) => row.table_name);
}

describe("v0.2 release journeys", () => {
  beforeAll(async () => {
    process.env.APP_ENV = "test";
    database = new PGlite({ extensions: { pgcrypto } });
    await database.waitReady;
    orm = drizzlePglite({ client: database });
    client = createDatabaseClient(orm);
    const migrationDirectory = resolve("db/migrations");
    for (const filename of (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort()) {
      await client.executeRaw(await readFile(resolve(migrationDirectory, filename), "utf8"));
    }
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("installs the R02-01 pricing and campaign persistence contract", async () => {
    const requiredTables = [
      "account_group",
      "account_group_member",
      "campaign",
      "promotion_code",
      "promotion_rule",
      "promotion_scope",
      "promotion_usage",
    ];

    expect(await tableNames(requiredTables)).toEqual(requiredTables);
    const permission = await client.execute<{ id: string }>("SELECT id FROM permission WHERE id='promotions.manage'");
    expect(permission.rows).toEqual([{ id: "promotions.manage" }]);
  });

  it("quotes the selected cart with the winning sale and mutually permitted coupon", async () => {
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('pricing@v02.test','hash','Pricing Buyer','ACTIVE',now(),now()) RETURNING id",
    );
    const zone = await client.execute<{ id: string }>(
      "INSERT INTO delivery_zone(name_en,name_ar,fee_fils,eta_min_days,eta_max_days,policy_reviewed) VALUES('Pricing Zone','منطقة التسعير',0,1,1,true) RETURNING id",
    );
    const product = await client.execute<{ id: string }>(
      "INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('pricing-product','Pricing product','منتج التسعير','equipment','ACTIVE',100000) RETURNING id",
    );
    const variant = await client.execute<{ id: string }>(
      "INSERT INTO product_variant(product_id,sku) VALUES($1,'PRICE-001') RETURNING id",
      [product.rows[0].id],
    );
    await client.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,5,0)", [variant.rows[0].id]);
    const cart = await client.execute<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) RETURNING id", [account.rows[0].id]);
    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [cart.rows[0].id, variant.rows[0].id]);
    await client.execute(
      `INSERT INTO promotion_rule(id,internal_name,name_en,name_ar,enabled,rule_kind,application_method,reduction_kind,reduction_value,priority,allow_coupon_combination)
       VALUES('00000000-0000-4000-8000-000000000201','Twenty percent','Twenty percent','عشرون بالمئة',true,'SALE','AUTOMATIC','PERCENTAGE',2000,10,true),
             ('00000000-0000-4000-8000-000000000202','Ten percent','Ten percent','عشرة بالمئة',true,'COUPON','MANUAL','PERCENTAGE',1000,10,false)`,
    );
    await client.execute(
      "UPDATE promotion_rule SET allow_sale_combination=true WHERE id='00000000-0000-4000-8000-000000000202'",
    );
    await client.execute(
      "INSERT INTO promotion_code(rule_id,code) VALUES('00000000-0000-4000-8000-000000000202','SAVE10')",
    );

    const quote = await quoteSelectedCart(account.rows[0].id, zone.rows[0].id, { couponCode: "save10" });

    expect(quote).toMatchObject({ merchandiseFils: 100_000, discountFils: 28_000, totalFils: 72_000 });
    expect(quote.appliedRules.map((rule: { id: string }) => rule.id)).toEqual([
      "00000000-0000-4000-8000-000000000201",
      "00000000-0000-4000-8000-000000000202",
    ]);

    const missingCoupon = await quoteSelectedCart(account.rows[0].id, zone.rows[0].id, { couponCode: "MISSING" });
    expect(missingCoupon.discountFils).toBe(20_000);
    expect(missingCoupon.rejections).toContainEqual({ ruleId: "coupon:MISSING", code: "COUPON_NOT_FOUND" });
  });

  it("rejects rules outside their scope, account eligibility, or Amman schedule", async () => {
    await client.execute("UPDATE promotion_rule SET enabled=false");
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES('ineligible@v02.test','hash','Ineligible Buyer','ACTIVE') RETURNING id",
    );
    const zone = await client.execute<{ id: string }>(
      "INSERT INTO delivery_zone(name_en,name_ar,fee_fils,eta_min_days,eta_max_days,policy_reviewed) VALUES('Eligibility Zone','منطقة الأهلية',0,1,1,true) RETURNING id",
    );
    const product = await client.execute<{ id: string }>(
      "INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('eligibility-product','Eligibility product','منتج الأهلية','equipment','ACTIVE',50000) RETURNING id",
    );
    const otherProduct = await client.execute<{ id: string }>(
      "INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('other-scope-product','Other scope','نطاق آخر','equipment','ACTIVE',50000) RETURNING id",
    );
    const variant = await client.execute<{ id: string }>(
      "INSERT INTO product_variant(product_id,sku) VALUES($1,'ELIGIBLE-001') RETURNING id",
      [product.rows[0].id],
    );
    await client.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,5,0)", [variant.rows[0].id]);
    const cart = await client.execute<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) RETURNING id", [account.rows[0].id]);
    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [cart.rows[0].id, variant.rows[0].id]);
    const excludedWeekday = await client.execute<{ weekday: number }>(
      "SELECT ((extract(isodow FROM now() AT TIME ZONE 'Asia/Amman')::int % 7) + 1) AS weekday",
    );
    await client.execute(
      `INSERT INTO promotion_rule(id,internal_name,name_en,name_ar,enabled,rule_kind,application_method,reduction_kind,reduction_value,priority,eligibility,weekdays)
       VALUES('00000000-0000-4000-8000-000000000221','Other product','Other product','منتج آخر',true,'SALE','AUTOMATIC','PERCENTAGE',5000,30,'{}'::jsonb,ARRAY[]::smallint[]),
             ('00000000-0000-4000-8000-000000000222','Verified only','Verified only','للموثقين',true,'SALE','AUTOMATIC','PERCENTAGE',4000,20,'{\"verified\":true}'::jsonb,ARRAY[]::smallint[]),
             ('00000000-0000-4000-8000-000000000223','Wrong weekday','Wrong weekday','يوم آخر',true,'SALE','AUTOMATIC','PERCENTAGE',3000,10,'{}'::jsonb,ARRAY[$1]::smallint[])`,
      [excludedWeekday.rows[0].weekday],
    );
    await client.execute(
      "INSERT INTO promotion_scope(rule_id,effect,scope_type,scope_id) VALUES('00000000-0000-4000-8000-000000000221','INCLUDE','PRODUCT',$1)",
      [otherProduct.rows[0].id],
    );

    const quote = await quoteSelectedCart(account.rows[0].id, zone.rows[0].id);

    expect(quote.discountFils).toBe(0);
    expect(quote.appliedRules).toEqual([]);
    expect(quote.rejections).toEqual(expect.arrayContaining([
      { ruleId: "00000000-0000-4000-8000-000000000221", code: "SCOPE_NOT_ELIGIBLE" },
      { ruleId: "00000000-0000-4000-8000-000000000222", code: "ACCOUNT_NOT_ELIGIBLE" },
      { ruleId: "00000000-0000-4000-8000-000000000223", code: "SCHEDULE_INACTIVE" },
    ]));
  });

  it("rejects a coupon assigned to a different account", async () => {
    const assignedAccount = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES('assigned-coupon@v02.test','hash','Assigned Buyer','ACTIVE') RETURNING id",
    );
    const requestingAccount = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES('other-coupon@v02.test','hash','Other Buyer','ACTIVE') RETURNING id",
    );
    await client.execute(
      `INSERT INTO promotion_rule(id,internal_name,name_en,name_ar,enabled,rule_kind,application_method,reduction_kind,reduction_value)
       VALUES('00000000-0000-4000-8000-000000000224','Assigned coupon','Assigned coupon','قسيمة مخصصة',true,'COUPON','MANUAL','FIXED',1000)`,
    );
    await client.execute(
      "INSERT INTO promotion_code(rule_id,code,assigned_account_id) VALUES('00000000-0000-4000-8000-000000000224','ASSIGNED',$1)",
      [assignedAccount.rows[0].id],
    );

    const rules = await loadPricingRulesForQuote(client, {
      accountId: requestingAccount.rows[0].id,
      couponCode: "ASSIGNED",
      lines: [{
        lineId: "line-assigned-coupon",
        productId: "00000000-0000-4000-8000-000000000001",
        variantId: "00000000-0000-4000-8000-000000000002",
        categoryIds: [],
        collectionIds: [],
        quantity: 1,
      }],
    });

    expect(rules.coupons).toEqual([]);
    expect(rules.rejections).toContainEqual({
      ruleId: "00000000-0000-4000-8000-000000000224",
      code: "COUPON_ASSIGNED_ACCOUNT_MISMATCH",
    });
  });

  it("snapshots pricing and consumes a globally limited coupon atomically at COD checkout", async () => {
    await client.execute("UPDATE promotion_rule SET enabled=false");
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('checkout-pricing@v02.test','hash','Checkout Pricing Buyer','ACTIVE',now(),now()) RETURNING id",
    );
    const zone = await client.execute<{ id: string }>(
      "INSERT INTO delivery_zone(name_en,name_ar,fee_fils,eta_min_days,eta_max_days,policy_reviewed) VALUES('Checkout Zone','منطقة الدفع',3000,1,1,true) RETURNING id",
    );
    const window = await client.execute<{ id: string }>(
      "INSERT INTO delivery_window(zone_id,weekday,starts_at,ends_at,capacity) VALUES($1,0,'09:00','13:00',5) RETURNING id",
      [zone.rows[0].id],
    );
    const terms = await client.execute<{ id: string }>(
      "INSERT INTO terms_document(kind,version,language,title,body,content_hash,published_at) VALUES('TERMS','v0.2','en','Terms','Pricing checkout terms','v02-pricing',now()) RETURNING id",
    );
    const product = await client.execute<{ id: string }>(
      "INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('checkout-pricing-product','Checkout pricing product','منتج تسعير الدفع','equipment','ACTIVE',100000) RETURNING id",
    );
    const variant = await client.execute<{ id: string }>(
      "INSERT INTO product_variant(product_id,sku) VALUES($1,'PRICE-CHECKOUT-001') RETURNING id",
      [product.rows[0].id],
    );
    await client.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,5,0)", [variant.rows[0].id]);
    const cart = await client.execute<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) RETURNING id", [account.rows[0].id]);
    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [cart.rows[0].id, variant.rows[0].id]);
    await client.execute(
      `INSERT INTO promotion_rule(id,internal_name,name_en,name_ar,enabled,rule_kind,application_method,reduction_kind,reduction_value,priority,allow_coupon_combination)
       VALUES('00000000-0000-4000-8000-000000000211','Checkout twenty','Checkout twenty','خصم عشرين',true,'SALE','AUTOMATIC','PERCENTAGE',2000,10,true),
             ('00000000-0000-4000-8000-000000000212','Checkout ten','Checkout ten','خصم عشرة',true,'COUPON','MANUAL','PERCENTAGE',1000,10,false)`,
    );
    await client.execute(
      "UPDATE promotion_rule SET allow_sale_combination=true,maximum_uses_global=1 WHERE id='00000000-0000-4000-8000-000000000212'",
    );
    await client.execute(
      "INSERT INTO promotion_code(rule_id,code) VALUES('00000000-0000-4000-8000-000000000212','ONCE10')",
    );
    await client.execute("UPDATE app_setting SET value='\"NONE_REVIEWED\"'::jsonb WHERE key='checkout.tax_policy'");
    await client.execute("UPDATE app_setting SET value='true'::jsonb WHERE key='delivery.cod_redelivery_policy_reviewed'");

    const result = await checkout(account.rows[0].id, {
      paymentMethod: "COD",
      fulfillmentMode: "DELIVERY",
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Checkout Buyer", phone: "+962790000100", city: "Amman", area: "Abdoun", street: "Pricing Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey: "v02-pricing-checkout-once",
      doorstepAuthorized: false,
      couponCode: "once10",
    });

    expect(result.totalFils).toBe(75_000);
    const stored = await client.execute<{ discount_fils: string; quote_snapshot: { appliedRules: { id: string }[] } }>(
      "SELECT discount_fils,quote_snapshot FROM shop_order WHERE public_id=$1",
      [result.orderId],
    );
    expect(Number(stored.rows[0].discount_fils)).toBe(28_000);
    expect(stored.rows[0].quote_snapshot.appliedRules.map((rule) => rule.id)).toContain("00000000-0000-4000-8000-000000000212");
    const usage = await client.execute<{ state: string; reduction_fils: string | number }>(
      "SELECT state,reduction_fils FROM promotion_usage WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1) ORDER BY reduction_fils DESC",
      [result.orderId],
    );
    expect(usage.rows.map((row) => ({ state: row.state, reductionFils: Number(row.reduction_fils) }))).toEqual([
      { state: "CONSUMED", reductionFils: 20_000 },
      { state: "CONSUMED", reductionFils: 8_000 },
    ]);
    const replay = await checkout(account.rows[0].id, {
      paymentMethod: "COD",
      fulfillmentMode: "DELIVERY",
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Checkout Buyer", phone: "+962790000100", city: "Amman", area: "Abdoun", street: "Pricing Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey: "v02-pricing-checkout-once",
      doorstepAuthorized: false,
      couponCode: "once10",
    });
    expect(replay).toEqual(result);
    const replayUsage = await client.execute<{ count: number }>(
      "SELECT count(*)::int AS count FROM promotion_usage WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1)",
      [result.orderId],
    );
    expect(replayUsage.rows[0].count).toBe(2);

    const secondAccount = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('checkout-pricing-2@v02.test','hash','Second Pricing Buyer','ACTIVE',now(),now()) RETURNING id",
    );
    const secondCart = await client.execute<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) RETURNING id", [secondAccount.rows[0].id]);
    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [secondCart.rows[0].id, variant.rows[0].id]);
    const secondCheckout = (couponCode: string, idempotencyKey: string) => checkout(secondAccount.rows[0].id, {
      paymentMethod: "COD" as const,
      fulfillmentMode: "DELIVERY" as const,
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Second Buyer", phone: "+962790000101", city: "Amman", area: "Abdoun", street: "Pricing Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey,
      doorstepAuthorized: false,
      couponCode,
    });
    await expect(secondCheckout("BADCODE", "v02-pricing-invalid-code")).rejects.toThrow("COUPON_NOT_FOUND");
    await expect(checkout(secondAccount.rows[0].id, {
      paymentMethod: "COD",
      fulfillmentMode: "DELIVERY",
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Second Buyer", phone: "+962790000101", city: "Amman", area: "Abdoun", street: "Pricing Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey: "v02-pricing-checkout-twice",
      doorstepAuthorized: false,
      couponCode: "ONCE10",
    })).rejects.toThrow("PROMOTION_GLOBAL_LIMIT_REACHED");
    const rolledBackOrder = await client.execute<{ count: number }>(
      "SELECT count(*)::int AS count FROM shop_order WHERE account_id=$1",
      [secondAccount.rows[0].id],
    );
    expect(rolledBackOrder.rows[0].count).toBe(0);
  });

  it("creates auditable campaigns and versions promotion edits", async () => {
    const actor = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('promotion-admin@v02.test','hash','Promotion Admin','ACTIVE',now(),now()) RETURNING id",
    );

    const campaign = await createCampaign(actor.rows[0].id, {
      internalName: "Autumn launch",
      nameEn: "Autumn launch",
      nameAr: "إطلاق الخريف",
      descriptionEn: "Launch campaign",
      descriptionAr: "حملة الإطلاق",
      status: "DRAFT",
      rules: [{
        internalName: "Launch sale",
        nameEn: "Launch sale",
        nameAr: "تخفيض الإطلاق",
        kind: "SALE",
        applicationMethod: "AUTOMATIC",
        reductionKind: "PERCENTAGE",
        reductionValue: 1_500,
        priority: 20,
        allowCouponCombination: true,
      }],
    });
    const listed = await listCampaigns();
    const created = listed.find((entry) => entry.public_id === campaign.publicId);
    expect(created).toMatchObject({ internal_name: "Autumn launch", status: "DRAFT", rule_count: 1 });
    expect((created as typeof created & { rules?: { publicId: string; version: number }[] })?.rules).toEqual([
      expect.objectContaining({ publicId: campaign.rulePublicIds[0], version: 1 }),
    ]);

    const updated = await updatePromotionRule(actor.rows[0].id, campaign.rulePublicIds[0], {
      enabled: true,
      priority: 30,
    });
    expect(updated).toMatchObject({ enabled: true, priority: 30, version: 2 });
    await expect(updateCampaignLifecycle(actor.rows[0].id, campaign.publicId, "ARCHIVED")).rejects.toThrow("CAMPAIGN_TRANSITION_INVALID");
    await updateCampaignLifecycle(actor.rows[0].id, campaign.publicId, "ACTIVE");
    await updateCampaignLifecycle(actor.rows[0].id, campaign.publicId, "PAUSED");
    await updateCampaignLifecycle(actor.rows[0].id, campaign.publicId, "ENDED");
    await updateCampaignLifecycle(actor.rows[0].id, campaign.publicId, "ARCHIVED");
    const duplicate = await duplicateCampaign(actor.rows[0].id, campaign.publicId, {
      internalName: "Autumn launch copy",
      nameEn: "Autumn launch copy",
      nameAr: "نسخة إطلاق الخريف",
    });
    const duplicated = (await listCampaigns()).find((entry) => entry.public_id === duplicate.publicId);
    expect(duplicated).toMatchObject({ status: "DRAFT", rule_count: 1 });
    expect(duplicated?.rules[0]).toMatchObject({ enabled: false, version: 1 });
    const audits = await client.execute<{ action: string }>(
      "SELECT action FROM audit_event WHERE actor_id=$1 AND action IN('campaign.created','campaign.duplicated','campaign.lifecycle_changed','promotion.updated') ORDER BY action",
      [actor.rows[0].id],
    );
    expect(audits.rows.map((row) => row.action)).toEqual([
      "campaign.created",
      "campaign.duplicated",
      "campaign.lifecycle_changed",
      "campaign.lifecycle_changed",
      "campaign.lifecycle_changed",
      "campaign.lifecycle_changed",
      "promotion.updated",
    ]);
  });
});
