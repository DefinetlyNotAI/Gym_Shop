For Customer Support, I would make it ticket-based from the start. Since damaged-item replacements are the only return-like flow, support becomes the central place for order issues, delivery issues, payments, account help, and replacement requests.

- Ticket identity
  
  - Internal ticket ID
  
  - Human-readable ticket number
    
    - Example: `SUP-2026-001284`
  
  - Customer account
  
  - Category
  
  - Priority
  
  - Status
  
  - Subject
  
  - Created at
  
  - Updated at
  
  - Closed at
  
  - Assigned staff member
  
  - Related order, if any
  
  - Related shipment, if any
  
  - Related product/variant, if any

- Ticket categories
  
  - Order issue
  
  - Damaged product
  
  - Delivery issue
  
  - Payment issue
  
  - Account issue
  
  - Product question
  
  - Referral issue
  
  - Verification issue
  
  - Promotion/discount issue
  
  - Other

- Ticket statuses
  
  - `OPEN`
  
  - `AWAITING_CUSTOMER`
  
  - `AWAITING_STAFF`
  
  - `IN_REVIEW`
  
  - `RESOLVED`
  
  - `CLOSED`

For damaged-product cases, optionally add:

```text
REPLACEMENT_PENDING
REPLACEMENT_APPROVED
REPLACEMENT_REJECTED
```

I would keep those as claim states rather than polluting the general ticket status system.

- Priority
  
  - Low
  
  - Normal
  
  - High
  
  - Urgent
  
  - Customer should not choose `Urgent`
  
  - Priority determined by rules or staff

- Ticket creation
  
  - Customer must be logged in
  
  - Category selection
  
  - Subject
  
  - Description
  
  - Optional order selection
  
  - Optional affected product
  
  - Optional attachment uploads
  
  - Automatically capture relevant account/order metadata
  
  - Rate limiting
  
  - Prevent duplicate accidental submissions

- Order-linked support
  
  - Customer can open support directly from an order
  
  - Automatically attach:
    
    - Order number
    
    - Order items
    
    - Payment status
    
    - Fulfillment status
    
    - Delivery status
  
  - Customer selects affected item if applicable

This is better than making them manually type the order number.

- Damaged-product claims
  
  - Must reference a delivered order
  
  - Customer selects damaged order item
  
  - Quantity affected
  
  - Damage description
  
  - Required evidence upload
    
    - Photos
    
    - Optional video
  
  - Claim submission timestamp
  
  - Staff review
  
  - Approve/reject
  
  - Approved claim creates replacement workflow
  
  - No cash refund option

Example:

```text
Order:
ORD-2026-000184

Item:
Essential Compression Shirt
Black / M

Quantity affected:
1

Reason:
Torn seam on arrival

Evidence:
3 photos

Requested action:
Replacement
```

- Damage claim eligibility
  
  - Order must belong to customer
  
  - Order must be delivered
  
  - Product must be eligible
  
  - Claim must be within configured time window
  
  - Quantity claimed cannot exceed purchased quantity
  
  - Already replaced quantity cannot be claimed again
  
  - Staff can override with reason

- Replacement workflow
  
  - Claim submitted
  
  - Staff reviews evidence
  
  - Approve or reject
  
  - If approved:
    
    - Create replacement order
    
    - Same variant by default
    
    - Allow alternate size/color only if business rules permit
    
    - Replacement order total = `0`
    
    - Inventory consumed normally
    
    - Link replacement to support ticket and original order
    
    - Schedule internal delivery
  
  - Mark ticket resolved after replacement delivered

- Replacement states
  
  - `REQUESTED`
  
  - `UNDER_REVIEW`
  
  - `APPROVED`
  
  - `REJECTED`
  
  - `REPLACEMENT_CREATED`
  
  - `REPLACEMENT_SHIPPED`
  
  - `REPLACEMENT_DELIVERED`

- Rejection handling
  
  - Staff must provide reason
  
  - Customer sees customer-safe explanation
  
  - Internal notes remain private
  
  - Rejection recorded permanently
  
  - Admin override possible
  
  - Repeated fraudulent claims can be flagged

- Attachments
  
  - Images
  
  - Videos, optionally
  
  - PDFs/documents where relevant
  
  - File-size limit
  
  - Allowed MIME types
  
  - Malware scanning if possible
  
  - Private storage
  
  - Signed/temporary access URLs
  
  - Never expose support uploads publicly

- Ticket messages
  
  - Customer messages
  
  - Staff replies
  
  - Timestamps
  
  - Attachments
  
  - Read/unread state
  
  - Edited-message handling
  
  - Internal staff notes separate from customer-visible messages

