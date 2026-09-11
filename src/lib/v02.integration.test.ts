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

import { cancelOrder, checkout, quoteSelectedCart } from "@/lib/commerce/orders";
import { createDatabaseClient } from "@/lib/db/client";
import {
  createCampaign,
  duplicateCampaign,
  listCampaigns,
  updateCampaignLifecycle,
  updatePromotionRule,
} from "@/lib/pricing/admin";
import { loadPricingRulesForQuote } from "@/lib/pricing/service";
import {
  awardDeliveryPoints,
  captureWalletHold,
  convertPoints,
  creditWalletLot,
  getWalletSummary,
  holdWalletTender,
  releaseWalletHold,
} from "@/lib/wallet/service";

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
      "point_conversion",
      "point_ledger",
      "promotion_code",
      "promotion_rule",
      "promotion_scope",
      "promotion_usage",
      "wallet_hold",
      "wallet_hold_allocation",
      "wallet_ledger",
      "wallet_lot",
    ];

    expect(await tableNames(requiredTables)).toEqual(requiredTables);
    const permission = await client.execute<{ id: string }>("SELECT id FROM permission WHERE id='promotions.manage'");
    expect(permission.rows).toEqual([{ id: "promotions.manage" }]);
  });

  it("converts only whole point blocks under the Amman weekly quota and replays safely", async () => {
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES('wallet-conversion@v02.test','hash','Wallet Buyer','ACTIVE') RETURNING id",
    );
    await client.execute(
      `INSERT INTO point_ledger(account_id,direction,kind,milli_points,source_type,source_id,operation_key)
       VALUES($1,'CREDIT','CREDIT',250000,'TEST','opening-points','test:wallet-opening')`,
      [account.rows[0].id],
    );

    const converted = await convertPoints(account.rows[0].id, { blocks: 2, idempotencyKey: "convert-wallet-2-blocks" });
    const replayed = await convertPoints(account.rows[0].id, { blocks: 2, idempotencyKey: "convert-wallet-2-blocks" });
    const summary = await getWalletSummary(account.rows[0].id);

    expect(replayed).toEqual(converted);
    expect(converted).toMatchObject({ blocks: 2, pointsDebited: 200, walletFilsCredited: 2_000, weeklyBlocksRemaining: 3 });
    expect(summary).toMatchObject({ pointMilliBalance: 50_000, walletAvailableFils: 2_000, expires: false });
    await expect(convertPoints(account.rows[0].id, {
      blocks: 4,
      idempotencyKey: "convert-wallet-over-weekly-quota",
    })).rejects.toThrow("POINT_CONVERSION_WEEKLY_LIMIT");
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({
      pointMilliBalance: 50_000,
      walletAvailableFils: 2_000,
    });
  });

  it("holds oldest wallet lots once and restores the original provenance after capture", async () => {
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES('wallet-hold@v02.test','hash','Wallet Hold Buyer','ACTIVE') RETURNING id",
    );
    const terms = await client.execute<{ id: string }>(
      "INSERT INTO terms_document(kind,version,language,title,body,content_hash,published_at) VALUES('TERMS','wallet-v0.2','en','Wallet terms','Wallet terms','wallet-v02',now()) RETURNING id",
    );
    const makeOrder = async (suffix: string) => (await client.execute<{ id: string }>(
      `INSERT INTO shop_order(account_id,status,payment_status,fulfillment_status,payment_method,merchandise_fils,delivery_fils,external_due_fils,quote_snapshot,recipient_snapshot,delivery_snapshot,terms_document_id)
       VALUES($1,'CONFIRMED','PAID','UNFULFILLED','ZERO_VALUE',30000,0,0,'{}','{}',$2::jsonb,$3) RETURNING id`,
      [account.rows[0].id, JSON.stringify({ suffix }), terms.rows[0].id],
    )).rows[0].id;
    await creditWalletLot(client, { accountId: account.rows[0].id, amountFils: 10_000, sourceType: "TEST", sourceId: "old-lot", operationKey: "wallet:old-lot" });
    await creditWalletLot(client, { accountId: account.rows[0].id, amountFils: 20_000, sourceType: "TEST", sourceId: "new-lot", operationKey: "wallet:new-lot" });
    const firstOrderId = await makeOrder("first");
    const competingOrderId = await makeOrder("competing");

    const held = await holdWalletTender(client, { accountId: account.rows[0].id, orderId: firstOrderId, amountFils: 25_000 });
    expect(await holdWalletTender(client, { accountId: account.rows[0].id, orderId: firstOrderId, amountFils: 25_000 })).toEqual(held);
    await expect(holdWalletTender(client, { accountId: account.rows[0].id, orderId: competingOrderId, amountFils: 10_000 })).rejects.toThrow("WALLET_BALANCE_INSUFFICIENT");
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 5_000, walletHeldFils: 25_000 });

    await captureWalletHold(client, firstOrderId);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 5_000, walletHeldFils: 0 });
    await releaseWalletHold(client, firstOrderId);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 30_000, walletHeldFils: 0 });
    const lots = await client.execute<{ source_id: string; available_fils: string }>(
      "SELECT source_id,available_fils FROM wallet_lot WHERE account_id=$1 ORDER BY created_at,id",
      [account.rows[0].id],
    );
    expect(lots.rows.map((lot) => [lot.source_id, Number(lot.available_fils)])).toEqual([
      ["old-lot", 10_000],
      ["new-lot", 20_000],
    ]);
  });

  it("confirms a fully wallet-funded order without a provider payment and restores it on cancellation", async () => {
    await client.execute("UPDATE promotion_rule SET enabled=false");
    await client.execute("UPDATE app_setting SET value='\"NONE_REVIEWED\"'::jsonb WHERE key='checkout.tax_policy'");
    const account = await client.execute<{ id: string }>(
      "INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('wallet-order@v02.test','hash','Wallet Order Buyer','ACTIVE',now(),now()) RETURNING id",
    );
    const zone = await client.execute<{ id: string }>(
      "INSERT INTO delivery_zone(name_en,name_ar,fee_fils,eta_min_days,eta_max_days,policy_reviewed) VALUES('Wallet Zone','منطقة المحفظة',2000,1,1,true) RETURNING id",
    );
    const window = await client.execute<{ id: string }>(
      "INSERT INTO delivery_window(zone_id,weekday,starts_at,ends_at,capacity) VALUES($1,0,'10:00','14:00',5) RETURNING id",
      [zone.rows[0].id],
    );
    const terms = await client.execute<{ id: string }>(
      "INSERT INTO terms_document(kind,version,language,title,body,content_hash,published_at) VALUES('TERMS','wallet-order-v0.2','en','Wallet order terms','Wallet order terms','wallet-order-v02',now()) RETURNING id",
    );
    const product = await client.execute<{ id: string }>(
      "INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('wallet-order-product','Wallet order product','منتج المحفظة','equipment','ACTIVE',50000) RETURNING id",
    );
    const variant = await client.execute<{ id: string }>(
      "INSERT INTO product_variant(product_id,sku) VALUES($1,'WALLET-ORDER-001') RETURNING id",
      [product.rows[0].id],
    );
    await client.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,2,0)", [variant.rows[0].id]);
    const cart = await client.execute<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) RETURNING id", [account.rows[0].id]);
    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [cart.rows[0].id, variant.rows[0].id]);
    await creditWalletLot(client, { accountId: account.rows[0].id, amountFils: 60_000, sourceType: "TEST", sourceId: "full-wallet-order", operationKey: "wallet:full-order" });

    const result = await checkout(account.rows[0].id, {
      paymentMethod: "CARD",
      fulfillmentMode: "DELIVERY",
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Wallet Buyer", phone: "+962790000103", city: "Amman", area: "Abdoun", street: "Wallet Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey: "v02-fully-wallet-order",
      doorstepAuthorized: true,
      walletFils: 52_000,
    });

    expect(result).toMatchObject({ status: "CONFIRMED", totalFils: 52_000 });
    const stored = await client.execute<{ payment_method: string; external_due_fils: string; payment_count: number; hold_status: string }>(
      `SELECT orders.payment_method,orders.external_due_fils,
              (SELECT count(*)::int FROM payment WHERE order_id=orders.id) AS payment_count,
              (SELECT status FROM wallet_hold WHERE order_id=orders.id) AS hold_status
       FROM shop_order AS orders WHERE orders.public_id=$1`,
      [result.orderId],
    );
    expect(stored.rows[0]).toMatchObject({ payment_method: "ZERO_VALUE", payment_count: 0, hold_status: "CAPTURED" });
    expect(Number(stored.rows[0].external_due_fils)).toBe(0);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 8_000, walletHeldFils: 0 });
    await cancelOrder(account.rows[0].id, result.orderId);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 60_000, walletHeldFils: 0 });

    await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true)", [cart.rows[0].id, variant.rows[0].id]);
    const split = await checkout(account.rows[0].id, {
      paymentMethod: "CARD",
      fulfillmentMode: "DELIVERY",
      deliveryZoneId: zone.rows[0].id,
      deliveryWindowId: window.rows[0].id,
      recipient: { name: "Wallet Buyer", phone: "+962790000103", city: "Amman", area: "Abdoun", street: "Wallet Street" },
      termsDocumentId: terms.rows[0].id,
      idempotencyKey: "v02-wallet-card-split",
      doorstepAuthorized: true,
      walletFils: 20_000,
    });
    expect(split.status).toBe("PAYMENT_REQUIRED");
    const splitStored = await client.execute<{ wallet_tender_fils: string; external_due_fils: string; amount_fils: string; hold_status: string }>(
      `SELECT orders.wallet_tender_fils,orders.external_due_fils,payment.amount_fils,
              (SELECT status FROM wallet_hold WHERE order_id=orders.id) AS hold_status
       FROM shop_order AS orders JOIN payment ON payment.order_id=orders.id WHERE orders.public_id=$1`,
      [split.orderId],
    );
    expect(Number(splitStored.rows[0].wallet_tender_fils)).toBe(20_000);
    expect(Number(splitStored.rows[0].external_due_fils)).toBe(32_000);
    expect(Number(splitStored.rows[0].amount_fils)).toBe(32_000);
    expect(splitStored.rows[0].hold_status).toBe("HELD");
    await cancelOrder(account.rows[0].id, split.orderId);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 60_000, walletHeldFils: 0 });
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
    await creditWalletLot(client, {
      accountId: account.rows[0].id,
      amountFils: 30_000,
      sourceType: "TEST",
      sourceId: "checkout-wallet-lot",
      operationKey: "wallet:credit:checkout-wallet-lot",
    });

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
      walletFils: 30_000,
    });

    expect(result.totalFils).toBe(75_000);
    const stored = await client.execute<{ discount_fils: string; wallet_tender_fils: string; external_due_fils: string; quote_snapshot: { appliedRules: { id: string }[] } }>(
      "SELECT discount_fils,wallet_tender_fils,external_due_fils,quote_snapshot FROM shop_order WHERE public_id=$1",
      [result.orderId],
    );
    expect(Number(stored.rows[0].discount_fils)).toBe(28_000);
    expect(Number(stored.rows[0].wallet_tender_fils)).toBe(30_000);
    expect(Number(stored.rows[0].external_due_fils)).toBe(45_000);
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
      walletFils: 30_000,
    });
    expect(replay).toEqual(result);
    const replayUsage = await client.execute<{ count: number }>(
      "SELECT count(*)::int AS count FROM promotion_usage WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1)",
      [result.orderId],
    );
    expect(replayUsage.rows[0].count).toBe(2);
    expect(await getWalletSummary(account.rows[0].id)).toMatchObject({ walletAvailableFils: 0, walletHeldFils: 0 });
    const unearned = await client.execute<{ count: number }>(
      "SELECT count(*)::int AS count FROM point_ledger WHERE account_id=$1 AND source_type='PURCHASE'",
      [account.rows[0].id],
    );
    expect(unearned.rows[0].count).toBe(0);
    const completedOrder = await client.execute<{ id: string }>(
      `UPDATE shop_order SET status='COMPLETED',fulfillment_status='DELIVERED',payment_status='PAID',collected_fils=external_due_fils
       WHERE public_id=$1 RETURNING id`,
      [result.orderId],
    );
    expect(await awardDeliveryPoints(client, completedOrder.rows[0].id)).toBe(true);
    expect(await awardDeliveryPoints(client, completedOrder.rows[0].id)).toBe(false);
    const earned = await client.execute<{ milli_points: string }>(
      "SELECT milli_points FROM point_ledger WHERE account_id=$1 AND source_type='PURCHASE'",
      [account.rows[0].id],
    );
    expect(Number(earned.rows[0].milli_points)).toBe(72_000);

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
