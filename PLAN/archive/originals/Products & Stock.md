For Products and Variants, design it so the product represents what is being sold conceptually, while the variant represents the exact physical item the customer receives.

- Product identity
  
  - Internal product ID
  
  - Product name
  
  - URL slug
    
    - Example: `essential-compression-shirt`
  
  - Short description
  
  - Full description
  
  - Brand
  
  - Product status
    
    - Draft
    
    - Active
    
    - Hidden
    
    - Archived
  
  - Created at
  
  - Updated at
  
  - Published at
  
  - Created by
  
  - Last modified by

- Product classification
  
  - Primary category
  
  - Additional categories
  
  - Collections
  
  - Gender/audience
    
    - Men
    
    - Women
    
    - Unisex
  
  - Product type
    
    - T-shirt
    
    - Compression shirt
    
    - Tank top
    
    - Hoodie
    
    - Shorts
    
    - Joggers
    
    - Leggings
    
    - Sports bra
    
    - Socks
    
    - Accessories
  
  - Activity
    
    - Gym
    
    - Weightlifting
    
    - Running
    
    - Cross-training
    
    - Casual
  
  - Tags
    
    - `compression`
    
    - `summer`
    
    - `lightweight`
    
    - `new`

Categories should represent relatively permanent organization:

```text
Clothing
├── Tops
│   ├── T-Shirts
│   ├── Compression Shirts
│   ├── Tank Tops
│   └── Hoodies
│
└── Bottoms
    ├── Shorts
    ├── Joggers
    └── Leggings
```

Collections are more flexible merchandising groups:

```text
Core Collection
Summer 2027
Performance Series
Powerlifting Collection
New Arrivals
```

A product can therefore be:

```text
Product:
Essential Compression Shirt

Category:
Men > Tops > Compression Shirts

Collections:
Core Collection
Performance Series
```

- Product attributes
  
  - Material composition
    
    - Example: `85% polyester, 15% elastane`
  
  - Fit
    
    - Compression
    
    - Slim
    
    - Regular
    
    - Relaxed
    
    - Oversized
  
  - Features
    
    - Moisture-wicking
    
    - Breathable
    
    - Quick-dry
    
    - Stretch
    
    - Seamless
    
    - Lightweight
  
  - Care instructions
  
  - Country of manufacture, if needed
  
  - Weight
  
  - Optional dimensions

I would make features structured rather than storing everything inside the description. That allows filters such as:

```text
Fit: Compression
Feature: Quick-dry
Material: Polyester
```

- Options

Products need configurable option dimensions.

For clothing, the common ones are:

```text
Size
Color
```

But don't hardcode the product system to exactly those two. You may eventually sell:

```text
Gym Bottle

Options:
├── Color
└── Capacity
    ├── 500 ml
    ├── 750 ml
    └── 1 L
```

So conceptually:

```text
Product
└── Options
    ├── Size
    │   ├── S
    │   ├── M
    │   ├── L
    │   └── XL
    │
    └── Color
        ├── Black
        ├── White
        └── Navy
```

- Variants

Every purchasable combination becomes a variant.

```text
Essential Compression Shirt

Black / S
Black / M
Black / L
Black / XL

White / S
White / M
White / L
White / XL

Navy / S
Navy / M
Navy / L
Navy / XL
```

Each variant should have:

- Internal variant ID

- SKU

- Option values

- Base price

- Optional price override

- Optional compare-at price

- Barcode, if applicable

- Weight override

- Enabled/disabled

- Purchasable status

- Inventory tracking enabled/disabled

- Images specific to that variant

- Created at

- Updated at

Example:

```text
Product:
Essential Compression Shirt

Variant:
Black / M

SKU:
ECS-BLK-M

Price:
25 JOD

Barcode:
6251234567890

Inventory tracking:
Yes
```

- SKU system

Every physical variant should have a unique SKU.

For example:

```text
ECS-BLK-S
ECS-BLK-M
ECS-BLK-L

ECS-WHT-S
ECS-WHT-M
ECS-WHT-L
```

I would allow admins to specify SKUs manually, while optionally providing automatic generation.

SKUs should never be reused after a product is archived. Historical orders need to continue referring to the original item.

- Pricing

The product can have a default base price:

```text
Essential Compression Shirt
Base price: 25 JOD
```

Variants inherit that unless overridden:

```text
S       25 JOD
M       25 JOD
L       25 JOD
XL      25 JOD
XXL     27 JOD
```

This then feeds into the sales system we already designed:

```text
Base price
    ↓
Variant price override
    ↓
Applicable sale
    ↓
Cart/order discounts
    ↓
Final price
```

The original base/variant price must remain intact when a sale is active. A sale should not overwrite the actual product price.

- Colors

Colors should be reusable entities rather than arbitrary strings.

```text
Black
Display: Black
Code: black
Hex: #000000

White
Display: White
Code: white
Hex: #FFFFFF
```

This allows the storefront to show color swatches.

You can optionally support multiple visual values later for patterns or gradients.

- Sizes

Sizes should also be structured.

```text
XS
S
M
L
XL
XXL
```

But avoid assuming every product uses that system.

You could have:

```text
Clothing:
XS, S, M, L, XL

Shoes:
40, 41, 42, 43, 44

Accessories:
One Size
```

So size systems should be configurable.

- Size charts

A size chart should belong to a product or product category rather than being globally hardcoded.

Example:

```text
Men's Compression Tops

       Chest    Waist
S      88-94    72-78 cm
M      94-100   78-84 cm
L      100-106  84-90 cm
XL     106-112  90-96 cm
```

