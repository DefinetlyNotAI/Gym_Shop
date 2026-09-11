import { describe, expect, it } from "vitest";
import { calculatePricingQuote, type PricingRuleInput } from "./service";

const line = (lineId: string, unitBaseFils: number, quantity = 1) => ({ lineId, unitBaseFils, quantity });
const percentageRule = (
  id: string,
  kind: "SALE" | "COUPON" | "REFERRAL",
  percentageBps: number,
  overrides: Partial<PricingRuleInput> = {},
): PricingRuleInput => ({
  id,
  version: 1,
  kind,
  reduction: { kind: "PERCENTAGE", value: percentageBps },
  priority: 0,
  eligibleLineIds: ["line-1"],
  allowSaleCombination: false,
  allowCouponCombination: false,
  ...overrides,
});

describe("calculatePricingQuote", () => {
  it("selects the sale with the highest monetary reduction instead of stacking sales", () => {
    const quote = calculatePricingQuote({
      lines: [line("line-1", 50_000)],
      sales: [percentageRule("sale-10", "SALE", 1_000), percentageRule("sale-20", "SALE", 2_000)],
      coupons: [],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(quote).toMatchObject({ merchandiseBaseFils: 50_000, saleFils: 10_000, totalFils: 40_000 });
    expect(quote.lines[0]).toMatchObject({ saleFils: 10_000, netFils: 40_000 });
    expect(quote.appliedRules.map((rule) => rule.id)).toEqual(["sale-20"]);
  });

  it("applies a mutually permitted coupon after the winning sale", () => {
    const quote = calculatePricingQuote({
      lines: [line("line-1", 100_000)],
      sales: [percentageRule("sale-20", "SALE", 2_000, { allowCouponCombination: true })],
      coupons: [percentageRule("coupon-10", "COUPON", 1_000, { allowSaleCombination: true })],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(quote).toMatchObject({ saleFils: 20_000, couponFils: 8_000, totalFils: 72_000 });
    expect(quote.appliedRules.map((rule) => rule.id)).toEqual(["sale-20", "coupon-10"]);
  });

  it("caps a percentage coupon at its configured monetary maximum", () => {
    const quote = calculatePricingQuote({
      lines: [line("line-1", 100_000)],
      sales: [],
      coupons: [percentageRule("coupon-capped", "COUPON", 2_000, { maximumReductionFils: 15_000 })],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(quote).toMatchObject({ couponFils: 15_000, totalFils: 85_000 });
  });

  it("uses priority and then stable rule id when reductions tie", () => {
    const higherPriority = calculatePricingQuote({
      lines: [line("line-1", 50_000)],
      sales: [
        percentageRule("sale-low", "SALE", 1_000, { priority: 1 }),
        percentageRule("sale-high", "SALE", 1_000, { priority: 2 }),
      ],
      coupons: [],
      shippingFils: 0,
      taxFils: 0,
    });
    const stableId = calculatePricingQuote({
      lines: [line("line-1", 50_000)],
      sales: [percentageRule("sale-b", "SALE", 1_000), percentageRule("sale-a", "SALE", 1_000)],
      coupons: [],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(higherPriority.appliedRules[0].id).toBe("sale-high");
    expect(stableId.appliedRules[0].id).toBe("sale-a");
  });

  it("explains when a coupon cannot combine with the winning sale", () => {
    const quote = calculatePricingQuote({
      lines: [line("line-1", 100_000)],
      sales: [percentageRule("sale-20", "SALE", 2_000)],
      coupons: [percentageRule("coupon-10", "COUPON", 1_000, { allowSaleCombination: true })],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(quote).toMatchObject({ saleFils: 20_000, couponFils: 0, totalFils: 80_000 });
    expect(quote.rejections).toContainEqual({ ruleId: "coupon-10", code: "COMBINATION_NOT_ALLOWED" });
  });

  it("allocates a fixed reduction deterministically without exceeding a line", () => {
    const quote = calculatePricingQuote({
      lines: [line("line-b", 1_000), line("line-a", 1_000), line("line-c", 1_000)],
      sales: [],
      coupons: [{
        id: "coupon-fixed",
        version: 3,
        kind: "COUPON",
        reduction: { kind: "FIXED", value: 1_000 },
        priority: 0,
        eligibleLineIds: ["line-a", "line-b", "line-c"],
        allowSaleCombination: false,
        allowCouponCombination: false,
      }],
      shippingFils: 0,
      taxFils: 0,
    });

    expect(quote.lines.map(({ lineId, couponFils }) => [lineId, couponFils])).toEqual([
      ["line-b", 333],
      ["line-a", 334],
      ["line-c", 333],
    ]);
    expect(quote.totalFils).toBe(2_000);
  });
});
