import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewEditor } from "@/components/review-editor";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireCustomerSession();
  const data = await apiGet<Parameters<typeof ReviewEditor>[0]["data"]>(
    "/api/v1/account/reviews",
  );
  if (!data) redirect("/account");
  return (
    <main className="page">
      <Link href="/account">← Account / الحساب</Link>
      <h1>Your reviews / مراجعاتك</h1>
      <ReviewEditor data={data} />
    </main>
  );
}
