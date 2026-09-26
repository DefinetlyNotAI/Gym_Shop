That gives us a much cleaner hierarchy. I would define the roles like this:

| Role              | Purpose                          | Main access                                                                                                                                               |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer          | Standard account                 | Shopping, orders, support, reviews, referrals, store credit                                                                                               |
| Verified Customer | Approved notable/partner account | Customer capabilities + custom referral code + CliQ payout eligibility                                                                                    |
| Delivery Agent    | Internal delivery worker         | Assigned deliveries, required customer delivery details, delivery attempts and confirmation                                                               |
| Support Agent     | Customer service                 | Tickets, related orders, damage claims, replacement requests, customer assistance                                                                         |
| Logistic Staff    | Physical operations              | Products, inventory, stock movements, fulfillment, packing, shipments, delivery assignment                                                                |
| Finance Staff     | Financial operations             | Payments, CliQ payouts, referral earnings, wallet/store-credit adjustments, financial records                                                             |
| Admin             | General management               | Broad operational access, promotions, products, customers, orders, support, referrals, verification and basic audit access                                |
| Super Admin       | Senior administration            | Admin access + staff management, roles, permissions, sensitive settings and audit access                                                                  |
| CTO               | Absolute system authority        | Full platform access, security, system configuration, integrations, permissions, audit records, role-account creation and all administrative capabilities |

The privilege hierarchy would roughly be:

```text
admin.example.com

CTO
 ↓
Super Admin
 ↓
Admin
 ↓
Operational Staff
 ├── Logistic Staff
 ├── Finance Staff
 ├── Support Agent
 └── Delivery Agent

example.com

Customer
 └── Verified Customer
```

One architectural detail: `Verified Customer` should be implemented as a verification status/capability on a Customer rather than an actual authorization role.



Also, `CTO` should be the only truly unrestricted role. `Super Admin` can be extremely powerful, but there should still be a small set of CTO-only capabilities such as changing Super Admin access, critical security configuration, and other platform-level controls.



All roles such as `Super Admin`, `Admin` or any under `Operational Staff` cannot be created normally and are created manually by the `CTO` account only in a special section that also allow's bulk creation etc, the `CTO` account is by default created and there can only be 1 of this account, the default details are username `CTO` and password `abcd?1234`, when the `CTO` logs in for the first time, and the default values are in place, a special wizard page popup will appear to allow the `CTO` to change all details before being allowed to gain their permissions and access

Note that all sites do not work and show a special maintenance page if the `CTO` account hasn't been properly init



Audit access for `Super Admin`, `Admin` and `CTO` work in a special way, where the smaller role cannot access audits related to higher roles, aka if the `Super Admin` does a change and gets logged into audit, the `CTO` and `Super Admin` can view the audit change normally, whereas the `Admin` would see all normal logs, and for the log related to `Super Admin` will see a greyed out locked box with no details other than not having enough permissions to view this.

Also ANY log/audit thats flagged as sensitive requires the `Super Admin`, `Admin` and `CTO` to refresh their sessions before allowing to view them, this requirement appears if the current session is older than 2 hours, if it is older, sensitive audits are yellowed and warning saying user must refresh their session, clicking on it pops up a auth page which they can use to refresh before the audit unlocks, this doesn't lock normal audits



Audit page is for everyone, and its the same endpoint so do NOT make seperate pages, for example `Logistic Staff` audit will only show logistics related audits and not even render any other audits even as locked






