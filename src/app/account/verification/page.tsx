import Link from "next/link";
import { redirect } from "next/navigation";
import {
  VerificationPanel,
  type VerificationSummary,
} from "@/components/verification-payout";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
export default async function VerificationPage() {
  await requireCustomerSession();
  const summary = await apiGet<VerificationSummary>(
    "/api/v1/account/verification",
  );
  if (!summary) redirect("/account");
  return (
    <main className="page">
      <Link href="/account">← Account / الحساب</Link>
      <h1>Partner verification / توثيق الشريك</h1>
      <VerificationPanel summary={summary} />
    </main>
  );
}
