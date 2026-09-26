Keep Sales and Promotions separate from Discounts, even though all three interact.

A discount code is something like `GYM20`. A sale changes the effective price of eligible products. A promotion is a campaign that can coordinate sales, discounts, banners, eligibility, and scheduling.

Here is the feature plan I would use.

- Sales
  
  - Internal name
  
  - Customer-facing name
  
  - Description
  
  - Enabled/disabled
  
  - Sale type
    
    - Percentage reduction
    
    - Fixed-value reduction
    
    - Fixed final price
  
  - Value
  
  - Optional maximum reduction for percentage sales
  
  - Start date/time
  
  - End date/time
  
  - No-expiration option
  
  - Automatically activate/deactivate based on schedule
  
  - Product eligibility
    
    - Entire store
    
    - Specific products
    
    - Specific variants
    
    - Specific categories
    
    - Specific collections
  
  - Exclusions
    
    - Specific products
    
    - Specific variants
    
    - Specific categories
    
    - Specific collections
  
  - Customer eligibility
    
    - Everyone
    
    - New customers
    
    - Existing customers
    
    - Verified accounts
    
    - Specific accounts
    
    - Customer groups
  
  - Optional minimum quantity
  
  - Optional minimum cart subtotal
  
  - Priority
  
  - Combination rules
  
  - Created by
  
  - Created at
  
  - Updated at

Example:

```text
Summer Compression Sale

Type:
Percentage

Value:
20%

Applies to:
Compression Collection

Excludes:
Limited Edition Compression Shirt

Starts:
June 1, 00:00

Ends:
June 15, 23:59
```

A `50 JOD` product would therefore display:

```text
50 JOD
40 JOD
```

The original price should remain available so the storefront can show the reduction.

- Sale stacking
  
  - Define explicitly what happens when multiple sales target the same product
  
  - Highest applicable sale wins, no stacking sales at all
  
  - Admin should be warned when creating overlapping sales and notes what sale wins for each overlapped product

For example:

```text
Product: 50 JOD

Store-wide sale:
10% off → 45 JOD

Compression sale:
20% off → 40 JOD

Result:
40 JOD
```

- Sale and discount interaction
  
  - Each sale defines whether coupon discounts can apply afterward
  
  - Each discount also defines whether it accepts already-on-sale products
  
  - Both must permit the combination

For example:

```text
Original:
100 JOD

Summer sale:
20%

Sale price:
80 JOD

Coupon:
GYM10 [10%]

Coupon permits sale items:
Yes

Sale permits coupons:
Yes

Final:
72 JOD
```

If either side says no, the coupon does not apply to that product.

- Automatic promotions
  
  - Buy X, get Y
  
  - Buy X, get Y discounted
  
  - Buy X quantity, receive percentage off
  
  - Spend X, receive Y off
  
  - Spend X, receive free shipping
  
  - Buy specific combinations
  
  - Bundle pricing

Examples:

```text
Buy 2 shirts
Get third shirt 20% off
```

```text
Spend 75 JOD
Get 10 JOD off
```

```text
Compression Shirt + Shorts
Normally: 55 JOD

Bundle:
49 JOD
```

For Buy X Get Y, define the rules carefully:

- Buy X Get Y
  
  - Required quantity
  
  - Required products/categories/collections
  
  - Reward quantity
  
  - Reward products/categories/collections
  
  - Reward type
    
    - Free
    
    - Percentage off
    
    - Fixed amount off
  
  - Maximum applications per order
  
  - The cheapest qualifying product receives the discount
  
  - Whether the promotion repeats

For example:

```text
Buy:
2 × any Core T-Shirt

Get:
1 × any Core T-Shirt

Reward:
100% off

Maximum:
2 applications/order
```

Then six shirts could potentially become:

```text
4 paid
2 free
```

instead of accidentally allowing unlimited free products.

- Quantity discounts
  
  - Quantity thresholds
  
  - Product-specific
  
  - Category-specific
  
  - Collection-specific
  
  - Percentage/fixed reduction
  
  - Tiered pricing

Example:

```text
Performance Shirts

1:
Normal price

2:
5% off

3:
10% off

5+:
15% off
```

This could be useful for gym clothing where customers may buy several colors of the same item.

- Bundles
  
  - Manually defined bundles
  
  - Products required
  
  - Whether variants can be selected
  
  - Fixed bundle price
  
  - Percentage bundle discount
  
  - Stock still tracked against individual variants
  
  - Bundle availability depends on component stock

