Revised customer-facing route structure:

* `/`

  * Homepage
  * Hero/banner
  * Featured products
  * New arrivals
  * Featured collections
  * Best sellers
  * Promotions
  * Category shortcuts
  * Newsletter signup

* `/shop`

  * All products
  * Search
  * Filters

    * Category
    * Collection
    * Gender
    * Size
    * Color
    * Price
    * Availability
  * Sorting

    * Featured
    * Newest
    * Best selling
    * Price low to high
    * Price high to low
  * Pagination or infinite scrolling

* `/products/{slug}`

  * Product name
  * Description
  * Image gallery
  * Price
  * Sale price
  * Color selection
  * Size selection
  * Variant availability
  * Quantity selection
  * Add to cart
  * Size guide popup
  * Material
  * Fit information
  * Care instructions
  * Shipping information
  * Related products
  * Reviews

    * Average rating
    * Customer reviews
    * Verified purchase
    * Write review

* `/categories/{slug}`

  * Category information
  * Products
  * Search
  * Filters
  * Sorting
  * Pagination

* `/collections/{slug}`

  * Collection banner
  * Collection description
  * Products
  * Search
  * Filters
  * Sorting
  * Pagination

* `/cart`

  * Cart items
  * Product image
  * Selected size
  * Selected color
  * Unit price
  * Quantity adjustment
  * Remove item
  * Discount code
  * Subtotal
  * Estimated shipping
  * Estimated total
  * Stock validation
  * Checkout button

* `/checkout`

  * Login requirement
  * Shipping address
  * Saved address selection
  * Billing address
  * Shipping method
  * Discount code
  * Order summary
  * Size guide popup
  * Taxes
  * Shipping cost
  * Final total
  * Payment
  * Terms acceptance
  * Place order
  * No guest checkout

* `/checkout/success`

  * Order confirmation
  * Order number
  * Payment confirmation
  * Order summary
  * Shipping address
  * Estimated delivery
  * View order
  * Continue shopping

* `/account`

  * Login form

  * Registration form

  * Email verification form

  * Resend verification email

  * Forgot password form

  * Reset password form

  * Account overview when logged in

  * Recent orders

  * Customer information

  * `/account/profile`

    * Name
    * Email
    * Phone number
    * Edit profile
    * Change email
    * Change password

  * `/account/addresses`

    * Saved addresses
    * Add address
    * Edit address
    * Delete address
    * Default shipping address
    * Default billing address

  * `/account/orders`

    * Order history
    * Order status
    * Order date
    * Order total
    * Search/filter orders

  * `/account/orders/{order}`

    * Order number
    * Order status
    * Ordered products
    * Product variants
    * Quantities
    * Prices
    * Discounts
    * Payment information
    * Shipping information
    * Shipment tracking
    * Order total
    * Receipt/invoice
    * Contact support about order

  * `/account/settings`

    * Email preferences
    * Marketing preferences
    * Account deletion

* `/about`

  * Brand information
  * Brand story
  * Values
  * Gym/fitness focus

* `/contact`

  * Customer support form
  * Support email
  * Order-related support
  * Damaged product reports

    * Order selection
    * Product selection
    * Damage description
    * Photo upload
    * Replacement request
  * Product questions
  * Payment problems
  * General inquiries

* `/faq`

  * Products
  * Sizing
  * Orders
  * Payments
  * Shipping
  * Damaged products
  * Replacements
  * Accounts

* `/shipping`

  * Available destinations
  * Shipping methods
  * Shipping prices
  * Estimated delivery times
  * Shipment tracking information

* `/legal`

  * Terms of service
  * Privacy policy
  * Cookie policy
  * Purchase terms
  * Payment terms
  * Account terms
  * Data collection and usage
  * Customer privacy rights
  * Cookie preferences

* `/404`

  * Not-found message
  * Search
  * Return home
  * Shop link

This leaves you with a much tighter structure:

```text
/
/shop
/products/{slug}
/categories/{slug}
/collections/{slug}
/cart
/checkout
/checkout/success

/account
/account/profile
/account/addresses
/account/orders
/account/orders/{order}
/account/settings

/about
/contact
/faq
/shipping
/legal
```
