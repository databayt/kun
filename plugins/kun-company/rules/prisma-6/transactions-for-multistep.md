---
domain: prisma-6
severity: warn
applies-to: ["**/actions.ts", "**/*.queries.ts"]
since: "Prisma 6.0"
---

# Wrap multi-write operations in $transaction

Two or more dependent writes must run inside `$transaction` so they commit or roll back together — a mid-sequence failure otherwise leaves the tenant's data half-written.

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
