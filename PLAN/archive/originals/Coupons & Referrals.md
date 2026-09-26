A discount should have these feature groups (All in JOD):

* Identity
  
  * Internal ID
  * Discount code, such as `WELCOME10`
  * Internal name
  * Customer-facing description
  * Enabled/disabled
  * Created at
  * Updated at

* Discount value
  
  * Type
    
    * Percentage
    * Fixed amount
  
  * Value
    
    * `10%`
    * `5 JOD`
  
  * Maximum discount amount
    
    * Example: `10% off, maximum 15 JOD`
    * Optional/unlimited for fixed discounts

* Usage limits
  
  * Maximum global uses
    
    * Unlimited
    * Specific value, such as `500`
  
  * Maximum uses per account
    
    * Unlimited
    * `1`
    * Any specified value
  
  * Current global usage
  
  * Customer-specific usage count
  
  * One discount per order or allow stacking

* Order requirements
  
  * Minimum spend
    
    * Example: at least `30 JOD`
  
  * Whether shipping/taxes counts toward minimum spend

* Product eligibility
  
  * Entire store
  * Specific products
  * Specific categories
  * Specific collections
  * Specific variants
  * Excluded products
  * Excluded categories
  * Excluded collections
  * Available to stack with other coupons/codes?

* Customer eligibility
  
  * Everyone
  * New customers only (below X amount of months or purchases)
  * Existing customers only (over X amount of months)
  * First order only
  * Referral customers
  * Loyalty members
  * Specific customer groups

* Time restrictions
  
  * Starts at
  * Expires at
  * No expiration option
  * Optional specific days
  * Optional usage window

* Combination rules
  
  * Can combine with product sales?
  * Can combine with another coupon?
  * Can combine with referral rewards?
  * Can combine with loyalty/store credit?
  * Maximum number of discounts per order
  * Priority when multiple automatic discounts qualify

* Application method
  
  * Manual coupon code
  * Automatically applied
  * Referral code
  * Account-assigned reward
  * Admin-issued discount

* Administration and tracking
  
  * Number of successful uses
  * Number of unique customers
  * Total amount discounted
  * Revenue associated with discount
  * Orders using the discount
  * Created by
  * Last modified by
  * Disable/revoke discount

For example, a normal promotion could be represented conceptually as:

```text
Code: GYM20

Type: Percentage
Value: 20%
Maximum discount: 15 JOD

Minimum spend: 50 JOD

Global uses: 1,000
Uses per account: 1

Applies to:
  All products

Excludes:
  Products already on sale

Starts:
  2026-09-10

Expires:
  2026-09-20

Stacking:
  Product sales: No
  Other coupons: No
  Referral rewards: No
  Loyalty credit: Yes
```

Then:

```text
Cart subtotal:       40 JOD
Result:              Rejected
Reason:              Minimum spend is 50 JOD

Cart subtotal:       60 JOD
20%:                 12 JOD
Discount:            12 JOD

Cart subtotal:       100 JOD
20%:                 20 JOD
Maximum discount:    15 JOD
Discount:            15 JOD
```

One important distinction I would make is between a discount definition and a discount code. They should not necessarily be the same object.

For example:

```text
Discount Campaign
└── "Referral September"
    ├── 10% off
    ├── maximum 10 JOD
    ├── minimum spend 30 JOD
    ├── first order only
    └── expires Sep 30

Codes
├── SHAHM-A7F2
├── ADAM-K8P4
├── JOHN-M2Q9
└── ...
```

That way 10,000 referral codes do not require 10,000 duplicated discount configurations.

The same engine can eventually power normal coupon codes, referral codes, first-order offers, loyalty rewards, influencer codes and automatically applied sales. The metadata and eligibility rules determine how each behaves rather than implementing six separate discount systems.

----

Split the system into Referrals, Verification, and Rewards. Verification changes what someone can do with referral rewards, but the underlying referral tracking stays the same.

