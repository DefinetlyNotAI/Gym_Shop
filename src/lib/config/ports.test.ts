import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "./env";

describe("local application ports", () => {
  it("defaults the storefront, staff app, and API to 3030, 4000, and 5000", async () => {
    const apiPackage = JSON.parse(
      await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    const storefrontPackage = JSON.parse(
      await readFile(
        new URL("../../../../example.com/package.json", import.meta.url),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    const adminPackage = JSON.parse(
      await readFile(
        new URL("../../../../admin.example.com/package.json", import.meta.url),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    const exampleEnvironment = await readFile(
      new URL("../../../.env.example", import.meta.url),
      "utf8",
    );
    const sharedLauncher = await readFile(
      new URL("../../../../run-sites.mjs", import.meta.url),
      "utf8",
    );
    const config = parseRuntimeConfig({});

    expect(config.STOREFRONT_ORIGIN).toBe("http://localhost:3030");
    expect(config.ADMIN_ORIGIN).toBe("http://localhost:4000");
    expect(config.API_ORIGIN).toBe("http://localhost:5000");
    expect(storefrontPackage.scripts.dev).toBe("next dev -p 3030");
    expect(adminPackage.scripts.dev).toBe("next dev -p 4000");
    expect(apiPackage.scripts.dev).toBe("next dev -p 5000");
    expect(apiPackage.scripts.start).toBe("next start -p 5000");
    expect(exampleEnvironment).toContain(
      "STOREFRONT_ORIGIN=http://localhost:3030",
    );
    expect(exampleEnvironment).toContain("ADMIN_ORIGIN=http://localhost:4000");
    expect(exampleEnvironment).toContain("API_ORIGIN=http://localhost:5000");
    expect(sharedLauncher).toContain(
      'STOREFRONT_ORIGIN:"http://localhost:3030"',
    );
    expect(sharedLauncher).toContain('API_ORIGIN:"http://localhost:5000"');
    expect(sharedLauncher).toContain('ADMIN_ORIGIN:"http://localhost:4000"');
  });
});
