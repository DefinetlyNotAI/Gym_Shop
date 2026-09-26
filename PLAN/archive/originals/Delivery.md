Since shipping is fully internal, we can drop carrier integrations, external tracking APIs, and third-party shipment webhooks. The shipping system becomes an internal delivery and dispatch workflow.

- Shipping zones
  
  - Define where the store delivers
  
  - Country
  
  - City
  
  - Area/district
  
  - Optional postal code
  
  - Optional excluded areas
  
  - Each zone can have:
    
    - Shipping price
    
    - Free-shipping threshold
    
    - Estimated delivery time (min and max)
    
    - Enabled/disabled status

Example:

```text
Jordan
├── Amman
│   ├── Central Amman
│   │   Shipping: 2 JOD
│   │   ETA: 1 day
│   │
│   └── Outer Amman
│       Shipping: 3 JOD
│       ETA: 1-2 days
│
├── Zarqa
│   Shipping: 4 JOD
│   ETA: 1-2 days
│
└── Irbid
    Shipping: 4 JOD
    ETA: 1-2 days
```

- Shipping pricing
  
  - Fixed price by zone
  
  - Free shipping above configurable subtotal
  
  - Promotional free shipping
  
  - Optional price based on:
    
    - Order value
    
    - Weight
    
    - Item quantity
  
  - Manual shipping override by admin
  
  - Shipping cost calculated server-side

For v1, keep it simple:

```text
Zone base price
+
Promotion/free-shipping rules
=
Final shipping price
```

- Delivery address validation
  
  - Full name
  
  - Phone number
  
  - Country
  
  - City
  
  - Area
  
  - Street
  
  - Building
  
  - Floor
  
  - Apartment
  
  - Landmark
  
  - Delivery instructions
  
  - Optional location pin
    
    - Latitude
    
    - Longitude

For internal delivery, the location pin is worth considering. It can be more useful depending on the area.

- Delivery assignment
  
  - Every shipment can be assigned to an internal driver
  
  - Driver account
  
  - Assigned by
  
  - Assigned at
  
  - Delivery date
  
  - Delivery route/batch

Example:

```text
Order:
ORD-2026-000184

Driver:
Driver #7

Assigned:
Sep 6, 08:30

Delivery window:
Sep 6, 12:00-16:00
```

- Delivery lifecycle

I would separate order fulfillment from delivery status.

```text
UNASSIGNED
    ↓
ASSIGNED
    ↓
READY_FOR_DELIVERY
    ↓
OUT_FOR_DELIVERY
    ↓
DELIVERED
```

Failure states:

```text
DELIVERY_FAILED
CUSTOMER_UNAVAILABLE
ADDRESS_PROBLEM
RESCHEDULED
CANCELLED
```

- Internal tracking
  
  - No third-party tracking number required
  
  - Generate your own delivery reference
  
  - Example:
    
    - `DLV-2026-001921`
  
  - Customer sees delivery status inside their account
  
  - ETA updates

- Customer-facing tracking
  
  - Order confirmed
  
  - Preparing order
  
  - Ready for delivery (as in assigned)
  
  - Out for delivery
  
  - Delivered
  
  - Delivery delayed
  
  - Delivery rescheduled

Keep internal operational details hidden.

For example, customer sees:

```text
Out for delivery
Expected today
```

not:

```text
Driver #7
Route Batch AMM-14
Stop 12/24
```

- Driver accounts
  
  - Separate internal role
  
  - Drivers should not get normal admin permissions
  
  - Driver can see only assigned deliveries
  
  - Customer name
  
  - Phone
  
  - Address
  
  - Location pin
  
  - Delivery notes
  
  - Order/package count
  
  - Delivery status controls

Driver actions:

```text
Start delivery
Call customer
Open location
Mark delivered
Mark failed
Request reschedule
Add delivery note
```

- Delivery confirmation
  
  - Delivered timestamp
  
  - Driver
  
  - Optional customer signature
  
  - Optional delivery photo
  
  - Optional one-time delivery code
  
  - Optional customer name receiving order
  
  - Delivery notes

I particularly like a delivery PIN:

```text
Customer receives:
Delivery code: 482193
```

Driver enters it when handing over the order.

That gives you stronger proof of delivery than simply pressing `Delivered`.

- Failed deliveries
  
  - Driver must select reason
    
    - Customer unavailable
    
    - Wrong address
    
    - Customer requested reschedule
    
    - Customer refused order
    
    - Unable to access location
    
    - Other
  
  - Optional note
  
  - Optional evidence
  
  - System determines whether another attempt is allowed

