---
name: souq
description: E-commerce reference - multi-vendor marketplace, cart, vendor dashboards
model: opus
version: "Next.js + Redux Toolkit"
handoff: [architecture, react, prisma]
---

# Souq Reference Agent

**Scope**: E-commerce | **Patterns**: Multi-Vendor, Cart, Checkout | **Repo**: databayt/souq

## When to Use

Trigger when user says:
- `like souq`
- `cart from souq`
- `vendor dashboard`
- `e-commerce`
- `marketplace`
- `product catalog`

## Repository Info

| Field | Value |
|-------|-------|
| **URL** | https://github.com/databayt/souq |
| **Stack** | Next.js, Redux Toolkit, Tailwind CSS |
| **Local** | /Users/abdout/oss/souq (if cloned) |

## Core Patterns

### 1. Multi-Vendor Architecture

```prisma
model Vendor {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?
  logo         String?

  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])

  products     Product[]
  orders       OrderItem[]

  status       VendorStatus  // PENDING, APPROVED, SUSPENDED
  commission   Float         @default(0.10)  // 10% commission

  createdAt    DateTime @default(now())
}

model Product {
  id           String   @id @default(cuid())
  vendorId     String
  vendor       Vendor   @relation(fields: [vendorId], references: [id])

  name         String
  slug         String
  description  String?
  price        Decimal
  comparePrice Decimal?

  images       ProductImage[]
  variants     ProductVariant[]
  categories   Category[]

  @@unique([vendorId, slug])
}
```

### 2. Shopping Cart (Redux)

```typescript
// store/cart-slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface CartItem {
  productId: string
  variantId?: string
  quantity: number
  price: number
}

interface CartState {
  items: CartItem[]
  total: number
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], total: 0 } as CartState,
  reducers: {
    addItem: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find(
        i => i.productId === action.payload.productId &&
             i.variantId === action.payload.variantId
      )
      if (existing) {
        existing.quantity += action.payload.quantity
      } else {
        state.items.push(action.payload)
      }
      state.total = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
      )
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.productId !== action.payload)
      state.total = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
      )
    },
    clearCart: (state) => {
      state.items = []
      state.total = 0
    },
  },
})
```

### 3. Product Catalog

```typescript
// components/products/catalog.tsx
interface ProductFilters {
  category?: string
  vendor?: string
  minPrice?: number
  maxPrice?: number
  sortBy?: 'price-asc' | 'price-desc' | 'newest' | 'popular'
}

export async function getProducts(filters: ProductFilters) {
  return db.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(filters.category && {
        categories: { some: { slug: filters.category } }
      }),
      ...(filters.vendor && { vendor: { slug: filters.vendor } }),
      ...(filters.minPrice && { price: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
    },
    include: {
      vendor: { select: { name: true, slug: true } },
      images: { take: 1 },
      _count: { select: { reviews: true } },
    },
    orderBy: getOrderBy(filters.sortBy),
  })
}
```

### 4. Vendor Dashboard

```
app/
  vendor/
    dashboard/
      page.tsx          # Sales overview
    products/
      page.tsx          # Product management
      create/page.tsx   # Add product
      [id]/page.tsx     # Edit product
    orders/
      page.tsx          # Order management
    analytics/
      page.tsx          # Sales analytics
    settings/
      page.tsx          # Store settings
```

### 5. Order Management

```prisma
model Order {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])

  status       OrderStatus  // PENDING, PAID, SHIPPED, DELIVERED, CANCELLED
  total        Decimal

  items        OrderItem[]
  shippingAddress Address?

  createdAt    DateTime @default(now())
}

model OrderItem {
  id           String   @id @default(cuid())
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id])

  productId    String
  product      Product  @relation(fields: [productId], references: [id])
  vendorId     String
  vendor       Vendor   @relation(fields: [vendorId], references: [id])

  quantity     Int
  price        Decimal

  status       ItemStatus  // PENDING, SHIPPED, DELIVERED
}
```

### 6. Category Tree

```prisma
model Category {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  image       String?

  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")

  products    Product[]
}
```

## Reference Checklist

When implementing features "like souq":

- [ ] Vendor model with commission tracking
- [ ] Product belongs to vendor with unique slug per vendor
- [ ] Redux cart with persistence
- [ ] Order splits items by vendor
- [ ] Category tree (self-referential)
- [ ] Product variants (size, color)
- [ ] Image gallery per product

## Files to Reference

| Pattern | Path in souq |
|---------|--------------|
| Redux store | `src/store/` |
| Cart slice | `src/store/cart-slice.ts` |
| Product schema | `prisma/models/product.prisma` |
| Vendor dashboard | `src/app/vendor/` |
| Checkout flow | `src/app/checkout/` |
| Product filters | `src/components/products/filters.tsx` |

## Access Commands

```bash
# Clone locally
git clone https://github.com/databayt/souq ~/oss/souq

# Reference via MCP
mcp__github__get_file_contents(owner="databayt", repo="souq", path="src/store/cart-slice.ts")
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| State management | `react` |
| Database schema | `prisma` |
| Architecture | `architecture` |
