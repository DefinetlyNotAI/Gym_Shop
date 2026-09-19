import Link from "next/link";
import { redirect } from "next/navigation";
import { ReferralAccount } from "@/components/referral-account";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  await requireCustomerSession();
  const summary = await apiGet<
    Parameters<typeof ReferralAccount>[0]["summary"]
  >("/api/v1/account/referrals");
  if (!summary) redirect("/account");
  return (
    <main className="page">
      <Link href="/account">← Account / الحساب</Link>
      <h1>Referrals / الإحالات</h1>
      <ReferralAccount
        summary={summary}
        origin={process.env.STOREFRONT_ORIGIN ?? "https://example.com"}
      />
    </main>
  );
}
