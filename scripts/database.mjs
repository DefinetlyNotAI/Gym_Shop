import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

function postgresArrayLiteral(values) {
  return `{${values.map((value) => {
    if (value === null || value === undefined) return "NULL";
    if (Array.isArray(value)) return postgresArrayLiteral(value);
    return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }).join(",")}}`;
}

function parameterizedSql(statement, parameters) {
  const fragments = statement.split(/\$([1-9][0-9]*)/g);
  const query = sql.empty();
  query.append(sql.raw(fragments[0] ?? ""));
  for (let index = 1; index < fragments.length; index += 2) {
    const parameterIndex = Number(fragments[index]) - 1;
    if (parameterIndex < 0 || parameterIndex >= parameters.length) throw new Error(`Missing SQL parameter $${parameterIndex + 1}`);
    const followingSql = fragments[index + 1] ?? "";
    const value = parameters[parameterIndex];
    const driverValue = Array.isArray(value) && /^\s*::\s*[a-zA-Z_][\w.]*\s*\[\]/.test(followingSql)
      ? postgresArrayLiteral(value)
      : value;
    query.append(sql`${driverValue}`);
    query.append(sql.raw(followingSql));
  }
  return query;
}

function normalize(result) {
  if (Array.isArray(result)) return { rows: result, rowCount: result.length };
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return { rows, rowCount: result?.rowCount ?? result?.affectedRows ?? rows.length };
}

export function databaseClient(orm) {
  return {
    orm,
    async execute(statement, parameters = []) { return normalize(await orm.execute(parameterizedSql(statement, parameters))); },
    async executeRaw(statement) {
      if (orm.$client?.exec) return normalize(await orm.$client.exec(statement));
      if (orm.$client?.query) return normalize(await orm.$client.query(statement));
      return normalize(await orm.execute(sql.raw(statement)));
    },
  };
}

export async function pgliteDatabase() {
  const raw = new PGlite({ extensions: { pgcrypto } });
  await raw.waitReady;
  const orm = drizzlePglite({ client: raw });
  return { raw, orm, client: databaseClient(orm) };
}

export function neonDatabase(connectionString) {
  const pool = new Pool({ connectionString, max: 1 });
  const orm = drizzleNeon({ client: pool });
  return { pool, orm, client: databaseClient(orm) };
}
