Then the Inventory plan should be:

- Inventory per variant
  
  - Every inventory-tracked variant has its own stock record
  
  - SKU
  
  - On-hand quantity
  
  - Reserved quantity
  
  - Available quantity
  
  - `available = on_hand - reserved`
  
  - Low-stock threshold
  
  - Inventory tracking enabled/disabled
  
  - Updated timestamp

- Stock states
  
  - In stock
  
  - Low stock
  
  - Out of stock
  
  - Unavailable
  
  - Do not allow negative available inventory

- Checkout reservations
  
  - Reserve stock when the customer reaches the appropriate payment stage
  
  - Reservation contains
    
    - Account
    
    - Cart/checkout
    
    - Variant
    
    - Quantity
    
    - Created time
    
    - Expiration time
  
  - Reserved units cannot be purchased by another customer
  
  - Reservation automatically expires if checkout is abandoned
  
  - Successful payment converts reservation into sold stock
  
  - Failed/cancelled checkout releases reservation

Example:

```text
Black / M

On hand:       10
Reserved:       0
Available:     10

Customer A begins payment for 2

On hand:       10
Reserved:       2
Available:      8

Payment succeeds

On hand:        8
Reserved:       0
Available:      8
```

- Reservation expiry
  
  - Configurable timeout
  
  - Payment already in progress should not unexpectedly lose its reservation, freeze timeout while waiting for payement to process
  
  - Expired reservations automatically release stock
  
  - Reservation extension should be controlled by the backend
  
  - Customers should not be able to keep inventory locked indefinitely by repeatedly refreshing checkout

- Cart behavior
  
  - Adding something to cart does not reserve it
  
  - Cart displays current availability
  
  - Quantity cannot exceed currently available stock
  
  - Inventory is checked again before checkout
  
  - Inventory is checked when creating the reservation
  
  - Stale carts are corrected when opened

So:

```text
Cart ≠ reservation
Checkout/payment = reservation
Paid order = stock deduction
```

- Stock movements
  
  - Every quantity change creates a permanent inventory transaction
  
  - Restock
  
  - Sale
  
  - Reservation
  
  - Reservation release
  
  - Cancellation
  
  - Damaged
  
  - Lost
  
  - Manual correction
  
  - Replacement shipment
  
  - Administrative adjustment

Example history:

```text
ECS-BLK-M

+50  RESTOCK             → 50
 -2  ORDER #1042         → 48
 -1  DAMAGED             → 47
 +1  MANUAL CORRECTION   → 48
 -1  REPLACEMENT #R12    → 47
```

Do not simply maintain `quantity = 47` without knowing how it became 47.

- Manual adjustments
  
  - Admin selects variant
  
  - Increase/decrease quantity
  
  - Reason required
  
  - Optional internal comment
  
  - Staff account recorded
  
  - Timestamp recorded
  
  - Previous and resulting quantity recorded

Example:

```text
Adjustment:

SKU: ECS-BLK-M
Change: -2
Reason: DAMAGED
Comment: Damaged during unloading

Before: 14
After: 12

By: Admin #4
```

- Adjustment reasons
  
  - Restock
  
  - Damaged
  
  - Lost
  
  - Found
  
  - Stock count correction
  
  - Supplier correction
  
  - Replacement
  
  - Other
  
  - Require explanation for `Other`

- Restocking
  
  - Select variants
  
  - Quantity received
  
  - Supplier/reference information optionally
  
  - Cost per unit optionally
  
  - Received date
  
  - Staff member
  
  - Batch restocking

For example, one shipment:

```text
RESTOCK #52

Black / S       +20
Black / M       +30
Black / L       +25
White / S       +15
White / M       +25
```

One operation should create the corresponding stock movements.

- Low-stock system
  
  - Global default threshold
  
  - Per-variant override
  
  - Example default: `5`
  
  - Automatically flag variants at or below threshold
  
  - Admin dashboard notification
  
  - Filter inventory by low stock

Example:

```text
Black / S      23    IN STOCK
Black / M       5    LOW STOCK
Black / L       1    LOW STOCK
Black / XL      0    OUT OF STOCK
```

- Customer stock display
  
  - Usually show:
    
    - In stock
    
    - Low stock
    
    - Out of stock
  
  - Optionally show exact quantity when low

Example:

```text
Only 2 left
```

I would avoid exposing exact quantities for all products unless there is a business reason.

- Out-of-stock behavior
  
  - Variant remains visible
  
  - Cannot add unavailable variant to cart
  
  - Clearly mark it unavailable
  
  - Other variants remain purchasable
  
  - Product remains listed while at least one variant is available
  
  - Entire product can show `Out of stock` when every purchasable variant is unavailable

- Back-in-stock notifications
  
  - Customer can request notification for an unavailable variant
  
  - Store exact variant, not merely product
  
  - Example: `Black / M`
  
  - Notify when available inventory returns above zero
  
  - Prevent duplicate subscriptions
  
  - Allow unsubscribe
  
  - Clear/mark notification after sending
  
  - This can be after v1 if we want to keep launch smaller

- Damaged inventory
  
  - Damaged stock should be removed from sellable inventory
  
  - Record reason
  
  - Record quantity
  
  - Optional evidence/photo internally
  
  - Never silently delete stock

- Customer damaged-product replacements

This connects to the support system we already decided on.

```text
Customer reports damaged item
        ↓
Support approves replacement
        ↓
Replacement order created
        ↓
Replacement variant inventory -1
        ↓
Inventory movement references replacement
```

The replacement still consumes real inventory even though the customer pays `0 JOD`.

- Overselling
  
  - Disabled by default
  
  - Atomic inventory reservation
  
  - Backend is authoritative
  
  - Never trust storefront-reported stock
  
  - Two simultaneous checkouts cannot reserve the same final unit

Example:

```text
Available: 1

Customer A ─┐
            ├── both attempt reservation
Customer B ─┘

Database accepts A
Available → 0

B receives:
"Item is no longer available."
```

- Inventory administration
  
  - Search by SKU
  
  - Search by product
  
  - Filter by category
  
  - Filter by stock state
  
  - View all variants
  
  - Adjust stock
  
  - Batch adjustments
  
  - Restock
  
  - View reservations
  
  - View inventory history
  
  - View low-stock products
  
  - Export inventory data
  
  - Audit all manual changes

- Inventory analytics
  
  - Units sold
  
  - Current stock value
  
  - Low-stock variants
  
  - Out-of-stock variants
  
  - Best-selling variants
  
  - Slow-moving inventory
  
  - Damaged/lost quantities
  
  - Restock history
  
  - Stock turnover
  
  - Estimated days of stock remaining later when enough sales data exists

- Multiple warehouses

I would explicitly design the data model so warehouses can be introduced later, but only operate one location in v1.

V1:

```text
Variant
└── Inventory
```

Future:

```text
Variant
└── Inventory
    ├── Amman Warehouse
    └── Retail Location
```

That avoids unnecessarily building warehouse routing, transfers, and location-based fulfillment now.

The core inventory relationship becomes:

```text
Product
    ↓
Variant
    ↓
Inventory
    ├── On hand
    ├── Reserved
    ├── Available
    ├── Low-stock threshold
    │
    ├── Reservations
    │
    └── Stock movements
        ├── Restock
        ├── Sale
        ├── Damage
        ├── Replacement
        └── Adjustment
```


