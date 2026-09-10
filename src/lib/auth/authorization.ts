import { withDatabaseClient } from "@/lib/db/client";
import type { CurrentAccount } from "./session";

export function requireCustomer(account: CurrentAccount | null): CurrentAccount {
  if (!account) throw new Error("AUTH_REQUIRED");
  if (account.role !== "CUSTOMER") throw new Error("CUSTOMER_ROLE_REQUIRED");
  if (account.sessionKind !== "NORMAL") throw new Error("EMERGENCY_SESSION_RESTRICTED");
  if (["SUSPENDED", "DELETION_PENDING"].includes(account.status)) throw new Error("ACCOUNT_RESTRICTED");
  if (account.status !== "ACTIVE") throw new Error("ACCOUNT_INACTIVE");
  return account;
}

export function requireCustomerPortal(account:CurrentAccount|null):CurrentAccount{
  if(!account)throw new Error("AUTH_REQUIRED");
  if(account.role!=="CUSTOMER")throw new Error("CUSTOMER_ROLE_REQUIRED");
  if(account.sessionKind!=="NORMAL")throw new Error("EMERGENCY_SESSION_RESTRICTED");
  if(!["ACTIVE","SUSPENDED","DELETION_PENDING"].includes(account.status))throw new Error("ACCOUNT_INACTIVE");
  return account;
}

export async function requirePermission(account: CurrentAccount | null, permission: string): Promise<CurrentAccount> {
  if (!account) throw new Error("AUTH_REQUIRED");
  if (account.sessionKind !== "NORMAL") throw new Error("EMERGENCY_SESSION_RESTRICTED");
  const result = await withDatabaseClient((client) => client.execute<{sensitive:boolean}>(
    `SELECT permission.sensitive FROM staff_account AS staff
     JOIN role_permission AS grant_row ON grant_row.role_id = staff.role_id
     JOIN permission ON permission.id=grant_row.permission_id
     WHERE staff.account_id = $1 AND staff.status = 'ACTIVE' AND grant_row.permission_id = $2`,
    [account.id, permission],
  ));
  if (!result.rowCount) throw new Error("PERMISSION_DENIED");
  if(result.rows[0].sensitive)requireRecentAuthentication(account,300);
  return account;
}

export function requireRecentAuthentication(account: CurrentAccount, seconds: number): void {
  if (Date.now() - new Date(account.authenticatedAt).getTime() > seconds * 1000) throw new Error("RECENT_AUTH_REQUIRED");
}
