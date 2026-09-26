import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/generated/schema.ts",
  out: "./src/lib/db/generated",
  strict: true,
  verbose: true,
});
