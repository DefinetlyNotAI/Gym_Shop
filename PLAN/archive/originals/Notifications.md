For Notifications, I would build one centralized notification system used by orders, support, referrals, verification, delivery, promotions, security, and admin operations. Individual systems should emit events rather than implementing their own notification logic.

- Notification channels
  
  - Email
  
  - In-site notifications
  
  - SMS, after v1 if needed
  
  - Push notifications, after v1 if you eventually have a PWA/app
  
  - Admin/internal notifications

For v1 I would use:

```text
Customer:
├── Email
└── In-site

Staff:
├── In-site
└── Email for important events
```

- Notification identity
  
  - Notification ID
  
  - Recipient account
  
  - Type
  
  - Category
  
  - Title
  
  - Message
  
  - Related entity
    
    - Order
    
    - Support ticket
    
    - Referral
    
    - Verification request
    
    - Product
    
    - Delivery
  
  - Channel
  
  - Created at
  
  - Sent at
  
  - Read at
  
  - Delivery status

- Notification categories
  
  - Account
  
  - Security
  
  - Orders
  
  - Payments
  
  - Delivery
  
  - Customer support
  
  - Referrals
  
  - Verification
  
  - Rewards/store credit
  
  - Products
  
  - Promotions
  
  - Reviews
  
  - System

- Account notifications
  
  - Welcome/account created
  
  - Email verification
  
  - Email changed
  
  - Password changed
  
  - Password reset requested
  
  - Password reset completed
  
  - Account deletion requested
  
  - Account deleted
  
  - Important account changes

- Security notifications
  
  - New login
  
  - Suspicious login
  
  - Password changed
  
  - Email changed
  
  - New device/session
  
  - All sessions revoked
  
  - MFA changed if introduced
  
  - Account temporarily locked

Security notifications should not be disableable by the customer.

- Order notifications
  
  - Order created
  
  - Payment pending
  
  - Payment confirmed
  
  - Payment failed
  
  - Order confirmed
  
  - Processing
  
  - Packed
  
  - Cancelled
  
  - Replacement created
  
  - Order completed

Avoid sending an email for every tiny internal state change. Some changes should only appear in the account timeline.

- Internal delivery notifications
  
  - Delivery scheduled
  
  - Delivery rescheduled
  
  - Ready for delivery
  
  - Out for delivery
  
  - Delivery delayed
  
  - Failed delivery attempt
  
  - Delivered
  
  - Delivery PIN/code

Example:

```text
Your order ORD-2026-000184 is out for delivery.

Delivery window:
12:00 - 16:00

Delivery code:
482193
```

The delivery code should only be exposed where appropriate and should not appear in internal logs unnecessarily.

- Payment notifications
  
  - Payment successful
  
  - Payment failed
  
  - Payment cancelled
  
  - Store credit used
  
  - Payment correction
  
  - CliQ-related payout events for eligible verified accounts

For verified referral payouts:

```text
Payout requested
Payout processing
Payout completed
Payout failed
Payout cancelled
```

- Referral notifications
  
  - Someone successfully used referral
  
  - Referral pending
  
  - Referral qualified
  
  - Referral completed
  
  - Reward credited
  
  - Referral rejected/revoked where customer communication is appropriate

I would not expose unnecessary information about the referred person.

Instead of:

```text
Adam bought 72 JOD using your code.
```

use:

```text
A referral has qualified.

Reward:
3.60 JOD
```

- Reward/store-credit notifications
  
  - Credit earned
  
  - Credit spent
  
  - Credit manually adjusted
  
  - Credit expiring soon, if expiration exists
  
  - Credit expired
  
  - Referral commission available
  
  - Cash-eligible balance available for verified accounts

- Verification notifications
  
  - Application received
  
  - Application under review
  
  - Additional information requested
  
  - Approved
  
  - Rejected
  
  - Verification revoked
  
  - Verification restored
  
  - Reapplication eligibility approaching, optionally

For rejection:

```text
Verification request rejected.

You may submit another verification request after:
March 5, 2027
```

