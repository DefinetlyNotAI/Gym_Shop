import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { PasswordReset } from "@/components/password-reset";
import { apiGet, getSession } from "@/lib/api";
export const dynamic = "force-dynamic";
export default async function Account() {
  const account = await getSession();
  if (!account) {
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
  if (["SUSPENDED", "DELETION_PENDING"].includes(account.status))
    redirect("/account/restricted");
  return (
    <main className="page">
      <Link href="/">← Gym Shop</Link>
      <p className="eyebrow">{account.role}</p>
      <h1>{account.displayName}</h1>
      <p>{account.email}</p>
      <SignOutButton />
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
        {account.role !== "CUSTOMER" ? (
          <a href={process.env.ADMIN_ORIGIN ?? "https://admin.example.com"}>
            Staff app / تطبيق الموظفين
          </a>
        ) : null}
      </div>
    </main>
  );
}
