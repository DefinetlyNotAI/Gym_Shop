import type { Session } from "@/lib/api";

export function customerAccessDestination(
  account: Session | null,
  mode: "ordinary" | "restricted" = "ordinary",
): "/account" | "/account/restricted" | null {
  if (
    !account ||
    account.role !== "CUSTOMER" ||
    account.sessionKind !== "NORMAL"
  )
    return "/account";
  const restricted = ["SUSPENDED", "DELETION_PENDING"].includes(account.status);
  if (mode === "restricted") return restricted ? null : "/account";
  if (restricted) return "/account/restricted";
  return account.status === "ACTIVE" ? null : "/account";
}

export function customerAccountLanding(
  account: Session | null,
): "signed-out" | "customer" | "restricted" | "staff" | "unavailable" {
  if (!account) return "signed-out";
  const destination = customerAccessDestination(account);
  if (!destination) return "customer";
  if (destination === "/account/restricted") return "restricted";
  return account.role === "CUSTOMER" ? "unavailable" : "staff";
}
