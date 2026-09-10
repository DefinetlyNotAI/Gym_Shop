import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pgliteDatabase } from "./database.mjs";

function check(value, message) { if (!value) throw new Error(message); }
const { client: db, raw } = await pgliteDatabase();
try {
  for (const file of (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort()) {
    await db.executeRaw(await readFile(resolve("db/migrations", file), "utf8"));
  }
  const account = await db.execute("INSERT INTO account(email_normalized,password_hash,display_name,status,email_verified_at,phone_verified_at) VALUES('buyer@example.com','hash','Buyer','ACTIVE',now(),now()) RETURNING id");
  check(account.rows.length === 1, "customer account could not be created");
  const product = await db.execute("INSERT INTO product(slug,name_en,name_ar,product_type,status,base_price_fils) VALUES('last-unit','Last unit','آخر قطعة','apparel','ACTIVE',10000) RETURNING id");
  const variant = await db.execute("INSERT INTO product_variant(product_id,sku) VALUES($1,'LAST-001') RETURNING id", [product.rows[0].id]);
  await db.execute("INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES($1,1,0)", [variant.rows[0].id]);
  const first = await db.execute("UPDATE inventory_balance SET reserved=reserved+1 WHERE variant_id=$1 AND on_hand-reserved>=1 RETURNING reserved", [variant.rows[0].id]);
  const second = await db.execute("UPDATE inventory_balance SET reserved=reserved+1 WHERE variant_id=$1 AND on_hand-reserved>=1 RETURNING reserved", [variant.rows[0].id]);
  check(first.rows.length === 1 && second.rows.length === 0, "final unit allocated more than once");

  const cto1 = await db.execute("INSERT INTO account(email_normalized,password_hash,display_name) VALUES('cto1@example.com','hash','CTO1') RETURNING id");
  await db.execute("INSERT INTO staff_account(account_id,role_id,status) VALUES($1,'CTO','ACTIVE')", [cto1.rows[0].id]);
  const cto2 = await db.execute("INSERT INTO account(email_normalized,password_hash,display_name) VALUES('cto2@example.com','hash','CTO2') RETURNING id");
  let duplicateCto = false;
  try { await db.execute("INSERT INTO staff_account(account_id,role_id,status) VALUES($1,'CTO','ACTIVE')", [cto2.rows[0].id]); } catch { duplicateCto = true; }
  check(duplicateCto, "CTO uniqueness was not enforced");

  const audit = await db.execute("INSERT INTO audit_event(action,target_type,target_id,domain) VALUES('test','test','1','test') RETURNING id");
  let auditMutable = false;
  try { await db.execute("UPDATE audit_event SET action='changed' WHERE id=$1", [audit.rows[0].id]); auditMutable = true; } catch {}
  check(!auditMutable, "audit row was mutable");
  let auditDeletable = false;
  try { await db.execute("DELETE FROM audit_event WHERE id=$1", [audit.rows[0].id]); auditDeletable = true; } catch {}
  check(!auditDeletable, "audit row was deletable");

  const event = await db.execute("INSERT INTO domain_event_outbox(event_type,aggregate_type,aggregate_id,payload) VALUES('test.event.v1','test','1','{}') RETURNING id");
  let eventMutable = false;
  try { await db.execute("UPDATE domain_event_outbox SET payload='{\"changed\":true}' WHERE id=$1", [event.rows[0].id]); eventMutable = true; } catch {}
  check(!eventMutable, "event content was mutable");
  const tables = await db.execute("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  check(tables.rows[0].count >= 35, "v0.1 schema is incomplete");
  process.stdout.write(`v0.1 Drizzle database acceptance passed (${tables.rows[0].count} tables)\n`);
} finally {
  await raw.close();
}