Example:

```text
Attempt #1
Sep 6, 15:42

Result:
CUSTOMER_UNAVAILABLE

Next attempt:
Sep 7
```

- Delivery attempts
  
  - Track every attempt separately
  
  - Attempt number
  
  - Driver
  
  - Start time
  
  - Result
  
  - Failure reason
  
  - Notes
  
  - Evidence
  
  - Next scheduled attempt

Do not overwrite the first failed attempt when the second succeeds.

- Rescheduling
  
  - Admin can reschedule
  
  - Driver can request reschedule
  
  - Customer support can reschedule
  
  - Customer may optionally request a new delivery window
  
  - Record:
    
    - Old date
    
    - New date
    
    - Reason
    
    - Who changed it

- Delivery windows
  
  - Optional time slots
  
  - Example:
    
    - 09:00 - 12:00
    
    - 12:00 - 16:00
    
    - 16:00 - 20:00
  
  - Availability by zone
  
  - Maximum deliveries per slot
  
  - Customer can select during checkout if enabled

This can become very useful once order volume increases.

- Delivery batches
  
  - Group shipments for dispatch
  
  - By area
  
  - By date
  
  - By driver
  
  - By route

Example:

```text
Batch:
AMMAN-WEST-2026-09-06-AM

Driver:
Driver #3

Orders:
18

Stops:
18
```

- Route planning
  
  - V1
    
    - Manual ordering of deliveries
  
  - Later
    
    - Automatic route optimization
    
    - Distance-based ordering
    
    - Map view
    
    - Driver navigation

I would definitely leave automatic route optimization after v1.

- Shipping preparation
  
  - Once an order is packed:
    
    - Create internal shipment
    
    - Generate delivery reference
    
    - Assign delivery zone
    
    - Assign delivery date
    
    - Assign driver/batch
  
  - Shipment can contain one or more packages

- Packages
  
  - Package ID
  
  - Order
  
  - Contents
  
  - Weight
  
  - Package count
  
  - Prepared by
  
  - Prepared timestamp

V1 can use one package per order unless you genuinely need split packages.

- Split shipments
  
  - Support in the data model
  
  - Probably avoid operationally in v1
  
  - One order could theoretically become:
    
    - Shipment A
    
    - Shipment B
  
  - Useful later if stock comes from multiple locations

- Admin shipping dashboard
  
  - Orders awaiting dispatch
  
  - Ready for delivery
  
  - Unassigned deliveries
  
  - Assigned deliveries
  
  - Out for delivery
  
  - Delivered today
  
  - Failed deliveries
  
  - Rescheduled deliveries
  
  - Drivers
  
  - Delivery batches
  
  - Zones

- Admin delivery actions
  
  - Create shipment
  
  - Assign driver
  
  - Change driver
  
  - Schedule delivery
  
  - Reschedule
  
  - Change zone
  
  - Mark ready
  
  - Mark out for delivery
  
  - Mark delivered
  
  - Record failed attempt
  
  - Add internal note

Important status changes should remain audited.

- Driver dashboard
  
  - Today's deliveries
  
  - Upcoming deliveries
  
  - Delivery order
  
  - Customer details
  
  - Address/location
  
  - Package information
  
  - Status
  
  - Delivery confirmation
  
  - Failed-attempt form

- Customer notifications
  
  - Order ready for delivery
  
  - Delivery scheduled
  
  - Out for delivery
  
  - Delivery delayed
  
  - Delivery failed
  
  - Delivery rescheduled
  
  - Delivered
  
  - Optional delivery PIN notification

- Shipping analytics
  
  - Deliveries per day
  
  - Deliveries per driver
  
  - Delivery success rate
  
  - First-attempt success rate
  
  - Failed deliveries
  
  - Average delivery time
  
  - Average delay
  
  - Deliveries by zone
  
  - Shipping revenue
  
  - Shipping operational cost later
  
  - Driver performance metrics

I would avoid turning driver analytics into simplistic rankings. Metrics such as failures can be heavily influenced by the zones and customers assigned to a driver.

The internal system would therefore look roughly like:

```text
Order
  ↓
Packed
  ↓
Internal Shipment
  ├── Delivery zone
  ├── Package
  ├── Delivery window
  └── Delivery reference
        ↓
Assignment
  ├── Driver
  └── Delivery batch
        ↓
Delivery
  ├── Out for delivery
  ├── Attempts
  ├── Rescheduling
  └── Confirmation
        ↓
Delivered
```

This also means we should remove concepts like external carrier tracking URLs from the previous Orders plan and replace them with internal shipment and delivery references.


