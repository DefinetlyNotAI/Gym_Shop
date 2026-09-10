import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pgliteDatabase } from "./database.mjs";

const { client, raw } = await pgliteDatabase();
const directory = resolve("db/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

try {
  for (const file of files) {
    await client.executeRaw(await readFile(resolve(directory, file), "utf8"));
    process.stdout.write(`Verified ${file} through Drizzle\n`);
  }
} finally {
  await raw.close();
}
