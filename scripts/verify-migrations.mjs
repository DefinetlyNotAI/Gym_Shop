import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const database = new PGlite({ extensions: { pgcrypto } });
const directory = resolve("db/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

try {
  for (const file of files) {
    await database.exec(await readFile(resolve(directory, file), "utf8"));
    process.stdout.write(`Verified ${file}\n`);
  }
} finally {
  await database.close();
}
