export const payoutProviderStatus = {
  name: "Amazon Payment Services",
  available: false,
  code: "PAYOUT_PROVIDER_UNAVAILABLE",
  reason: "Amazon Payment Services is the selected payment integration. All-source wallet withdrawals remain unavailable until APS beneficiary-disbursement capability, merchant approval, API contract, tariff and sandbox evidence are verified. Card refunds and merchant settlement are not wallet payouts.",
} as const;

export function getPayoutProviderStatus() {
  return payoutProviderStatus;
}
