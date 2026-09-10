import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { hash } from "@node-rs/argon2";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/db/client";
import * as schema from "@/lib/db/generated/schema";

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

import { applyCardPaymentStatus, checkout, confirmLocalCardPayment, cancelOrder } from "@/lib/commerce/orders";
import { acceptDeliveryCustody, completeDelivery, dispatchOrder, packOrder, recordFailedDelivery } from "@/lib/commerce/fulfillment";
import { driverCashPosition, executeRefund, handoverCash, recordCashDiscrepancy, verifyHandover } from "@/lib/finance/service";
import { finalizeDueDeletions, requestDeletion } from "@/lib/support/service";
import { activateLockdown, finishEmergencyRecovery, recordEmergencyFailure } from "@/lib/security/emergency";
import { decryptOutboundSecret } from "@/lib/notifications/secrets";
import type { CurrentAccount } from "@/lib/auth/session";
import { createDatabaseClient } from "@/lib/db/client";

async function row<T extends Record<string, unknown>>(sql: string, parameters: unknown[] = []) { return (await client.execute<T>(sql, parameters)).rows[0]; }
async function createAccount(email: string, displayName: string, role?: string) {
  const account = await row<{ id: string; public_id: string }>("INSERT INTO account(email_normalized,password_hash,display_name,phone_e164,status,email_verified_at,phone_verified_at) VALUES($1,'hash',$2,$3,'ACTIVE',now(),now()) RETURNING id,public_id", [email, displayName, `+96279${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`]);
  if (role) await client.execute("INSERT INTO staff_account(account_id,role_id,status,mfa_completed_at) VALUES($1,$2,'ACTIVE',now())", [account.id, role]);
  return account;
}
async function addCartLine(accountId: string, variantId: string) {
  const cart = await row<{ id: string }>("INSERT INTO cart(account_id) VALUES($1) ON CONFLICT(account_id) DO UPDATE SET updated_at=now() RETURNING id", [accountId]);
  await client.execute("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,1,true) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1,selected=true", [cart.id, variantId]);
}

