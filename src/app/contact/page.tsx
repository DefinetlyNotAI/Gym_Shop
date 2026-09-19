import { redirect } from "next/navigation";
import { SupportPanel } from "@/components/support-panel";
import { LocalizedText as T } from "@/components/language-provider";
import { getSession } from "@/lib/api";
import { customerAccessDestination } from "@/lib/customer-access";

export const dynamic = "force-dynamic";

export default async function Contact() {
  const account = await getSession();
  if (account) {
    const destination = customerAccessDestination(account);
    if (destination) redirect(destination);
  }
  return (
    <main className="page">
      <h1>
        <T en="Support" ar="الدعم" />
      </h1>
      <p>
        <T
          en="Sign in to open and manage support tickets. Damage claims use the delivered-order workflow and its seven-day deadline."
          ar="سجّل الدخول لفتح طلبات الدعم وإدارتها. تستخدم مطالبات الضرر مسار الطلب المستلم ومهلة السبعة أيام."
        />
      </p>
      {account ? (
        <SupportPanel />
      ) : (
        <a className="primary" href="/account">
          <T en="Sign in" ar="تسجيل الدخول" />
        </a>
      )}
    </main>
  );
}