Products can reference the appropriate size chart.

The storefront then displays that as the popup we previously discussed.

- Product images

Support multiple images per product:

```text
Essential Compression Shirt
├── front.webp
├── back.webp
├── side.webp
├── model-front.webp
└── detail.webp
```

Each image should have:

- Original image

- Optimized versions

- Alt text

- Sort position

- Primary-image flag

Images should also optionally belong to a variant or option value.

For example:

```text
Black
├── black-front.webp
├── black-back.webp
└── black-model.webp

White
├── white-front.webp
├── white-back.webp
└── white-model.webp
```

Selecting `White` can therefore automatically switch the gallery.

- Product video

Optional, but worth supporting in the model:

- Product video

- Short demonstration

- Model wearing product

- Hosted video reference

- Thumbnail

- Sort position alongside images

I wouldn't make video mandatory.

- Inventory relationship

The Product system should know whether inventory is tracked, but actual quantities belong to Inventory, which we're planning next.

Product:

```text
Essential Compression Shirt
```

Variant:

```text
Black / M
SKU: ECS-BLK-M
```

Inventory:

```text
ECS-BLK-M
Available: 17
Reserved: 2
```

Do not store a single:

```text
Product stock = 50
```

for products with variants. The exact variant is what physically exists.

- Product availability

Separate product publication from stock.

A product can be:

```text
ACTIVE
```

while one variant is:

```text
Black / S      In stock
Black / M      In stock
Black / L      Out of stock
White / S      In stock
```

The entire product only becomes effectively unavailable when no purchasable variants remain.

- Product badges

Some badges should be generated:

```text
SALE
OUT OF STOCK
LOW STOCK
```

Others can be merchandising labels:

```text
NEW
BEST SELLER
LIMITED EDITION
STAFF PICK
```

Admin can control manually assigned badges.

Sales/promotions can generate their own temporary badges.

- Related products

Products can have manually specified relationships:

```text
Essential Compression Shirt

Related:
├── Performance Shorts
├── Training Joggers
└── Compression Leggings
```

You can later supplement that with automatic recommendations based on categories, collections, or purchase behavior.

For v1, manual plus category-based recommendations are enough.

- Product search

Even though `/search` was removed as a route, products still need searchable metadata.

Search across:

- Product name

- Description

- SKU

- Category

- Collection

- Tags

- Color

- Product type

For example:

```text
"black compression"

→ Essential Compression Shirt
→ Elite Compression Long Sleeve
→ Compression Training Top
```

- Filtering

Structured product data should support:

- Category

- Collection

- Product type

- Gender/audience

- Size

- Color

- Fit

- Material

- Features

- Activity

- Price

- In stock

- On sale

This is another reason not to put all product information into free-text tags.

- SEO

Each product should support:

- SEO title

- Meta description

- URL slug

- Canonical URL

- Social sharing image

- Structured product data

Defaults can be generated from the product, with admin overrides.

- Reviews relationship

Reviews belong to the product rather than individual variants by default.

```text
Essential Compression Shirt
Rating: 4.8

Black / M
White / L
etc.
```

A review can still record which variant the customer purchased.

That lets someone write:

```text
★★★★★

Purchased:
Black / M

"The medium fits..."
```

without fragmenting the rating across every color/size combination.

- Product lifecycle

I would use:

```text
DRAFT
   ↓
ACTIVE
   ↓
ARCHIVED
```

Plus:

```text
HIDDEN
```

for products that remain accessible internally or by direct link but should not appear normally in the catalog.

Deleting products that have ever appeared in an order should generally not happen. Archive them instead so historical orders remain intact.

- Product duplication

Admin should be able to duplicate a product.

For example:

```text
Duplicate:
Essential Compression Shirt

→ Essential Compression Shirt - Copy
```

Copy:

- Description

- Attributes

- Options

- Variants

- Categories

- Images if desired

Do not copy:

- SKU

- Inventory

- Reviews

- Sales history

This will make adding similar clothing substantially faster.

- Product history

Keep an administrative change history for important changes:

```text
Sep 5, 18:32
Admin A

Changed:
Price
25 JOD → 27 JOD
```

```text
Sep 5, 18:41
Admin B

Added variant:
Navy / XXL
```

This can eventually feed into the broader admin audit system.

The resulting hierarchy is:

```text
Product
│
├── Identity
├── Description
├── Categories
├── Collections
├── Attributes
│   ├── Material
│   ├── Fit
│   ├── Features
│   └── Activity
│
├── Options
│   ├── Size
│   └── Color
│
├── Variants
│   ├── Black / S
│   ├── Black / M
│   ├── White / S
│   └── ...
│
├── Media
│   ├── Images
│   └── Videos
│
├── Size Chart
├── Related Products
├── SEO
└── Reviews
```

And each variant is approximately:

```text
Variant
├── ID
├── SKU
├── Option values
├── Price override
├── Barcode
├── Weight
├── Media
├── Availability
└── Inventory reference
```

The important boundary is that Products define what an item is, Variants define exactly what can be purchased, and Inventory, which is the next system on our list, defines how many of each variant physically exist.

Reminder EVERYTHING must be dynamic, and easily changed via admin consoles, try to minimise hard-coded values, 

Example are tags, there should be a way for admins to create or remove tags and also tie them up to specific product types, for example `Variant Size` tag can be restricted to only `Clothing` product types, so it doesn't make non-clothing items metadata include unrelated tags