describe("v0.1 operational journeys", () => {
  beforeAll(async () => {
    process.env.APP_ENV = "test";
    database = new PGlite({ extensions: { pgcrypto } });
    await database.waitReady;
    orm = drizzlePglite({ client: database, schema });
    client = createDatabaseClient(orm);
    for (const filename of (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort()) await client.executeRaw(await readFile(resolve("db/migrations", filename), "utf8"));
  }, 30_000);
  afterAll(async () => { await database.close(); });

  it("buys, packs, delivers, reconciles, refunds, de-identifies, and completes emergency recovery without replaying value", async () => {
    const buyer = await createAccount("buyer@journey.test", "Journey Buyer");
    const driver = await createAccount("driver@journey.test", "Journey Driver", "DELIVERY_AGENT");
    const logistics = await createAccount("logistics@journey.test", "Journey Logistics", "LOGISTICS_STAFF");
    const finance = await createAccount("finance@journey.test", "Journey Finance", "FINANCE_STAFF");
    const reviewer = await createAccount("reviewer@journey.test", "Journey Reviewer", "CTO");
    const terms = await row<{ id: string }>("INSERT INTO terms_document(kind,version,language,title,body,content_hash,published_at) VALUES('TERMS','v0.1','en','Terms','Reviewed launch terms','hash',now()) RETURNING id");
    const zone = await row<{ id: string }>("INSERT INTO delivery_zone(name_en,name_ar,fee_fils,eta_min_days,eta_max_days,policy_reviewed) VALUES('Amman','عمان',3000,1,2,true) RETURNING id");
    const window = await row<{ id: string }>("INSERT INTO delivery_window(zone_id,weekday,starts_at,ends_at,capacity) VALUES($1,0,'09:00','13:00',50) RETURNING id", [zone.id]);
    await client.execute("UPDATE app_setting SET value='\"NONE_REVIEWED\"'::jsonb WHERE key='checkout.tax_policy'");
    await client.execute("UPDATE app_setting SET value='true'::jsonb WHERE key='delivery.cod_redelivery_policy_reviewed'");
    const product = await row<{ id: string }>("INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('journey-item','Journey item','منتج الرحلة','equipment','ACTIVE',10000) RETURNING id");
    const variant = await row<{ id: string }>("INSERT INTO product_variant(product_id,sku) VALUES($1,'JOURNEY-001') RETURNING id", [product.id]);
    await client.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,10,0)", [variant.id]);
    const checkoutInput = (method: "CARD" | "COD", key: string) => ({ paymentMethod: method, fulfillmentMode: "DELIVERY", deliveryZoneId: zone.id, deliveryWindowId: window.id, recipient: { name: "Journey Buyer", phone: "+962790000001", city: "Amman", area: "Abdoun", street: "Test Street" }, termsDocumentId: terms.id, idempotencyKey: key, doorstepAuthorized: method === "CARD" });

    await addCartLine(buyer.id, variant.id);
    const failedCard = await checkout(buyer.id, checkoutInput("CARD", "card-failure-journey1"));
    await applyCardPaymentStatus({ reference: failedCard.paymentReference!, status: "FAILED", amountFils: failedCard.totalFils, currency: "JOD", evidence: { source: "signed-provider-test" } });
    expect(await row("SELECT status,payment_status,fulfillment_status FROM shop_order WHERE public_id=$1",[failedCard.orderId])).toMatchObject({status:"CANCELLED",payment_status:"FAILED",fulfillment_status:"CANCELLED"});
    expect(Number((await row<{reserved:string}>("SELECT reserved FROM inventory_balance WHERE variant_id=$1",[variant.id])).reserved)).toBe(0);

    await addCartLine(buyer.id, variant.id);
    const card = await checkout(buyer.id, checkoutInput("CARD", "card-journey-0001"));
    expect(card.status).toBe("PAYMENT_REQUIRED"); expect(card.paymentReference).toMatch(/^sim_/);
    await confirmLocalCardPayment(buyer.id, card.orderId, card.paymentReference!);
    expect((await confirmLocalCardPayment(buyer.id, card.orderId, card.paymentReference!)).replayed).toBe(true);
    await cancelOrder(buyer.id, card.orderId);
    const refund = await row<{ id: string }>("SELECT id FROM refund WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1)", [card.orderId]);
    await executeRefund(refund.id, finance.id, "manual-test-refund-receipt");
    const refunded = await row<{ payment_status: string; refunded_fils: string; collected_fils: string }>("SELECT payment_status,refunded_fils,collected_fils FROM shop_order WHERE public_id=$1", [card.orderId]);
    expect(refunded).toMatchObject({ payment_status: "REFUNDED", refunded_fils: refunded.collected_fils });

    await addCartLine(buyer.id, variant.id);
    const cod = await checkout(buyer.id, checkoutInput("COD", "cod-journey-00001"));
    await packOrder(cod.orderId, logistics.id);
    await dispatchOrder(cod.orderId, driver.id, logistics.id);
    await acceptDeliveryCustody(cod.orderId, driver.id);
    const deliverySecret=await row<{ciphertext:string}>("SELECT secret.ciphertext FROM outbound_secret AS secret JOIN domain_event_outbox AS event ON event.id=secret.event_id WHERE event.event_type='delivery.customer_pin.v1' AND event.aggregate_id=(SELECT id::text FROM shop_order WHERE public_id=$1) ORDER BY event.occurred_at DESC LIMIT 1",[cod.orderId]);
    await completeDelivery(cod.orderId, driver.id, { pin: decryptOutboundSecret(deliverySecret.ciphertext).token, collectedFils: cod.totalFils });
    expect(await driverCashPosition(driver.id)).toMatchObject({ heldFils: cod.totalFils, pendingHandoverFils: 0 });
    const handover = await handoverCash(driver.id, 5000);
    await verifyHandover(handover.handoverId, finance.id);
    expect((await driverCashPosition(driver.id)).heldFils).toBe(cod.totalFils - 5000);
    await expect(verifyHandover(handover.handoverId, driver.id)).rejects.toThrow("HANDOVER_INVALID");
    await recordCashDiscrepancy({ driverId: driver.id, expectedFils: 1000, actualFils: 700, sourceId: "journey-shortage", reason: "Counted shortage under independent review" }, finance.id);
    expect(Number((await row<{ amount_fils: string }>("SELECT amount_fils FROM cash_ledger WHERE kind='DISCREPANCY' AND source_id='journey-shortage'")).amount_fils)).toBe(300);

    await addCartLine(buyer.id, variant.id);
    const retry = await checkout(buyer.id, checkoutInput("COD", "cod-retry-journey1"));
    await packOrder(retry.orderId, logistics.id); await dispatchOrder(retry.orderId, driver.id, logistics.id); await acceptDeliveryCustody(retry.orderId, driver.id);
    expect((await recordFailedDelivery(retry.orderId, driver.id, { reason: "CUSTOMER_UNAVAILABLE", contactEffort: "Called recipient" })).additionalFeeFils).toBe(0);
    expect((await recordFailedDelivery(retry.orderId, driver.id, { reason: "CUSTOMER_UNAVAILABLE", contactEffort: "Called recipient again" })).additionalFeeFils).toBe(0);
    expect((await recordFailedDelivery(retry.orderId, driver.id, { reason: "CUSTOMER_REFUSED", contactEffort: "Recipient declined final attempt" })).additionalFeeFils).toBe(6000);
    const retryState = await row<{ status: string; delivery_fils: string }>("SELECT status,delivery_fils FROM shop_order WHERE public_id=$1", [retry.orderId]);
    expect(retryState.status).toBe("CANCELLED"); expect(Number(retryState.delivery_fils)).toBe(9000);

    await requestDeletion(buyer.id);
    await client.execute("UPDATE deletion_manifest SET due_at=now()-interval '1 second' WHERE account_id=$1", [buyer.id]);
    await client.execute("UPDATE account SET deletion_due_at=now()-interval '1 second' WHERE id=$1", [buyer.id]);
    expect((await finalizeDueDeletions()).finalized).toBe(1);
    const deleted = await row<{ status: string; email_normalized: string; display_name: string }>("SELECT status,email_normalized,display_name FROM account WHERE id=$1", [buyer.id]);
    expect(deleted.status).toBe("DELETED"); expect(deleted.email_normalized).toMatch(/^DELETED_USER_[0-9]{6}@deleted\.invalid$/); expect(deleted.display_name).toMatch(/^DELETED_USER_/);
    expect((await row<{ count: number }>("SELECT count(*)::int AS count FROM cash_ledger WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1)", [cod.orderId])).count).toBeGreaterThan(0);

    const ctoSession = await row<{ id: string }>("INSERT INTO account_session(account_id,token_hash,kind,expires_at) VALUES($1,'emergency-token','EMERGENCY',now()+interval '1 hour') RETURNING id", [reviewer.id]);
    await client.execute("INSERT INTO webauthn_credential(id,account_id,public_key,device_label,independent_key,last_used_at) VALUES('journey-key',$1,'\\x01','Independent spare',true,now())", [reviewer.id]);
    const proof = async (action: string) => { const challenge = await row<{ id: string }>("INSERT INTO webauthn_challenge(account_id,ceremony,challenge,expires_at,consumed_at) VALUES($1,'RECOVERY_ACTION',$2,now()+interval '5 minutes',now()) RETURNING id", [reviewer.id, `challenge-${action}`]); return row<{ id: string }>("INSERT INTO emergency_action_proof(session_id,action,challenge_id,verified_at,expires_at,credential_id) VALUES($1,$2,$3,now(),now()+interval '5 minutes','journey-key') RETURNING id", [ctoSession.id, action, challenge.id]); };
    const emergency: CurrentAccount = { id: reviewer.id, publicId: reviewer.public_id, email: "reviewer@journey.test", displayName: "Journey Reviewer", status: "ACTIVE", emailVerified: true, phoneVerified: true, role: "CTO", sessionId: ctoSession.id, authenticatedAt: new Date(), sessionKind: "EMERGENCY" };
    expect((await activateLockdown(emergency, (await proof("LOCKDOWN")).id)).locked).toBe(true);
    await recordEmergencyFailure(emergency, "invalid-key-removal");
    const passphrase = "one two three four five six seven eight nine ten eleven twelve";
    const verifier = await hash(passphrase, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await client.execute("INSERT INTO pending_recovery_secret(account_id,verifier_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [reviewer.id, verifier]);
    await client.execute("INSERT INTO recovery_secret(account_id,verifier_hash,saved_check_at) VALUES($1,$2,now())", [reviewer.id, verifier]);
    const finished = await finishEmergencyRecovery(emergency, { password: "a-new-secure-password", confirmation: passphrase, savedCopyAcknowledged: true, repairChecklistAcknowledged: true, proofId: (await proof("COMPLETE_RECOVERY")).id });
    expect(finished).toMatchObject({ completed: true, normalLoginRequired: true });
    expect((await row<{ normal_operations_locked: boolean }>("SELECT normal_operations_locked FROM platform_state WHERE singleton=true")).normal_operations_locked).toBe(false);
    expect((await row<{ count: number }>("SELECT count(*)::int AS count FROM audit_event WHERE action='cto.recovery.action_failed' AND result='FAILED'")).count).toBe(1);
  }, 60_000);
});
