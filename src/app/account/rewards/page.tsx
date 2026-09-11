import Link from "next/link";
import { redirect } from "next/navigation";
import { RewardsWallet } from "@/components/rewards-wallet";
import { apiGet, getSession } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const account = await getSession();
  if (!account) redirect("/account");
  const summary = await apiGet<Parameters<typeof RewardsWallet>[0]["summary"]>("/api/v1/account/rewards");
  if (!summary) redirect("/account");
  return <main className="page">
    <Link href="/account">← Account / الحساب</Link>
    <h1>Rewards & wallet / المكافآت والمحفظة</h1>
    <RewardsWallet summary={summary} />
  </main>;
}
