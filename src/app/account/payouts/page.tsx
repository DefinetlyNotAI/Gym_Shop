import Link from "next/link";
import { redirect } from "next/navigation";
import { PayoutPanel, type PayoutAvailability } from "@/components/verification-payout";
import { apiGet, getSession } from "@/lib/api";
export const dynamic = "force-dynamic";
export default async function PayoutsPage(){if(!(await getSession()))redirect("/account");const availability=await apiGet<PayoutAvailability>("/api/v1/account/payouts");if(!availability)redirect("/account");return <main className="page"><Link href="/account">← Account / الحساب</Link><h1>Wallet payouts / سحب المحفظة</h1><PayoutPanel availability={availability}/></main>}
