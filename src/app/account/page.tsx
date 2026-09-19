import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { LocalizedText as T } from "@/components/language-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { PasswordReset } from "@/components/password-reset";
import { apiGet, getSession } from "@/lib/api";
import { customerAccountLanding } from "@/lib/customer-access";
export const dynamic = "force-dynamic";
export default async function Account() {
  const account = await getSession();
  const landing = customerAccountLanding(account);
  if (landing === "signed-out") {
    const legal = await apiGet<{
      termsEn: {
        id: string;
        title: string;
        body: string;
        version: string;
      } | null;
    }>("/api/v1/legal");
    return (
      <main className="page auth-page">
        <Link href="/">← Gym Shop</Link>
        <h1>Account / الحساب</h1>
        <AuthPanel terms={legal!.termsEn} />
        <PasswordReset />
      </main>
    );
  }
  if (landing === "restricted") redirect("/account/restricted");
  if (!account) redirect("/account");
  return (
    <main className="page">
      <Link href="/">← Gym Shop</Link>
      <p className="eyebrow">{account.role}</p>
      <h1>{account.displayName}</h1>
      <p>{account.email}</p>
      <SignOutButton />
      {landing === "customer" ? (
        <div className="quick-grid">
          <Link href="/account/orders">Orders / الطلبات</Link>
          <Link href="/account/rewards">
            Rewards & wallet / المكافآت والمحفظة
          </Link>
          <Link href="/account/referrals">Referrals / الإحالات</Link>
          <Link href="/account/reviews">Reviews / المراجعات</Link>
          <Link href="/account/verification">
            Partner verification / توثيق الشريك
          </Link>
          <Link href="/account/payouts">Wallet payouts / سحب المحفظة</Link>
          <Link href="/cart">Cart / السلة</Link>
          <Link href="/account/notifications">Notifications / الإشعارات</Link>
          <Link href="/account/settings">Settings / الإعدادات</Link>
          <Link href="/contact">Support / الدعم</Link>
        </div>
      ) : landing === "staff" ? (
        <section className="panel staff-account-route">
          <span className="eyebrow">
            <T en="Staff session" ar="جلسة موظف" />
          </span>
          <h2>
            <T
              en="Continue in the staff workspace"
              ar="تابع في مساحة الموظفين"
            />
          </h2>
          <p>
            <T
              en="Customer orders, settings, rewards and checkout are available only to customer sessions. Your staff session remains active."
              ar="الطلبات والإعدادات والمكافآت والدفع متاحة فقط لجلسات العملاء. ستبقى جلسة الموظف نشطة."
            />
          </p>
          <a
            className="primary"
            href={process.env.ADMIN_ORIGIN ?? "https://admin.example.com"}
          >
            <T en="Open staff app" ar="فتح تطبيق الموظفين" />
          </a>
        </section>
      ) : (
        <section className="panel staff-account-route">
          <span className="eyebrow">
            <T en="Customer session unavailable" ar="جلسة العميل غير متاحة" />
          </span>
          <h2>
            <T
              en="Customer tools are not available in this session"
              ar="أدوات العميل غير متاحة في هذه الجلسة"
            />
          </h2>
          <p>
            <T
              en="Sign out, then use an active customer account with a normal sign-in session."
              ar="سجّل الخروج، ثم استخدم حساب عميل نشطًا بجلسة تسجيل دخول عادية."
            />
          </p>
        </section>
      )}
    </main>
  );
}
