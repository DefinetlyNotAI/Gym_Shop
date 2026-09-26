For the Admin System, treat `admin.example.com` as one role-aware control panel rather than separate dashboards per role. The backend decides what each user can access, and the UI hides sections they have no permission to use.

The main structure should be:

```text
admin.example.com
├── Dashboard
├── Products
├── Collections
├── Inventory
├── Orders
├── Logistics
├── Deliveries
├── Customers
├── Support
├── Finance
├── Promotions
├── Referrals
├── Verification
├── Reviews
├── Notifications
├── Analytics
├── Audits
├── Staff
└── Settings
```

Not every role sees every section.

The dashboard should be role-aware. CTO and Super Admin get the broadest operational overview, while lower roles see only relevant widgets.

For example, Logistic Staff could see:

```text
Orders waiting for packing
Low-stock variants
Out-of-stock variants
Deliveries awaiting assignment
Failed delivery attempts
Recent stock movements
```

Finance Staff could see:

```text
Payments today
Pending CliQ payouts
Failed payouts
Referral liabilities
Store-credit adjustments
Financial anomalies
```

Support Agent could see:

```text
Open tickets
Awaiting staff
High-priority tickets
Damage claims
Replacement requests
Recently assigned tickets
```

The CTO bootstrap state sits above the normal admin system entirely.

Until the CTO initialization is complete:

```text
example.com
admin.example.com
api.example.com
```

all operate in maintenance mode.

Only the CTO initialization flow is available.

Conceptually:

```text
Platform starts
    ↓
CTO exists?
    ↓ yes
CTO initialized?
    ↓ no
MAINTENANCE MODE
    ↓
CTO login
    ↓
Forced initialization wizard
    ↓
Initialization committed
    ↓
Platform enabled
```

The initialization wizard should require changing all default-sensitive information before granting CTO capabilities.

That includes at minimum:

```text
Username
Password
Email
Name/profile details
MFA setup
Recovery information if supported
```

The system should never consider the CTO initialized if the default password `abcd?1234` is still active.

Staff management should be a dedicated section.

Only the CTO can create:

```text
Super Admin
Admin
Logistic Staff
Finance Staff
Support Agent
Delivery Agent
```

There is no public registration path for them.

The Staff section should support:

```text
Create staff account
Bulk create staff accounts
Disable staff account
Re-enable staff account
Reset credentials
Force password reset
Assign permitted role
View sessions
Revoke sessions
View account status
View staff audit history
```

For bulk creation, CTO could upload or enter multiple records, preview them, validate conflicts, then create them in one operation.

Example:

```text
Name        Email                Role
Adam        adam@example.com     Logistic Staff
Sarah       sarah@example.com    Finance Staff
Omar        omar@example.com     Delivery Agent
```

Each staff account should ideally receive temporary credentials and be forced to initialize its own password on first login.

Super Admin should not be able to create another Super Admin or change Super Admin access if that remains CTO-only.

Admin should not be able to create privileged staff accounts either.

The Products section should handle:

```text
Products
Variants
Categories
Collections
Images
Attributes
Size charts
SEO
Badges
Related products
```

Typical permissions:

```text
CTO
Super Admin
Admin
Logistic Staff: operational product access where needed
```

Whether Logistic Staff can modify product descriptions or only inventory-related product fields should be permission-controlled rather than assumed.

Inventory should provide:

```text
Stock by variant
Low stock
Out of stock
Reservations
Stock movements
Restocking
Manual adjustments
Damaged inventory
Inventory history
Exports
```

Logistic Staff should be the main operational role here.

Manual stock changes require:

```text
Quantity change
Reason
Optional note
Actor
Timestamp
Before quantity
After quantity
```

Orders should expose:

```text
Order details
Customer
Items
Pricing snapshots
Payments
Discounts
Referral details
Store credit
Fulfillment
Delivery
Support cases
Replacement orders
Timeline
Internal notes
Audit history
```

