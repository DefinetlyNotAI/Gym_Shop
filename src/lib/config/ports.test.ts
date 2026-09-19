import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "./env";

describe("local application ports", () => {
  it("defaults the storefront, staff app, and API to 3030, 4000, and 5000", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    const exampleEnvironment = await readFile(
      new URL("../../../.env.example", import.meta.url),
      "utf8",
    );
    const config = parseRuntimeConfig({});

    expect(config.STOREFRONT_ORIGIN).toBe("http://localhost:3030");
    expect(config.ADMIN_ORIGIN).toBe("http://localhost:4000");
    expect(config.API_ORIGIN).toBe("http://localhost:5000");
    expect(packageJson.scripts.dev).toBe("next dev -p 5000");
    expect(packageJson.scripts.start).toBe("next start -p 5000");
    expect(exampleEnvironment).toContain(
      "STOREFRONT_ORIGIN=http://localhost:3030",
    );
    expect(exampleEnvironment).toContain("ADMIN_ORIGIN=http://localhost:4000");
    expect(exampleEnvironment).toContain("API_ORIGIN=http://localhost:5000");
  });
});
