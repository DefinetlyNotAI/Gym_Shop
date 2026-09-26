- Review eligibility
  
  - Only registered accounts
  
  - Only customers who actually purchased the product
  
  - Order must have reached `DELIVERED` for 1 day
  
  - One review per purchased product per order
  
  - Review records the purchased variant
  
  - Customer can edit their existing review instead of submitting duplicates
    
    - 1 day cooldown

- Review content
  
  - Rating from 1 to 5 stars
  
  - Written review
  
  - Purchased variant
    
    - Color
    
    - Size
  
  - Created date
  
  - Last edited date
  
  - Verified purchase automatically displayed

- Optional clothing-specific ratings
  
  - Overall rating
  
  - Fit
    
    - Runs small
    
    - True to size
    
    - Runs large
  
  - Quality rating
  
  - Comfort rating

I particularly think `Fit` is worthwhile for clothing.

For example:

```text
★★★★★  4.8

Essential Compression Shirt

Purchased:
Black / M

Fit:
True to size

Quality:
5/5

Comfort:
4/5

Verified Purchase
```

- Review media
  
  - Customer photos
  
  - Optional video later
  
  - Maximum upload count
  
  - File-size limits
  
  - Validate actual file types
  
  - Strip unnecessary image metadata
  
  - Review media stored separately from product media

- Review status
  
  - `PENDING`
  
  - `PUBLISHED`
  
  - `REJECTED`
  
  - `HIDDEN`

Verified-purchase reviews could publish immediately and then be moderated afterward.

- Moderation
  
  - Staff can hide inappropriate reviews
    
    - An AI classification model can also attempt to flag some for review
  
  - Staff can remove reviews
  
  - Reason required
  
  - Customer cannot remove moderation history by editing the review
  
  - Editing a heavily modified review can optionally return it to moderation
    
    - Above 5% of text modified AND above 20 character changes flag a re-review
  
  - Staff cannot alter the customer's rating or rewrite their review

- Reporting
  
  - Customers can report a review
    
    - Spam
    
    - Offensive content
    
    - Personal information
    
    - Irrelevant content
    
    - Other
  
  - Multiple reports do not automatically delete a review, but increase the priority for an staff to review
  
  - Staff reviews reports

- Product rating calculation
  
  - Average rating
  
  - Total review count
  
  - Rating distribution

Example:

```text
4.7 / 5
342 reviews

5 ★  ███████████████  276
4 ★  ███               42
3 ★  █                 16
2 ★                     5
1 ★                     3
```

- Review sorting
  
  - Most recent
  
  - Highest rated
  
  - Lowest rated
  
  - Most helpful
  
  - Reviews with photos

- Review filtering
  
  - Rating
  
  - Size purchased
  
  - Color purchased
  
  - Fit
  
  - With photos

- Helpful votes
  
  - Customers can mark reviews as helpful
  
  - One helpful vote per account per review
  
  - Customer can undo vote
  
  - Prevent reviewing your own review as helpful
  
  - Helpful count influences sorting

- Customer review history
  
  - Reviews written
  
  - Products awaiting review
  
  - Edit review
  
  - Delete review where permitted

This could live as a section within `/account` rather than requiring another public top-level route.

- Review requests
  
  - After an order is delivered, customer can receive a review request
  
  - Delay configurable
  - Do not repeatedly request a review that has already been submitted

- Review incentives
  
  - Optional loyalty reward for submitting a review
  
  - Reward only once per week
  
  - Reward must not depend on giving a positive rating

For example:

```text
Write a verified review:
+0.10 JOD store credit
```

If we implement this, the reward is for submitting genuine feedback, whether the customer gives one star or five.

- Product relationship
  
  - Reviews belong primarily to the product
  
  - Purchased variant is recorded as metadata
  
  - Product variants do not maintain completely separate ratings

```text
Essential Compression Shirt
├── Overall rating: 4.8
│
├── Review #1
│   └── Black / M
├── Review #2
│   └── White / L
└── Review #3
    └── Black / S
```

- Admin review dashboard
  
  - Pending reviews
  
  - Published reviews
  
  - Reported reviews
  
  - Hidden reviews
  
  - Search by customer
  
  - Search by product/SKU
  
  - Filter by rating
  
  - Filter by date
  
  - View associated order
  
  - Moderation history

- Review analytics
  
  - Average store rating
  
  - Average product rating
  
  - Review submission rate
  
  - Rating distribution
  
  - Fit feedback
  
  - Products with declining ratings
  
  - Products receiving frequent negative reviews
  
  - Review-to-order ratio

This can also connect with the support system. For example, if one product suddenly accumulates damaged-item claims and poor quality ratings, the admin dashboard can flag it for investigation.

The core relationship becomes:

```text
Customer
   ↓
Delivered Order
   ↓
Order Item
   ↓
Review
├── Product
├── Purchased Variant
├── Rating
├── Fit
├── Text
├── Media
├── Helpful Votes
└── Moderation
```