Example:

```text
Starter Gym Set

1 × Performance Shirt
1 × Training Shorts
1 × Gym Towel

Normal:
72 JOD

Bundle:
60 JOD
```

I would not create separate inventory for that bundle. Selling it should decrement the underlying products.

- Flash sales
  
  - Normal sale engine
  
  - Short scheduled duration
  
  - Optional countdown timer
  
  - Optional quantity limit
  
  - Automatically ends
  
  - Display prominently on storefront

There is no need for a completely separate backend system for flash sales.

- Promotions
  
  - Promotions should act as campaigns that group related functionality.

For example:

```text
Summer 2027 Campaign

Starts:
June 1

Ends:
June 15

Contains:
├── 20% Compression Collection sale
├── Free shipping over 75 JOD
├── SUMMER10 coupon
├── Homepage banner
└── Featured Summer collection
```

This gives the admin one logical campaign rather than five unrelated configurations.

- Promotion presentation
  
  - Campaign banner
  
  - Homepage placement
  
  - Shop banner
  
  - Category/collection banner
  
  - Product badge
  
  - Cart message
  
  - Checkout message
  
  - Optional countdown
  
  - Customer-facing terms

Product badges could be automatically generated:

```text
SALE

20% OFF

NEW

BEST SELLER

LIMITED

BUY 2 GET 1
```

I would distinguish system-generated badges from manually assigned merchandising badges.

- New-customer promotions
  
  - First order only
  
  - Account must have no previous completed orders
  
  - Optional account-age limit
  
  - Minimum spend
  
  - Percentage/fixed reward
  
  - Maximum reduction
  
  - Can be automatic or require a code
  
  - Referral discounts can optionally override this

You need a conflict policy here. A new customer should not accidentally receive:

```text
15% referral
+
10% welcome
+
20% sale
+
10 JOD coupon
```

- Each pricing rule gets a priority
- Each rule specifies what it can combine with
- System calculates eligible combinations
- Never rely on frontend calculations
- Customer should see why something did or did not apply

For example:

```text
SUMMER20
Applied

WELCOME10
Not applied:
Cannot be combined with SUMMER20
```

- Promotion limits
  
  - Global usage limit
  
  - Per-account limit
  
  - Per-order limit
  
  - Maximum discounted quantity
  
  - Maximum monetary discount
  
  - Campaign budget

The last one is useful for controlled campaigns:

```text
Influencer Launch Campaign

Total promotional budget:
5,000 JOD

Used:
3,421 JOD

Remaining:
1,579 JOD
```

Once the configured budget is exhausted, qualifying promotions can automatically stop.

- Admin controls
  
  - Create
  
  - Draft
  
  - Preview
  
  - Schedule
  
  - Activate
  
  - Pause
  
  - End early
  
  - Duplicate
  
  - Archive
  
  - View affected products
  
  - Detect conflicting promotions
  
  - Preview calculated prices before publishing
  
  - Audit changes

I would specifically add a simulation feature to the admin panel. Before publishing a complicated promotion, staff could enter:

```text
Customer:
Normal account

Cart:
2 × Shirt M Black
1 × Shorts L Black

Region:
Jordan

Coupon:
GYM10
```

and receive:

```text
Subtotal                 80.00 JOD
Summer Sale             -12.00 JOD
GYM10                    - 6.80 JOD
Shipping                  3.00 JOD

Final                    64.20 JOD
```

That will be useful once several pricing rules coexist.

- Analytics
  
  - Promotion uses
  
  - Orders generated
  
  - Revenue generated
  
  - Gross discount amount
  
  - Average discount
  
  - Average order value
  
  - Products sold
  
  - Unique customers
  
  - New customers acquired
  
  - Referral overlap
  
  - Conversion rate where measurable
  
  - Campaign performance

The hierarchy I would settle on is:

```text
Promotion / Campaign
│
├── Sales
│   └── Changes product prices
│
├── Automatic Offers
│   ├── Buy X Get Y
│   ├── Quantity discount
│   ├── Bundles
│   └── Spend X Get Y
│
├── Discounts
│   └── Smart discount rules/codes
│
├── Shipping Offers
│   └── Free/reduced shipping
│
└── Presentation
    ├── Banners
    ├── Product badges
    └── Featured content
```

This also means your existing smart discount system remains useful rather than being replaced. Sales determine product pricing, discounts modify eligible orders, and promotions coordinate the overall campaign.
