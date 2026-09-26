import { CheckoutForm } from "@/components/checkout-form";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
type Options = {
  account: { phoneVerified: boolean; status: string };
  zones: Parameters<typeof CheckoutForm>[0]["zones"];
  pickups: Parameters<typeof CheckoutForm>[0]["pickups"];
  terms: { id: string; title: string; body: string; version: string } | null;
  simulation: boolean;
};
export default async function Checkout() {
  await requireCustomerSession();
  const options = await apiGet<Options>("/api/v1/checkout/options");
  return (
    <main className="page">
      <h1>Checkout / الدفع</h1>
      {!options!.account.phoneVerified ? (
        <p className="alert">
          Verify your phone with WhatsApp before checkout. / تحقق من رقم هاتفك
          عبر واتساب قبل الدفع.
        </p>
      ) : null}
      {!options!.terms ? (
        <p className="alert">
          Checkout is blocked until reviewed terms are published.
        </p>
      ) : !options!.zones.length && !options!.pickups.length ? (
        <p className="alert">
          Checkout is blocked until delivery or pickup is configured.
        </p>
      ) : (
        <>
          <article className="panel prose">
            <h2>{options!.terms.title}</h2>
            <p>{options!.terms.body}</p>
            <small>Version {options!.terms.version}</small>
          </article>
          <CheckoutForm
            zones={options!.zones}
            pickups={options!.pickups}
            termsId={options!.terms.id}
            simulation={options!.simulation}
          />
        </>
      )}
    </main>
  );
}