Actions depend on permission.

For example:

```text
Logistic Staff
- process
- pack
- prepare delivery

Support Agent
- view related order
- create replacement workflow

Finance Staff
- inspect financial/payment data

Admin+
- broader order management
```

Logistics should cover the physical workflow between paid order and internal delivery.

```text
Paid
 ↓
Processing
 ↓
Picking
 ↓
Packed
 ↓
Ready for delivery
 ↓
Delivery assignment
```

The logistics section should include:

```text
Orders awaiting processing
Picking queue
Packing queue
Ready-for-delivery queue
Internal shipments
Packages
Delivery batches
Stock-related blockers
Replacement fulfillment
```

Delivery management should cover:

```text
Unassigned deliveries
Assigned deliveries
Out for delivery
Failed deliveries
Rescheduled deliveries
Delivered
Delivery attempts
Delivery proof
```

Logistic Staff can assign work.

Delivery Agents only see their own assigned deliveries and necessary customer delivery information.

Customer management should provide a controlled view of accounts.

```text
Profile
Orders
Addresses
Support history
Reviews
Referral status
Verification status
Wallet/store credit
Account state
Sessions where permitted
```

Sensitive information should be permission-scoped.

Admins should not see credentials or password hashes.

Support should use the ticket system already planned:

```text
Queues
Assignments
Messages
Attachments
Internal notes
Damage claims
Replacement requests
Escalations
Ticket history
```

Support Agent access stays focused here.

Finance should centralize money-related operations:

```text
Payments
Payment failures
CliQ payouts
Verified-referral earnings
Store-credit ledger
Manual wallet adjustments
Financial corrections
Order financial breakdowns
Payout reconciliation
```

Any manual financial adjustment should require a reason and audit record.

Promotions should contain:

```text
Campaigns
Sales
Discount codes
Automatic offers
Bundles
Free-shipping offers
Referral promotions
Campaign budgets
Scheduling
Conflict simulation
Analytics
```

Admin and Super Admin would normally manage this.

The simulation tool we discussed earlier belongs here:

```text
Customer
Cart
Products
Region
Referral code
Coupon
Store credit
       ↓
Simulate
       ↓
Base subtotal
Sales
Promotions
Coupon
Referral
Shipping
Final total
```

No real transaction is created.

Referrals should provide:

```text
Referral accounts
Codes
Relationships
Rewards
Pending rewards
Completed rewards
Fraud flags
Campaigns
Account-specific rates
Store-credit earnings
Cash-eligible earnings
```

Finance handles payout operations while Admin/Super Admin can manage referral rules according to permission.

Verification should contain:

```text
Pending applications
Under review
Approved
Rejected
Cooldown status
Evidence
Internal notes
Verification history
Revocations
```

Sensitive uploaded verification evidence must be tightly access-controlled.

Reviews should have:

```text
Pending
Published
Reported
Hidden
Rejected
Product filters
Customer filters
Moderation history
```

Staff can moderate but should never rewrite a customer's review.

Notifications should provide:

```text
Templates
Transactional notifications
Marketing campaigns
Queued notifications
Failures
Retries
Delivery status
Customer preferences
Admin alerts
```

Only appropriate roles should manage bulk campaigns.

Analytics should eventually become role-aware too.

CTO/Super Admin:

```text
Full platform analytics
```

Admin:

```text
Broad business analytics
```

Operational roles:

```text
Only their domain
```

For example Finance Staff does not need support-agent performance data, and Delivery Agents do not need revenue dashboards.

The Audit section is shared for every role and always uses the same endpoint/page.

The backend determines which records are returned and at what visibility level.

For Admin:

```text
Admin-created audit
→ Full details

Super Admin-created audit
→ Locked placeholder

CTO-created audit
→ Locked placeholder
```

For Super Admin:

```text
Admin-created audit
→ Full details

Super Admin-created audit
→ Full details

CTO-created audit
→ Locked placeholder
```

