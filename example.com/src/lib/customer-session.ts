import { redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/api";
import { customerAccessDestination } from "@/lib/customer-access";

export async function requireCustomerSession(
  mode: "ordinary" | "restricted" = "ordinary",
): Promise<Session> {
  const account = await getSession();
  const destination = customerAccessDestination(account, mode);
  if (destination) redirect(destination);
  if (!account) redirect("/account");
  return account;
}
