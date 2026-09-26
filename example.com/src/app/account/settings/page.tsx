import { AccountSecurity } from "@/components/account-security";
import { PhoneVerification } from "@/components/phone-verification";
import { ProfileAddresses } from "@/components/profile-addresses";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
type Address = {
  id: string;
  recipient: string;
  phone_e164: string;
  country: string;
  city: string;
  area: string;
  street: string;
  building: string | null;
  floor: string | null;
  unit: string | null;
  landmark: string | null;
  shipping_default: boolean;
  billing_default: boolean;
};
export default async function Settings() {
  const account = await requireCustomerSession();
  const data = await apiGet<{ addresses: Address[] }>(
    "/api/v1/account/addresses",
  );
  return (
    <main className="page">
      <h1>Settings / الإعدادات</h1>
      <p>
        Email: {account.email} ·{" "}
        {account.emailVerified ? "verified" : "unverified"}
      </p>
      <p>Phone: {account.phoneVerified ? "verified" : "unverified"}</p>
      <ProfileAddresses
        account={account}
        initialAddresses={data?.addresses ?? []}
      />
      <PhoneVerification />
      <AccountSecurity />
      <div className="quick-grid">
        <a href="/api/v1/account/export">Export my data / تصدير بياناتي</a>
      </div>
    </main>
  );
}
