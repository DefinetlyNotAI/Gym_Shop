export type PricingLineInput = {
  lineId: string;
  unitBaseFils: number;
  quantity: number;
};

export type PricingReduction =
  | { kind: "PERCENTAGE"; value: number }
  | { kind: "FIXED"; value: number }
  | { kind: "FIXED_FINAL_PRICE"; value: number };

export type PricingRuleInput = {
  id: string;
  version: number;
  kind: "SALE" | "COUPON" | "REFERRAL";
  reduction: PricingReduction;
  priority: number;
  eligibleLineIds: string[];
  allowSaleCombination: boolean;
  allowCouponCombination: boolean;
  maximumReductionFils?: number;
  minimumMerchandiseFils?: number;
};

export type PricingLineQuote = {
  lineId: string;
  quantity: number;
  unitBaseFils: number;
  baseFils: number;
  saleFils: number;
  couponFils: number;
  referralFils: number;
  netFils: number;
};

export type AppliedPricingRule = {
  id: string;
  version: number;
  kind: PricingRuleInput["kind"];
  amountFils: number;
  allocations: { lineId: string; amountFils: number }[];
};

export type PricingRejection = {
  ruleId: string;
  code:
    | "MINIMUM_NOT_MET"
    | "COMBINATION_NOT_ALLOWED"
    | "NO_ELIGIBLE_LINES"
    | "SCOPE_NOT_ELIGIBLE"
    | "ACCOUNT_NOT_ELIGIBLE"
    | "SCHEDULE_INACTIVE"
    | "COUPON_NOT_FOUND"
    | "COUPON_ASSIGNED_ACCOUNT_MISMATCH";
};

export type PricingQuote = {
  merchandiseBaseFils: number;
  saleFils: number;
  couponFils: number;
  referralFils: number;
  merchandiseNetFils: number;
  shippingFils: number;
  taxFils: number;
  totalFils: number;
  lines: PricingLineQuote[];
  appliedRules: AppliedPricingRule[];
  rejections: PricingRejection[];
};

export type CalculatePricingQuoteInput = {
  lines: PricingLineInput[];
  sales: PricingRuleInput[];
  coupons: PricingRuleInput[];
  referral?: PricingRuleInput;
  shippingFils: number;
  taxFils: number;
};