- Referral identity
  
  - Every registered account automatically receives a referral code
  
  - Normal accounts receive a randomly generated code
    
    - Example: `R7KM4Q2X`
    
    - Cannot be customized
  
  - Verified accounts can select a custom referral code
    
    - Example: `SHAHM`
    
    - Must be unique
    
    - Case-insensitive uniqueness
    
    - Reserved words cannot be used
    
    - Minimum/maximum length
    
    - Allowed-character restrictions
    
    - Previous codes can optionally remain reserved after changes
  
  - Referral link generated from the code
    
    - `example.com/?ref=SHAHM`
  
  - Referral code can also be entered manually during checkout
  
  - Each code belongs to exactly one account
  
  - Admin can disable individual referral codes

- Referral attribution
  
  - Referral is associated when a new customer
    
    - Visits through a referral link
    
    - Or manually enters the referral code
  
  - Customer must have an account
  
  - Customer cannot refer themselves
  
  - Existing customers cannot become referred customers after already completing an order
  
  - One customer can only have one referrer
  
  - Referral attribution becomes permanent once qualifying conditions are satisfied
  
  - Changing referral codes later does not change historical referrals
  
  - Store the exact referral code originally used for auditing

- Referred customer reward
  
  - Uses the existing smart discount engine
  
  - Configurable by administrators
    
    - Percentage discount
    
    - Fixed discount
    
    - Minimum spend
    
    - Maximum discount
    
    - Eligible products
    
    - Excluded products
    
    - Expiration
  
  - Normally restricted to first purchase
  
  - Cannot repeatedly use different referral codes
  
  - Referral campaign determines stacking rules

Example:

```text
Referral campaign:
New Customer Referral

Reward:
15% off

Minimum spend:
30 JOD

Maximum discount:
10 JOD

Uses:
1 per referred customer

Eligibility:
First completed order only
```

- Referrer commission
  
  - Administrators configure the reward
  
  - Fixed reward
    
    - Example: `5 JOD`
  
  - Percentage commission
    
    - Example: `5%`
  
  - Percentage commissions can have
    
    - Minimum qualifying order value
    
    - Maximum commission per order
  
  - Different referral campaigns can have different commission rates
  
  - Verified partners could eventually receive individually negotiated rates

Example:

```text
Customer order:
80 JOD

Commission:
5%

Calculated reward:
4 JOD
```

- Referral lifecycle
  
  - `ATTRIBUTED`
    
    - Referral relationship recorded
  
  - `PENDING`
    
    - Qualifying order placed
  
  - `QUALIFIED`
    
    - Payment successful and other requirements satisfied
  
  - `COMPLETED`
    
    - Order delivered and reward approved
  
  - `REJECTED`
    
    - Referral failed eligibility checks
  
  - `REVOKED`
    
    - Previously issued reward reversed administratively where appropriate

I would make the reward pending until delivery rather than immediately after payment.

```text
Referral used
    ↓
Order placed
    ↓
Payment successful
    ↓
PENDING
    ↓
Order delivered
    ↓
COMPLETED
    ↓
Reward balance credited
```

- Normal account rewards
  
  - Referral earnings become store credit
  
  - No cash withdrawal
  
  - Store credit belongs to that account
  
  - Can be spent during checkout
  
  - Cannot be transferred between accounts
  
  - Cannot be converted to cash
  
  - Cannot be gifted
  
  - Maintain complete credit transaction history
  
  - Admin-configurable expiration policy
  
  - Store credit should be treated separately from coupon codes

Example:

```text
Referral earnings

Available:  14.50 JOD
Pending:     5.00 JOD
Used:       10.00 JOD
Lifetime:   24.50 JOD
```

- Verified account rewards
  
  - Default get store credit
  
  - Can request eligible earnings as cash from their store credits
  
  - All accounts have a minimum cashout value, so they cannot cash out on small values
  
  - Cash payouts handled through CliQ
  
  - Only verified accounts can access payout functionality
  
  - Payout account must be successfully configured
  
  - Configurable minimum payout threshold
  
  - Track
    
    - Available balance
    
    - Pending balance
    
    - Store-credit balance
    
    - Withdrawn amount
    
    - Payout history
  
  - Failed payouts return to available balance rather than disappearing
  
  - Admin can suspend payouts without necessarily suspending the storefront account

