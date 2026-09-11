export const payoutProviderStatus = {
  available: false,
  code: "PAYOUT_PROVIDER_UNAVAILABLE",
  reason: "Business CliQ provider contract, API documentation, credentials, tariff, and sandbox evidence are not configured.",
} as const;

export function getPayoutProviderStatus() {
  return payoutProviderStatus;
}
