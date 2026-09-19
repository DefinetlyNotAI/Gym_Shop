import { redirect } from "next/navigation";
import { CartEditor } from "@/components/cart-editor";
import { LocalizedText as T } from "@/components/language-provider";
import { apiGet, getSession } from "@/lib/api";
import { customerAccessDestination } from "@/lib/customer-access";
import type { CartLine } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function Cart() {
  const account = await getSession();
  if (account) {
    const destination = customerAccessDestination(account);
    if (destination) redirect(destination);
  }
  const cart = await apiGet<{ lines: CartLine[] }>("/api/v1/cart", true);
  return (
    <main className="page">
      <h1>
        <T en="Selected cart" ar="السلة المختارة" />
      </h1>
      <CartEditor
        initialLines={cart?.lines ?? []}
        signedIn={Boolean(account)}
      />
      <p>
        <T
          en="Cart lines do not reserve stock. Checkout revalidates current price and availability."
          ar="لا تحجز عناصر السلة المخزون. يعيد الدفع التحقق من السعر والتوفر الحاليين."
        />
      </p>
    </main>
  );
}