- Internal notes
  
  - Visible only to staff
  
  - Author
  
  - Timestamp
  
  - Full audit trail
  
  - Useful for:
    
    - Fraud suspicion
    
    - Delivery context
    
    - Prior support history
    
    - Manager approval

- Ticket assignment
  
  - Unassigned queue
  
  - Manual assignment
  
  - Automatic assignment later
  
  - Reassignment
  
  - Assigned team
  
  - Assigned staff member
  
  - Assignment history

- Support teams
  
  - General support
  
  - Orders
  
  - Delivery
  
  - Payments
  
  - Verification/referrals
  
  - Managers

This can remain one actual support role system with category-based queues.

- Customer support dashboard
  
  - Open tickets
  
  - Awaiting customer
  
  - Awaiting staff
  
  - Damaged-item claims
  
  - High-priority tickets
  
  - Unassigned tickets
  
  - Recently updated
  
  - Search

- Search and filters
  
  - Ticket number
  
  - Customer
  
  - Email
  
  - Order number
  
  - Category
  
  - Status
  
  - Priority
  
  - Assigned staff
  
  - Date range
  
  - Product/SKU
  
  - Replacement status

- Staff actions
  
  - Reply
  
  - Add internal note
  
  - Assign/reassign
  
  - Change category
  
  - Change priority
  
  - Change status
  
  - Link order
  
  - Link shipment
  
  - Approve replacement
  
  - Reject replacement
  
  - Escalate
  
  - Close
  
  - Reopen

- Escalation
  
  - Escalate to manager
  
  - Escalation reason required
  
  - Record previous assignee
  
  - Record escalation timestamp
  
  - Optional escalation level

- Automated ticket metadata
  
  - Customer order count
  
  - Account creation date
  
  - Previous tickets
  
  - Current order status
  
  - Delivery status
  
  - Payment status
  
  - Referral/verification state where relevant

Do not expose sensitive internal risk data unnecessarily to normal support staff.

- Customer view
  
  - Ticket list
  
  - Ticket status
  
  - Messages
  
  - Attachments
  
  - Related order
  
  - Replacement status
  
  - Reply
  
  - Close ticket if resolved
  
  - Reopen within configurable period

- Notifications
  
  - Ticket created
  
  - Staff replied
  
  - More information requested
  
  - Replacement approved
  
  - Replacement rejected
  
  - Replacement dispatched
  
  - Ticket resolved
  
  - Ticket closed

- SLA tracking
  
  - First response time
  
  - Resolution time
  
  - Time waiting on customer
  
  - Time waiting on staff
  
  - Optional category-based targets
  
  - Do not count time awaiting customer against staff resolution metrics

- Spam/abuse controls
  
  - Rate limits
  
  - Attachment limits
  
  - Duplicate ticket detection
  
  - Block abusive accounts from repeated ticket creation if necessary
  
  - Never block access to existing ticket history
  
  - Staff moderation tools

- Audit trail
  
  - Status changes
  
  - Assignments
  
  - Priority changes
  
  - Replacement approvals/rejections
  
  - Staff replies
  
  - Internal notes
  
  - Ticket closure/reopening
  
  - Admin overrides

- Support analytics
  
  - Tickets per day/week/month
  
  - Tickets by category
  
  - First response time
  
  - Resolution time
  
  - Reopen rate
  
  - Damaged-product claim rate
  
  - Replacement approval rate
  
  - Most frequently reported products
  
  - Delivery issue rate
  
  - Payment issue rate
  
  - Tickets per order
  
  - Staff workload

- Product-quality feedback
  
  - Damaged claims should feed product analytics
  
  - Example:
    
    - Variant `ECS-BLK-M`
    
    - 500 units sold
    
    - 18 damage claims
    
    - 14 approved
  
  - This can flag manufacturing or packaging problems

The relationship should look roughly like:

```text
Support Ticket
├── Customer
├── Category
├── Messages
├── Attachments
├── Internal Notes
├── Assignment
├── Related Order
├── Related Shipment
└── Optional Damage Claim
    └── Replacement Order
```

One important separation is this:

```text
Ticket
= conversation and support case

Damage Claim
= structured request with evidence and decision

Replacement Order
= actual operational fulfillment
```

Do not make the support ticket itself responsible for modifying inventory or shipping. It should trigger the proper replacement-order workflow when approved.

Also note any uploaded files stay for 2 weeks after ticket closes before being removed from DB