For CTO:

```text
Everything
→ Full details
```

Operational roles work differently.

Example Logistic Staff:

```text
Relevant logistics audit
→ Render normally

Finance audit
→ Not returned
→ Not rendered

Admin-level unrelated audit
→ Not returned
→ Not rendered
```

That distinction is important. Locked placeholders are for hierarchical visibility where the audit is relevant to the higher-level shared administrative view. Operational staff should simply never receive unrelated audits.

Sensitive audits add another layer.

If:

```text
session age <= 2 hours
```

and permissions allow viewing:

```text
Sensitive audit
→ Visible
```

If:

```text
session age > 2 hours
```

then:

```text
Sensitive audit
→ Yellow locked state
→ Re-authentication required
```

Clicking it starts a re-authentication flow.

After successful authentication:

```text
Session freshness renewed
→ Sensitive audits unlock
```

Normal audits remain available the whole time.

The Staff section should also expose account lifecycle state:

```text
INVITED
INITIALIZATION_REQUIRED
ACTIVE
SUSPENDED
DISABLED
```

A newly created staff account should not immediately have unrestricted use if it still has temporary/default credentials.

Settings should be split by sensitivity.

Normal administrative settings might include:

```text
Store information
Shipping zones
Order settings
Promotion defaults
Inventory defaults
Notification templates
Support settings
```

Higher-level Super Admin settings might include:

```text
Staff policy
Security policy
Financial configuration
Audit retention
Platform-wide operational settings
```

CTO-only settings should include things such as:

```text
Super Admin access
Critical security configuration
Platform security controls
Core integrations
System maintenance controls
Critical infrastructure settings
Role/permission architecture
Emergency access controls
```

The backend should have explicit permission checks rather than relying only on role names.

Example:

```text
inventory.adjust
orders.fulfill
support.reply
support.approve_replacement
finance.wallet_adjust
finance.payout_execute
verification.approve
staff.create
staff.assign_role
super_admin.manage
security.configure
```

Roles then receive permission sets.

CTO effectively bypasses normal permission restrictions, except where the system itself enforces safety constraints.

The sidebar should dynamically render only authorized areas.

Example Logistic Staff:

```text
Dashboard
Products
Inventory
Orders
Logistics
Deliveries
Audits
```

Finance Staff:

```text
Dashboard
Orders
Finance
Referrals
Audits
```

Support Agent:

```text
Dashboard
Customers
Orders
Support
Audits
```

CTO:

```text
Everything
```

Admin actions that alter important state should support reasons where appropriate:

```text
Suspend customer
Adjust inventory
Adjust wallet
Approve replacement
Reject verification
Disable referral code
Cancel order
Modify staff access
```

Those reasons feed directly into audit history.

The core admin architecture becomes:

```text
                CTO
                 │
         Critical platform control
                 │
             Super Admin
                 │
               Admin
                 │
       ┌─────────┼──────────┐
       ↓         ↓          ↓
   Logistics   Finance    Support
       │
       ↓
   Delivery Agents
```

with the Admin System underneath:

```text
Authentication
      ↓
Role + Permissions
      ↓
Admin API
      ↓
Authorized modules
      ↓
Actions
      ↓
Domain systems
      ↓
Audit system
```

The key design principle is that `admin.example.com` is one application, but every menu, endpoint, record, field, and action is authorization-aware. We should not build separate admin websites for each role.

Just remember permissions are based on granular class-based permissions assigned to roles which are not hardcoded

Admin based roles can also have a permission to allow simulation of what `Operational Staff` may see, for example `Admin` can temporarily change their view-role to `Finance Staff` to simulate exactly what it looks like, they may exit this at any time they like, this also is a view-only and they cannot edit anything; The `CTO` can take this further and simulate the `Admin` and `Super Admin` as well (`Super Admin` cannot do this to `Admin`), as well as simulate exact users
