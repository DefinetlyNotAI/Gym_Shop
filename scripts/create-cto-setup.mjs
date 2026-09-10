import { randomBytes, createHash } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor=ws;
const connectionString=process.env.DATABASE_OWNER_URL;
const ownerEmail=process.env.CTO_OWNER_EMAIL?.trim().toLowerCase();
if(!connectionString)throw new Error("DATABASE_OWNER_URL is required");
if(!ownerEmail)throw new Error("CTO_OWNER_EMAIL is required");
const token=randomBytes(32).toString("base64url");
const tokenHash=createHash("sha256").update(token).digest("hex");
const placeholderHash=await hash(randomBytes(64).toString("base64url"));
const pool=new Pool({connectionString,max:1});const client=await pool.connect();
try{await client.query("BEGIN");const existing=await client.query("SELECT 1 FROM staff_account WHERE role_id='CTO'");if(existing.rowCount)throw new Error("A CTO already exists");const account=await client.query("INSERT INTO account(email_normalized,password_hash,display_name,status) VALUES($1,$2,'CTO','PENDING_VERIFICATION') RETURNING id",[ownerEmail,placeholderHash]);await client.query("INSERT INTO staff_account(account_id,role_id,status) VALUES($1,'CTO','INVITED')",[account.rows[0].id]);await client.query("INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'CTO_SETUP',$2,now()+interval '30 minutes')",[account.rows[0].id,tokenHash]);await client.query("COMMIT");process.stdout.write(`One-use CTO setup token (expires in 30 minutes):\n${token}\n`);}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await pool.end();}
