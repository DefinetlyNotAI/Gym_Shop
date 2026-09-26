import { NotificationCenter } from "@/components/notification-center";
import { LocalizedText as T } from "@/components/language-provider";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
export default async function Notifications() {
  await requireCustomerSession();
  return (
    <main className="page">
      <h1>
        <T en="Notifications" ar="الإشعارات" />
      </h1>
      <NotificationCenter />
    </main>
  );
}
