import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_OWNER_URL;
if (!connectionString) throw new Error("DATABASE_OWNER_URL is required for migrations");

const directory = resolve("db/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
const pool = new Pool({ connectionString, max: 1 });

try {
  for (const file of files) {
    const existing = await pool.query(
      "SELECT to_regclass('public.schema_migration') AS table_name",
    );
    if (existing.rows[0]?.table_name) {
      const applied = await pool.query("SELECT 1 FROM schema_migration WHERE name = $1", [file]);
      if (applied.rowCount) continue;
    }
    await pool.query(await readFile(resolve(directory, file), "utf8"));
    process.stdout.write(`Applied ${file}\n`);
  }
} finally {
  await pool.end();
}
