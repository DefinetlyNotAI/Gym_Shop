For Orders, I would make the order record immutable in the important places. Product names, prices, discounts, addresses, and tax values should be snapshotted at purchase time so later catalog edits do not rewrite old orders.

- Order identity
  
  - Internal order ID
  
  - Human-readable order number
    
    - Example: `ORD-2026-000184`
  
  - Customer account ID
  
  - Order status
  
  - Payment status
  
  - Fulfillment status
  
  - Currency
  
  - Created at
  
  - Updated at
  
  - Paid at
  
  - Fulfilled at
  
  - Delivered at

- Order totals
  
  - Item subtotal
  
  - Sale reductions
  
  - Discount reductions
  
  - Referral discount
  
  - Loyalty/store-credit usage
  
  - Shipping cost
  
  - Tax
  
  - Final total
  
  - Amount paid
  
  - Amount refunded, if refunds ever exist administratively
  
  - Amount remaining

- Order items
  
  - Product ID reference
  
  - Variant ID reference
  
  - SKU
  
  - Product name snapshot
  
  - Variant description snapshot
    
    - Example: `Black / M`
  
  - Unit price before sale
  
  - Sale price
  
  - Quantity
  
  - Discount allocation
  
  - Final unit price
  
  - Line total
  
  - Product image snapshot/reference

Example:

```text
Essential Compression Shirt
Black / M

SKU: ECS-BLK-M
Quantity: 2

Base price:       25 JOD each
Sale price:       20 JOD each
Discount:          2 JOD each
Final:            18 JOD each

Line total:       36 JOD
```

- Order lifecycle
  
  - I would separate overall order status from payment and fulfillment status.

Overall:

```text
CREATED
    ↓
CONFIRMED
    ↓
PROCESSING
    ↓
COMPLETED
```

Possible terminal states:

```text
CANCELLED
FAILED
```

Payment status:

```text
UNPAID
PENDING
PAID
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
```

You may not offer normal cash refunds to customers, but keeping refund states internally is still useful for duplicate charges, fraud corrections, failed fulfillment, or administrative exceptions.

Fulfillment status:

```text
UNFULFILLED
PROCESSING
PACKED
SHIPPED
DELIVERED
CANCELLED
```

This is much cleaner than trying to represent everything with one status field.

- Order creation
  
  - Customer must be authenticated
  
  - Validate account
  
  - Validate cart
  
  - Validate product availability
  
  - Recalculate all prices server-side
  
  - Validate discounts
  
  - Validate referral rules
  
  - Validate wallet/store-credit usage
  
  - Calculate shipping
  
  - Calculate taxes
  
  - Reserve inventory
  
  - Create pending order
  
  - Begin payment

Conceptually:

```text
Cart
 ↓
Validate
 ↓
Reserve stock
 ↓
Create order
 ↓
Payment
 ↓
Payment confirmed
 ↓
Order confirmed
```

- Pending orders
  
  - Order can exist before payment completes
  
  - Mark as unpaid/pending
  
  - Link to inventory reservation
  
  - Give it an expiration time
  
  - Failed/expired payment releases inventory
  
  - Do not delete the order record
  
  - Mark it cancelled or failed for auditing

- Payment confirmation
  
  - Never trust the browser saying payment succeeded
  
  - Confirm through payment-provider webhook
  
  - Validate payment amount
  
  - Validate currency
  
  - Validate order reference
  
  - Prevent duplicate webhook processing
  
  - Mark payment paid only once

- Inventory integration
  
  - Order items consume reserved stock after successful payment
  
  - Failed payment releases reservation
  
  - Cancelled order before fulfillment releases stock where applicable
  
  - Replacement orders consume stock normally

- Discounts and promotions
  
  - Snapshot every applied pricing rule
  
  - Store:
    
    - Discount ID
    
    - Code used
    
    - Campaign ID
    
    - Discount type
    
    - Calculated amount
    
    - Eligible order lines
  
  - Historical orders must not recalculate against current discount rules

Example:

```text
SUMMER20
Campaign: Summer Launch
Type: 20%
Applied amount: 8.00 JOD
```

If `SUMMER20` is later changed to 15%, the old order remains at 20%.

- Referral integration
  
  - Record referral attribution on the order
  
  - Referrer account
  
  - Referral code used
  
  - Referral campaign
  
  - Referred-customer benefit
  
  - Potential referrer reward
  
  - Reward state
    
    - Pending
    
    - Qualified
    
    - Completed
    
    - Rejected
  
  - Reward becomes eligible only after the required order milestone

- Wallet/store-credit integration
  
  - Store amount applied
  
  - Store ledger transaction reference
  
  - Keep credit separate from payment-provider amount

Example:

```text
Order total:         80 JOD
Store credit:       -15 JOD
CliQ payment:      65 JOD
```

