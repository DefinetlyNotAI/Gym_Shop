type HostedResult = {
  orderId: string;
  paymentUrl: string;
  paymentFields: Record<string, string>;
};
export async function simulateHostedPayment(
  result: HostedResult,
  outcome: "success" | "failure" | "pending",
  origin: string,
  transport: typeof fetch = fetch,
): Promise<string> {
  const url = new URL(result.paymentUrl, origin);
  if (
    url.origin !== origin ||
    url.pathname !== "/api/v1/payments/simulate" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Unexpected SIM payment destination");
  if (result.paymentFields.merchant_reference !== `sim_${result.orderId}`)
    throw new Error("Unexpected SIM payment reference");
  if (!["success", "failure", "pending"].includes(outcome))
    throw new Error("Unexpected SIM outcome");
  const fields = new URLSearchParams({ ...result.paymentFields, outcome });
  // Native form navigation under no-referrer sends Origin:null. CORS-mode fetch
  // retains the real Origin without weakening the privacy or CSRF policies.
  const response = await transport(url.href, {
    method: "POST",
    mode: "cors",
    credentials: "same-origin",
    body: fields,
  });
  if (!response.ok)
    throw new Error(
      `Simulated payment failed (${response.status}). Open your order to check its status.`,
    );
  const destination = new URL(response.url);
  if (
    destination.origin !== origin ||
    destination.pathname !== "/checkout/success" ||
    destination.searchParams.get("order") !== result.orderId ||
    !["confirmed", "failed", "pending"].includes(
      destination.searchParams.get("payment") ?? "",
    )
  )
    throw new Error("Unexpected SIM payment response");
  return destination.pathname + destination.search;
}
