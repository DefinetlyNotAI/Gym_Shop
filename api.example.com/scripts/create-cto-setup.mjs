import { createHash, randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { databaseClient, neonDatabase } from "./database.mjs";

const connectionString = process.env.DATABASE_OWNER_URL;
const ownerEmail = process.env.CTO_OWNER_EMAIL?.trim().toLowerCase();
if (!connectionString) throw new Error("DATABASE_OWNER_URL is required");
if (!ownerEmail) throw new Error("CTO_OWNER_EMAIL is required");

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const placeholderHash = await hash(randomBytes(64).toString("base64url"));
const { orm, pool } = neonDatabase(connectionString);

try {
  await orm.transaction(async (transaction) => {
    const client = databaseClient(transaction);
    const existing = await client.execute("SELECT 1 FROM staff_account WHERE role_id='CTO'");
    if (existing.rowCount) throw new Error("A CTO already exists");
    const account = await client.execute("INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES($1,$2,'CTO','PENDING_VERIFICATION') RETURNING id", [ownerEmail, placeholderHash]);
    await client.execute("INSERT INTO staff_account(account_id,role_id,status) VALUES($1,'CTO','INVITED')", [account.rows[0].id]);
    await client.execute("INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'CTO_SETUP',$2,now()+interval '30 minutes')", [account.rows[0].id, tokenHash]);
  });
  process.stdout.write(`One-use CTO setup token (expires in 30 minutes):\n${token}\n`);
} finally {
  await pool.end();
}