- Shipping address snapshot
  
  - Full name
  
  - Phone
  
  - Country
  
  - City
  
  - Area/state
  
  - Street
  
  - Building
  
  - Apartment/unit
  
  - Postal code if applicable
  
  - Delivery notes

Do not only store a reference to `/account/addresses`.

If the customer later edits their address, an old order should still show where it was actually shipped.

- Billing address
  
  - Same-as-shipping flag
  
  - Full snapshot if different
  
  - Keep for invoice/payment records

- Shipping information
  
  - Shipping method
  
  - Shipping provider
  
  - Shipping price
  
  - Tracking number
  
  - Tracking URL/reference
  
  - Estimated delivery
  
  - Shipped at
  
  - Delivered at

- Order timeline
  
  - Show customers a readable history

Example:

```text
Sep 5, 19:20
Order confirmed

Sep 6, 10:14
Processing

Sep 6, 16:42
Packed

Sep 7, 09:11
Shipped

Sep 8, 14:31
Delivered
```

- Internal order events
  
  - Separate from customer-visible timeline
  
  - Payment webhook received
  
  - Inventory reservation created
  
  - Staff status change
  
  - Tracking number added
  
  - Support case attached
  
  - Replacement issued
  
  - Admin note added

- Order cancellation
  
  - Customer cancellation only while eligible
  
  - For example:
    
    - Allowed before packing
    
    - Disallowed once shipped
  
  - Admin can cancel with reason
  
  - Cancellation should:
    
    - Update order state
    
    - Handle payment reversal if necessary
    
    - Release/reconcile inventory
    
    - Cancel pending referral rewards
    
    - Restore eligible store credit

No-cash-return policy, customer-facing cancellations to be quite restrictive.

- Damaged-product replacement
  
  - Customer opens support ticket
  
  - Links affected order
  
  - Selects affected line item
  
  - Uploads evidence
  
  - Staff reviews
  
  - Staff approves/rejects
  
  - If approved:
    
    - Create replacement order or replacement fulfillment
    
    - Customer pays `0`
    
    - Inventory decremented
    
    - Original order remains intact
    
    - Replacement links back to original order/support case

Example:

```text
Original:
ORD-2026-000184

Replacement:
REP-2026-000021

Reason:
Damaged on arrival

Replacement item:
ECS-BLK-M × 1
```

- Order notes
  
  - Customer delivery note
  
  - Internal staff notes
  
  - Keep these separate
  
  - Internal notes never shown to customer

- Fraud/risk metadata
  
  - Payment risk result
  
  - Suspicious-order flag
  
  - Manual review status
  
  - Reason
  
  - Reviewer
  
  - Do not automatically cancel solely from one weak signal

- Invoices and receipts
  
  - Order receipt
  
  - Payment receipt reference
  
  - Invoice number if legally needed
  
  - Downloadable PDF later if desired
  
  - Snapshot tax/business information at issuance

- Reordering
  
  - Customer can click reorder
  
  - Add still-valid variants back to cart
  
  - Do not blindly recreate the old order
  
  - Recalculate:
    
    - Current price
    
    - Current stock
    
    - Current discounts
    
    - Current shipping

- Admin order view
  
  - Customer
  
  - Items
  
  - Prices
  
  - Discounts
  
  - Payment
  
  - Shipping
  
  - Referral
  
  - Wallet/store credit
  
  - Timeline
  
  - Support tickets
  
  - Replacement history
  
  - Internal notes
  
  - Risk flags
  
  - Audit history

- Admin actions
  
  - Mark processing
  
  - Mark packed
  
  - Add shipment
  
  - Add tracking
  
  - Mark shipped
  
  - Mark delivered
  
  - Cancel
  
  - Create replacement
  
  - Add internal note
  
  - Resend confirmation email
  
  - View payment details
  
  - View inventory movements

- Order search and filters
  
  - Order number
  
  - Customer name
  
  - Email
  
  - SKU
  
  - Tracking number
  
  - Status
  
  - Payment status
  
  - Fulfillment status
  
  - Date range
  
  - Total range
  
  - Referral code
  
  - Discount code

- Order analytics
  
  - Orders per day/week/month
  
  - Revenue
  
  - Average order value
  
  - Units per order
  
  - Discount amount
  
  - Store-credit usage
  
  - Referral orders
  
  - Failed payments
  
  - Cancellation rate
  
  - Fulfillment time
  
  - Delivery time

The order relationship should end up roughly like:

```text
Order
├── Customer
├── Items
│   └── Product/variant snapshots
├── Pricing
│   ├── Sales
│   ├── Discounts
│   ├── Referral
│   └── Store credit
├── Payment
├── Inventory movements
├── Shipping
├── Addresses
├── Timeline
├── Support cases
└── Replacement orders
```

The most important design choice here is keeping `order status`, `payment status`, and `fulfillment status` separate. That avoids states like `PAID_BUT_NOT_SHIPPED_WAITING_FOR_PACKING`, which become unmanageable very quickly.

Next on our list is Shipping.