- Customer support notifications
  
  - Ticket created
  
  - Staff replied
  
  - Staff requested more information
  
  - Ticket status changed where relevant
  
  - Ticket resolved
  
  - Ticket closed
  
  - Ticket reopened

For damaged-item claims:

```text
Damage claim received
Replacement approved
Replacement rejected
Replacement prepared
Replacement out for delivery
Replacement delivered
```

- Product notifications
  
  - Back in stock
  
  - Optional low-stock/customer urgency notifications should not be spammed
  
  - Product availability changes only when customer explicitly subscribed

Back-in-stock subscriptions should target exact variants:

```text
Essential Compression Shirt
Black / M

is back in stock.
```

- Review notifications
  
  - Product eligible for review
  
  - Review published
  
  - Review rejected/hidden with appropriate explanation
  
  - Staff response if you later support merchant responses
  
  - Review reward credited

- Promotional notifications
  
  - New promotion
  
  - Sale started
  
  - Exclusive discount
  
  - Referral campaign
  
  - Loyalty campaign
  
  - New collection
  
  - New product

These must be optional marketing communications.

- Notification preferences

Customer controls:

```text
Orders
Email:       ON
In-site:     ON

Delivery
Email:       ON
In-site:     ON

Support
Email:       ON
In-site:     ON

Referrals
Email:       ON/OFF
In-site:     ON

Product alerts
Email:       ON/OFF
In-site:     ON/OFF

Promotions
Email:       ON/OFF
In-site:     ON/OFF
```

Some categories should be mandatory:

```text
Cannot disable:

Critical account/security
Order confirmations
Payment confirmations
Essential delivery information
Critical support/replacement information
Legal/service notices when necessary
```

Marketing is separate and opt-in/opt-out.

- In-site notification center
  
  - Bell/icon in header
  
  - Unread count
  
  - Notification list
  
  - Mark as read
  
  - Mark all as read
  
  - Clicking notification opens related content
  
  - Pagination
  
  - Recent notification retention

Example:

```text
Notifications                         3 unread

● Your order is out for delivery.
  12 minutes ago

● You earned 2.50 JOD from a referral.
  2 hours ago

● Support replied to SUP-2026-001284.
  Yesterday

  Your order ORD-2026-000173 was delivered.
  Sep 3
```

- Notification actions

Notifications should reference actual objects rather than storing arbitrary URLs.

For example:

```text
Type:
ORDER_OUT_FOR_DELIVERY

Entity:
ORDER

Entity ID:
184
```

The frontend determines that clicking it should open:

```text
/account/orders/ORD-2026-000184
```

This prevents backend notification records from being tightly coupled to frontend URLs.

- Event-driven notification architecture

Other systems should emit events:

```text
ORDER_PAID
ORDER_PACKED
DELIVERY_ASSIGNED
DELIVERY_OUT_FOR_DELIVERY
DELIVERY_COMPLETED

SUPPORT_REPLY_CREATED

REFERRAL_COMPLETED
REWARD_CREDITED

VERIFICATION_APPROVED
```

Then:

```text
ORDER_PAID
     ↓
Notification system
     ├── Create in-site notification
     └── Send order-confirmation email
```

The Orders service should not contain a giant pile of email-template code.

- Notification templates
  
  - Template ID
  
  - Event type
  
  - Channel
  
  - Subject/title
  
  - Body template
  
  - Variables
  
  - Enabled/disabled
  
  - Version
  
  - Updated by
  
  - Updated at

Example variables:

```text
{{customer_name}}
{{order_number}}
{{order_total}}
{{delivery_date}}
{{support_ticket}}
{{reward_amount}}
```

Templates should only receive explicitly allowed variables. Do not dump entire customer/order objects into the template engine.

- Email templates
  
  - Brand header
  
  - Consistent typography
  
  - Order information
  
  - Relevant action button
  
  - Contact/support link
  
  - Legal footer
  
  - Marketing unsubscribe link where required

Transactional and marketing email templates should remain separate.