- Verification
  
  - Verification is granted by staff
  
  - It is not automatically obtained through follower counts or referral volume
  
  - Intended primarily for creators, athletes, public figures, influencers, partners, or other approved notable accounts
  
  - Users can submit a verification application
  
  - Application contains
    
    - Display/public name
    
    - Reason for verification
    
    - Relevant platforms
    
    - Social/profile links
    
    - Supporting evidence
    
    - Proof uploads
  
  - Application states
    
    - `PENDING`
    
    - `UNDER_REVIEW`
    
    - `APPROVED`
    
    - `REJECTED`
    
    - `CANCELLED`
  
  - Approval grants verified status
  
  - Rejection starts a six-month application cooldown
  
  - Rejected users can continue using normal referrals
  
  - Staff can revoke verification

- Verification cooldown
  
  - Record rejection timestamp
  
  - Calculate next eligible application date
  
  - Do not simply hide the application button
  
  - Backend must enforce the six-month restriction
  
  - Account can see when it becomes eligible again

Example:

```text
Verification request

Status:
Rejected

Decision:
September 5, 2026

Eligible to apply again:
March 5, 2027
```

- Verified profile capabilities
  
  - Verification badge
  
  - Custom referral code
  
  - Cash payout eligibility
  
  - Payout configuration
  
  - Potentially higher referral rates
  
  - Potentially campaign-specific codes
  
  - Verification does not grant administrative privileges
  
  - Verification does not exempt the account from referral rules

- Referral dashboard
  
  - Referral code
  
  - Copy referral link
  
  - Referral statistics
    
    - Clicks, if tracking is enabled
    
    - Signups
    
    - Pending referrals
    
    - Completed referrals
    
    - Rejected referrals
  
  - Earnings
    
    - Pending
    
    - Available
    
    - Spent
    
    - Lifetime
  
  - Reward transaction history
  
  - Normal users
    
    - Store-credit information
  
  - Verified users additionally see
    
    - Cash balance
    
    - Payout configuration
    
    - Request payout
    
    - Payout history

- Anti-abuse
  
  - No self-referrals
  
  - One referral attribution per customer
  
  - No referral reward for failed payments
  
  - No referral reward until qualifying order completes
  
  - Prevent repeated new-account referral exploitation
  
  - Flag suspicious relationships rather than relying solely on IP matching
  
  - Rate-limit referral attribution attempts
  
  - Admin can freeze referral rewards
  
  - Admin can disable a code
  
  - Admin can invalidate a referral
  
  - Admin can revoke fraudulent rewards
  
  - Maintain reason and staff member for administrative changes

- Referral administration
  
  - Search referral accounts
  
  - View referral relationships
  
  - View referral orders
  
  - View pending rewards
  
  - View completed rewards
  
  - View suspicious referrals
  
  - Disable referral codes
  
  - Freeze earnings
  
  - Adjust store credit
  
  - Review cash payouts
  
  - Configure global referral campaign
  
  - Configure account-specific commission arrangements
  
  - Complete audit log

- Verification administration
  
  - Application queue
  
  - View submitted evidence
  
  - Approve
  
  - Reject
  
  - Internal reviewer notes
  
  - Rejection reason
  
  - Verification history
  
  - Revoke verification
  
  - Reinstate verification
  
  - Six-month cooldown automatically enforced
  
  - Uploaded verification evidence should be private and access-controlled

- Referral analytics
  
  - Referral signups
  
  - Referral conversion rate
  
  - Revenue from referred customers
  
  - Total rewards issued
  
  - Store credit redeemed
  
  - Cash payouts
  
  - Top referrers
  
  - Top verified partners
  
  - Average referred order value
  
  - Referral campaign performance

One architectural distinction is particularly important here:

```text
Referral
    = Who referred whom?

Reward
    = What did that referral earn?

Wallet
    = Where are those earnings held?

Payout
    = Was eligible money paid externally?

Verification
    = Is this account allowed additional referral capabilities?
```

I would not combine those into one `referrals` record. For example, a verified creator could have 300 referrals producing 300 individual rewards, accumulate those rewards into a balance, and make one CliQ payout. Those are separate events and should remain separately auditable.

The resulting system can also be extended later into a proper creator/affiliate program without replacing the normal customer referral system.

Also note that referrals bypass restrictions of coupons, so if a coupon states it cannot be used with a different discount, referrals bypass this as they are a first purchase kind of deal, and are calculated AFTER coupons but before fixed costs such as delivery
