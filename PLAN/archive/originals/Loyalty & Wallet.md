Next is Loyalty, Rewards, and Wallet.

The core rule should be that the wallet is a ledger, not just a mutable balance field.

- Wallet balances
  
  - Store-spendable balance
  
  - Cash-eligible balance
  
  - Pending balance
  
  - Lifetime earned
  
  - Lifetime spent
  
  - Lifetime paid out

- Sources of value
  
  - Referral rewards
  
  - Loyalty rewards
  
  - Promotional credit
  
  - Admin compensation
  
  - Manual adjustment
  
  - Review incentive
  
  - Other approved rewards

- Balance classes
  
  - Store credit
    
    - Spendable only on the store
    
    - Not withdrawable
  
  - Cash-eligible referral earnings
    
    - Only for Verified Customers
    
    - Can either remain spendable or be paid through CliQ
  
  - Pending earnings
    
    - Not usable until qualified

Example:

```text
Verified Customer

Pending referral earnings:     8 JOD
Store credit:                 10 JOD
Cash-eligible balance:        20 JOD

Store-spendable total:        30 JOD
Withdrawable through CliQ:    20 JOD
```

- Wallet ledger

Every balance change creates a permanent transaction:

```text
CREDIT
DEBIT
HOLD
RELEASE
PAYOUT
REVERSAL
EXPIRATION
ADJUSTMENT
```

Each transaction should store:

- ID

- Account

- Amount

- Balance type

- Source type

- Source reference

- Status

- Created at

- Completed at

- Description

- Actor if manually created

Never do:

```text
wallet.balance = 25
```

without recording why it changed.

- Referral rewards

The referral system feeds rewards into the wallet:

```text
Referral qualifies
    ↓
Reward created
    ↓
PENDING
    ↓
Order reaches required milestone
    ↓
AVAILABLE
```

For a normal Customer:

```text
AVAILABLE
→ Store credit
```

For a Verified Customer:

```text
AVAILABLE
→ Cash-eligible referral balance
```

They can still choose to spend that balance in-store rather than requesting a payout.

- Loyalty points

I would keep points separate from currency.

Example:

```text
100 points = 1 JOD store credit
```

Possible earning rules:

- Purchase completed

- Review submitted

- Account milestone

- Promotion

- Referral activity

- Special campaigns

But the conversion and earning rate should be configurable.

- Loyalty earning

Example:

```text
1 point per 1 JOD spent
```

or:

```text
2 points per 1 JOD
```

Rules should support:

- Eligible products

- Eligible categories

- Minimum spend

- Campaign multipliers

- Start/end dates

- Maximum points per order

- Customer eligibility

- Loyalty redemption

Two sensible approaches:

1. Convert points into store credit manually

2. Let checkout redeem points directly

I prefer conversion into wallet credit because it keeps checkout simpler:

```text
500 points
    ↓
Convert
    ↓
5 JOD store credit
```

The conversion creates:

- Loyalty-point debit

- Wallet-credit transaction

- Loyalty tiers

Optional, probably post-v1:

```text
Bronze
Silver
Gold
```

Possible benefits:

- Higher point multiplier

- Early access to promotions

- Special coupons

- Free shipping threshold benefits

I would not build this unless you actually want tiered loyalty.

- Store credit usage at checkout

Customer chooses amount to apply:

```text
Order total:       60 JOD
Store credit:     -15 JOD
Remaining:         45 JOD
```

Rules:

- Cannot exceed usable order amount

- Cannot produce a negative total

- Revalidated server-side

- Amount temporarily held during checkout

- Captured when payment succeeds

- Released if checkout fails

This should behave similarly to inventory reservations.

- Wallet holds

During payment:

```text
Available credit: 20 JOD

Checkout applies: 10 JOD

Available: 10
Held:      10
```

Payment fails:

```text
Held → Released
```

Payment succeeds:

```text
Held → Spent
```

This prevents simultaneous checkouts from spending the same credit twice.

- Cancellation handling

If an eligible order is cancelled before fulfillment:

```text
Store credit used
    ↓
Reversal
    ↓
Returned to wallet
```

The restored credit should maintain its original classification and expiration rules where practical.

Finance Staff or authorized Admins can:

```text
Add credit
Remove credit
Correct balance
```

Required:

- Amount

- Reason

- Internal comment

- Actor

- Timestamp

- Audit record

Large or sensitive adjustments could require higher authorization later.

- CliQ payouts

Only Verified Customers with cash-eligible earnings can request payouts.

Flow:

```text
Cash-eligible balance
        ↓
Payout request
        ↓
Validation
        ↓
Funds placed on hold
        ↓
Finance review/process
        ↓
CliQ payout
        ↓
COMPLETED
```

Possible statuses:

```text
REQUESTED
UNDER_REVIEW
APPROVED
PROCESSING
COMPLETED
FAILED
REJECTED
CANCELLED
```

- Payout requirements
  
  - Verified Customer
  
  - Verification still active
  
  - Valid CliQ payout details
  
  - Minimum payout threshold
  
  - Sufficient cash-eligible balance
  
  - No frozen referral account
  
  - Recent authentication for changing payout details

- Failed payouts

If payout fails:

```text
Payout hold
    ↓
FAILED
    ↓
Balance returned to cash-eligible wallet
```

Do not lose the balance.

- Payout history

Customer sees:

- Requested amount

- Date

- Status

- Completion date

- Reference where appropriate

Finance Staff sees more operational detail.

- Reward freezing

Admin/Super Admin/CTO can freeze suspicious reward balances.

A freeze should:

- Prevent payout

- Optionally prevent spending

- Keep ledger intact

- Require reason

- Create audit

- Support unfreeze

- Referral revocation

If fraud is confirmed:

```text
Pending reward
→ REVOKED
```

If already credited but unused:

```text
Reversal transaction
```

If already spent or paid out, do not silently create a negative balance without a defined recovery policy.

That case should be flagged for manual review.

- Customer wallet dashboard

Show:

```text
Store credit
Cash-eligible earnings
Pending rewards
Loyalty points
Lifetime earned
Recent transactions
Expiring credit
Payout history
```

Verified users additionally see:

```text
CliQ payout setup
Available payout balance
Request payout
Payout history
```

- Finance admin view

Finance Staff should have:

- Wallet search

- Transaction history

- Pending payouts

- Failed payouts

- Manual adjustments

- Frozen balances

- Referral reward reconciliation

- Customer wallet history

- CliQ payout records

- Analytics
  
  - Credit issued
  
  - Credit redeemed
  
  - Outstanding wallet liability
  
  - Loyalty points issued
  
  - Loyalty points redeemed
  
  - Referral rewards
  
  - Cash payouts
  
  - Failed payouts
  
  - Manual adjustments

The model should end up like:

```text
Account
├── Loyalty Account
│   ├── Points balance
│   └── Point transactions
│
└── Wallet
    ├── Store credit
    ├── Cash-eligible balance
    ├── Pending balance
    ├── Holds
    ├── Transactions
    └── Payouts
```

The main separation to preserve is:

```text
Loyalty Points
= non-currency reward units

Wallet
= monetary value usable by the account

Cash-eligible balance
= subset of wallet value allowed for CliQ payout
```

After this, only the two big structural planning stages remain: Database Design, then API Design.



Understand that loyalty has a 40% discount max, aka you may use points upto 40% of the total before shipping fees etc.
