Make analytics a read-only aggregation layer over the operational systems, not something that owns business state.

Core areas:

- Sales analytics
  
  - Revenue
  
  - Net revenue after discounts
  
  - Orders
  
  - Average order value
  
  - Units sold
  
  - Revenue by day/week/month
  
  - Revenue by product/category/collection

- Product analytics
  
  - Best-selling products
  
  - Best-selling variants
  
  - Slow-moving products
  
  - Conversion by product
  
  - Review score trends
  
  - Damage/replacement rate
  
  - Wishlist VS Purchase trends
  
  - Smart suggestion algorithim on what may be the best course of action

- Inventory analytics
  
  - Current stock
  
  - Low/out-of-stock counts
  
  - Stock value
  
  - Stock turnover
  
  - Damaged/lost stock
  
  - Restock history
  
  - Estimated days remaining later

- Order analytics
  
  - Created/paid/completed/cancelled
  
  - Failed payments
  
  - Fulfillment time
  
  - Cancellation rate
  
  - Replacement rate

- Internal delivery analytics
  
  - Deliveries per day
  
  - First-attempt success rate
  
  - Failed attempts
  
  - Reschedules
  
  - Average delivery time
  
  - Deliveries by zone
  
  - Delivery Agent workload

- Promotion analytics
  
  - Uses
  
  - Revenue generated
  
  - Discount amount
  
  - Average discount
  
  - Campaign performance
  
  - Coupon usage
  
  - Promotion overlap
  
  - Budget consumption

- Referral analytics
  
  - Referral signups
  
  - Qualified referrals
  
  - Conversion rate
  
  - Revenue from referrals
  
  - Store credit issued
  
  - Cash-eligible earnings
  
  - CliQ payouts
  
  - Top referrers
  
  - Verified partner performance

- Wallet/rewards analytics
  
  - Credit issued
  
  - Credit spent
  
  - Outstanding balance
  
  - Expired credit
  
  - Referral earnings
  
  - Manual adjustments

- Support analytics
  
  - Tickets opened/resolved
  
  - Tickets by category
  
  - First response time
  
  - Resolution time
  
  - Reopen rate
  
  - Damage claims
  
  - Replacement approval rate

- Review analytics
  
  - Average rating
  
  - Rating distribution
  
  - Review submission rate
  
  - Fit feedback
  
  - Products with worsening ratings
  
  - Products with frequent quality complaints

- Customer analytics
  
  - New customers
  
  - Returning customers
  
  - Repeat purchase rate
  
  - Orders per customer
  
  - Lifetime value later
  
  - Referral acquisition
  
  - Marketing opt-in rate

Role visibility should follow the same authorization model:

```text
CTO
→ everything

Super Admin
→ 99% of everything

Admin
→ mostly anything

Logistic Staff
→ products, inventory, fulfillment, delivery

Finance Staff
→ revenue, payments, wallet, referrals, CliQ payouts

Support Agent
→ support and replacement analytics

Delivery Agent
→ only their own delivery statistics (not every drivers)
```

Analytics should support shared filters:

```text
Date range
Product
Category
Collection
Customer group
Promotion
Referral campaign
Delivery zone
Status
```

Exports:

```text
CSV
XLSX
PDF reports later if useful
```

For dashboards, I would keep v1 focused on useful KPIs rather than dozens of charts.

Example executive dashboard:

```text
Revenue today
Orders today
Average order value
Units sold
Pending orders
Low-stock variants
Open support tickets
Deliveries today
Pending CliQ payouts
Referral revenue
```

One important rule: analytics numbers should come from stable transaction/event data.

For example, historical revenue should use order snapshots, not current product prices.

```text
Order snapshots
Stock movements
Wallet ledger
Referral rewards
Payments
Delivery events
Support events
        ↓
Analytics aggregation
```

For expensive reports, we can later use precomputed daily aggregates instead of recalculating everything live.

Example:

```text
analytics_daily_sales
analytics_daily_products
analytics_daily_delivery
analytics_daily_referrals
```

But do not overbuild that before real volume requires it.

Audit analytics should remain separate from business analytics. Normal analytics should not become a shortcut for bypassing audit visibility rules.