- Email delivery state
  
  - Queued
  
  - Sending
  
  - Sent
  
  - Delivered, if provider supports it
  
  - Failed
  
  - Bounced
  
  - Suppressed

A failed email should not break the underlying operation.

For example:

```text
Payment succeeds
    ↓
Order confirmed
    ↓
Email attempt fails

Order remains CONFIRMED.
Notification becomes FAILED.
Retry email separately.
```

- Retry handling
  
  - Temporary delivery failure
  
  - Retry automatically
  
  - Increasing delay between attempts
  
  - Maximum attempts
  
  - Permanent failure stops retries
  
  - Record failure reason

- Notification queue
  
  - Notifications should normally be asynchronous
  
  - Checkout should not wait for an email provider
  
  - Order/payment completes first
  
  - Notification job is queued afterward

```text
Payment confirmed
      ↓
Commit order
      ↓
Emit ORDER_PAID
      ↓
Queue notifications
      ↓
Return success to customer
      ↓
Emails processed separately
```

- Deduplication
  
  - Prevent the same event from producing duplicate emails
  
  - Event ID/idempotency key
  
  - Especially important for payment webhooks

Example:

```text
ORDER_PAID:184

Email already sent?
Yes

→ Do not send again
```

- Scheduled notifications
  
  - Review request after delivery
  
  - Upcoming delivery reminder
  
  - Expiring credit
  
  - Promotion start
  
  - Promotion ending soon
  
  - Verification reapplication eligibility

Scheduled notifications should check that they are still relevant before sending.

If an order is cancelled, an old queued delivery reminder should not go out.

- Bulk promotional messages
  
  - Admin creates campaign
  
  - Select audience
  
  - Preview
  
  - Schedule
  
  - Send test
  
  - Send
  
  - Pause/cancel where possible

Audience filters could eventually include:

```text
All opted-in customers
New customers
Existing customers
Verified accounts
Customers who purchased category X
Customers inactive for X days
```

Do not make arbitrary bulk emailing available to every admin role.

- Admin notifications
  
  - New high-priority support ticket
  
  - Verification application
  
  - Low inventory
  
  - Failed payment anomaly
  
  - Failed internal delivery
  
  - Suspicious referral activity
  
  - Promotion budget nearing limit
  
  - Notification/email system failure

- Driver notifications
  
  - Delivery assigned
  
  - Assignment changed
  
  - Delivery cancelled
  
  - Route/batch ready
  
  - Schedule changed

Driver notifications should remain operational and separate from customer marketing.

- Notification history
  
  - Recipient
  
  - Event
  
  - Channel
  
  - Template version
  
  - Created
  
  - Sent
  
  - Delivery result
  
  - Failure reason
  
  - Read state
  
  - Related entity

This gives support staff evidence when someone says they never received an order email.

- Privacy
  
  - Avoid sensitive information in email subjects
  
  - Do not include unnecessary referral identities
  
  - Do not expose internal staff notes
  
  - Do not expose verification evidence
  
  - Never include passwords or authentication secrets
  
  - Reset links use short-lived single-use tokens
  
  - Delivery codes expire appropriately

- Notification analytics
  
  - Emails sent
  
  - Delivery rate
  
  - Failure rate
  
  - Bounce rate
  
  - In-site read rate
  
  - Marketing opt-out rate
  
  - Promotion engagement
  
  - Back-in-stock conversion
  
  - Review-request conversion

I would avoid treating email open rate as perfectly reliable because modern mail privacy features make it noisy.

The architecture becomes:

```text
Orders ──────────┐
Delivery ────────┤
Support ─────────┤
Referrals ───────┤
Verification ────┤
Reviews ─────────┤
Inventory ───────┤
Security ────────┘
                 ↓
              Events
                 ↓
       Notification System
        ├── Preferences
        ├── Templates
        ├── Scheduling
        ├── Deduplication
        └── Queue
             ↓
        ┌────┴─────┐
        ↓          ↓
      Email     In-site
```

This gives us one notification infrastructure instead of every feature independently implementing emails and alerts.


