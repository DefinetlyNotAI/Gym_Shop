import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const access = await loadProduction(
  new URL("../src/lib/customer-access.ts", import.meta.url),
);

const customer = (overrides = {}) => ({
  publicId: "customer-id",
  email: "customer@sim.gym-shop.local",
  displayName: "SIM Customer",
  status: "ACTIVE",
  emailVerified: true,
  phoneVerified: true,
  role: "CUSTOMER",
  sessionKind: "NORMAL",
  ...overrides,
});

test("protected customer routing rejects staff before customer-only pages load", () => {
  assert.equal(
    access.customerAccessDestination(customer({ role: "CTO" })),
    "/account",
  );
});

test("active normal customer sessions may load protected customer pages", () => {
  assert.equal(access.customerAccessDestination(customer()), null);
});

test("restricted and invalid customer sessions follow the server authorization policy", () => {
  for (const [overrides, expected] of [
    [{ status: "SUSPENDED" }, "/account/restricted"],
    [{ status: "DELETION_PENDING" }, "/account/restricted"],
    [{ status: "DISABLED" }, "/account"],
    [{ sessionKind: "EMERGENCY" }, "/account"],
    [null, "/account"],
  ]) {
    assert.equal(
      access.customerAccessDestination(
        overrides === null ? null : customer(overrides),
      ),
      expected,
    );
  }
});

test("restricted portal accepts only restricted normal customer sessions", () => {
  for (const status of ["SUSPENDED", "DELETION_PENDING"])
    assert.equal(
      access.customerAccessDestination(customer({ status }), "restricted"),
      null,
    );
  for (const overrides of [{}, { role: "CTO" }, { sessionKind: "EMERGENCY" }])
    assert.equal(
      access.customerAccessDestination(customer(overrides), "restricted"),
      "/account",
    );
});

test("account landing exposes customer navigation only to ordinary customers", () => {
  assert.equal(access.customerAccountLanding(null), "signed-out");
  assert.equal(access.customerAccountLanding(customer()), "customer");
  assert.equal(
    access.customerAccountLanding(customer({ status: "SUSPENDED" })),
    "restricted",
  );
  assert.equal(
    access.customerAccountLanding(customer({ status: "PENDING_VERIFICATION" })),
    "unavailable",
  );
  assert.equal(
    access.customerAccountLanding(customer({ sessionKind: "EMERGENCY" })),
    "unavailable",
  );
  assert.equal(
    access.customerAccountLanding(customer({ role: "CTO" })),
    "staff",
  );
});
