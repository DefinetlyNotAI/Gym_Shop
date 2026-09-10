import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import ws from "ws";
import { getRuntimeConfig, requireDatabaseUrl } from "@/lib/config/env";
import * as schema from "@/lib/db/generated/schema";

neonConfig.webSocketConstructor = ws;

type DrizzleExecutor = {
  execute(statement: SQL): PromiseLike<unknown>;
  $client?: unknown;
};

type RawSqlClient = {
  exec?(statement: string): Promise<unknown>;
  query?(statement: string): Promise<unknown>;
};

export type DatabaseResult<Row extends Record<string, unknown> = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
};

export type DatabaseClient = {
  /** Underlying Drizzle database or transaction for typed query-builder operations. */
  orm: DrizzleExecutor;
  /** Execute parameterized PostgreSQL through Drizzle's SQL pipeline. */
  execute<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<DatabaseResult<Row>>;
  /** Execute trusted migration DDL containing multiple statements. */
  executeRaw<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
  ): Promise<DatabaseResult<Row>>;
};

type TransactionalDrizzleExecutor = DrizzleExecutor & {
  transaction<T>(work: (transaction: DrizzleExecutor) => Promise<T>): Promise<T>;
};

type SimulationDatabase = {
  raw: PGlite;
  orm: TransactionalDrizzleExecutor;
};

function postgresArrayLiteral(values: readonly unknown[]): string {
  return `{${values.map((value) => {
    if (value === null || value === undefined) return "NULL";
    if (Array.isArray(value)) return postgresArrayLiteral(value);
    return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }).join(",")}}`;
}

declare global {
  var gymShopSimulationDatabase: Promise<SimulationDatabase> | undefined;
}

function parameterizedSql(statement: string, parameters: readonly unknown[]): SQL {
  const fragments = statement.split(/\$([1-9][0-9]*)/g);
  const query = sql.empty();
  query.append(sql.raw(fragments[0] ?? ""));
  for (let index = 1; index < fragments.length; index += 2) {
    const parameterIndex = Number(fragments[index]) - 1;
    if (parameterIndex < 0 || parameterIndex >= parameters.length) {
      throw new Error(`Missing SQL parameter $${parameterIndex + 1}`);
    }
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

function normalizeResult<Row extends Record<string, unknown>>(result: unknown): DatabaseResult<Row> {
  if (Array.isArray(result)) return { rows: result as Row[], rowCount: result.length };
  if (!result || typeof result !== "object") return { rows: [], rowCount: 0 };
  const value = result as { rows?: unknown[]; rowCount?: number; affectedRows?: number };
  const rows = Array.isArray(value.rows) ? value.rows as Row[] : [];
  return { rows, rowCount: value.rowCount ?? value.affectedRows ?? rows.length };
}

export function createDatabaseClient(orm: DrizzleExecutor): DatabaseClient {
  return {
    orm,
    async execute<Row extends Record<string, unknown>>(statement: string, parameters: readonly unknown[] = []) {
      return normalizeResult<Row>(await orm.execute(parameterizedSql(statement, parameters)));
    },
    async executeRaw<Row extends Record<string, unknown>>(statement: string) {
      const rawClient = orm.$client as RawSqlClient | undefined;
      if (rawClient?.exec) return normalizeResult<Row>(await rawClient.exec(statement));
      if (rawClient?.query) return normalizeResult<Row>(await rawClient.query(statement));
      return normalizeResult<Row>(await orm.execute(sql.raw(statement)));
    },
  };
}

async function simulationDatabase(): Promise<SimulationDatabase> {
  if (!globalThis.gymShopSimulationDatabase) {
    globalThis.gymShopSimulationDatabase = (async () => {
      const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
      const raw = new PGlite({ extensions: { pgcrypto } });
      await raw.waitReady;
      const orm = drizzlePglite({ client: raw, schema }) as unknown as TransactionalDrizzleExecutor;
      const client = createDatabaseClient(orm);
      const migrations = join(process.cwd(), "db", "migrations");
      for (const name of (await readdir(migrations)).filter((entry) => entry.endsWith(".sql")).sort()) {
        await client.executeRaw(await readFile(join(migrations, name), "utf8"));
      }
      await client.executeRaw(await readFile(join(process.cwd(), "db", "simmode-seed.sql"), "utf8"));
      return { raw, orm };
    })();
  }
  return globalThis.gymShopSimulationDatabase;
}

export async function withDatabaseClient<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
  if (getRuntimeConfig().SIM_MODE) {
    const database = await simulationDatabase();
    return work(createDatabaseClient(database.orm));
  }
  const pool = new Pool({ connectionString: requireDatabaseUrl(), max: 1 });
  const orm = drizzleNeon({ client: pool, schema }) as unknown as DrizzleExecutor;
  try {
    return await work(createDatabaseClient(orm));
  } finally {
    await pool.end();
  }
}

export async function withTransaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
  if (getRuntimeConfig().SIM_MODE) {
    const database = await simulationDatabase();
    return database.orm.transaction((transaction) => work(createDatabaseClient(transaction)));
  }
  const pool = new Pool({ connectionString: requireDatabaseUrl(), max: 1 });
  const orm = drizzleNeon({ client: pool, schema });
  try {
    return await orm.transaction((transaction) => work(createDatabaseClient(transaction as unknown as DrizzleExecutor)));
  } finally {
    await pool.end();
  }
}
