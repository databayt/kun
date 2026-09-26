---
domain: prisma-6
severity: warn
paths: ["**/actions.ts", "**/*.queries.ts"]
since: "Prisma 6.0"
---

# Wrap multi-write operations in $transaction

Two or more dependent writes must run inside `$transaction` so they commit or roll back together. Otherwise a failure mid-sequence leaves the tenant's data half-written. On Neon, transactions need the WebSocket adapter `PrismaNeon`. The HTTP adapter (`PrismaNeonHTTP` in 6.x, `PrismaNeonHttp` in 7.x) rejects them with `Transactions are not supported in HTTP mode`.

## Good

```tsx
await db.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: { schoolId, total } });
  await tx.ledgerEntry.create({
    data: { schoolId, invoiceId: invoice.id, amount: total },
  });
});
```

## Bad

```tsx
// If the ledger write throws, the invoice is already committed
const invoice = await db.invoice.create({ data: { schoolId, total } });
await db.ledgerEntry.create({
  data: { schoolId, invoiceId: invoice.id, amount: total },
});
```

## Fix

Move the related writes into a single `db.$transaction([...])` or interactive `$transaction(async (tx) => {...})` block.

> Source: https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions · https://github.com/prisma/orm/blob/7.10.0/packages/adapter-neon/src/neon.ts
