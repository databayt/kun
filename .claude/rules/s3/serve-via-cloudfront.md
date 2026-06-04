---
domain: s3
severity: warn
paths: ["**/actions.ts", "**/content.tsx", "**/page.tsx", "**/columns.tsx"]
since: "AWS S3"
---

# Serve user assets through CloudFront, not raw S3 URLs

Persist and render assets via `cdn.databayt.org` (CloudFront), never `*.s3.amazonaws.com`. The CDN gives edge caching, a stable origin-agnostic URL, and lets us swap buckets without rewriting stored links. When overwriting an existing key, issue an invalidation or the edge keeps serving the stale object.

## Good

```tsx
// actions.ts — store the CDN-relative key, build the URL from CDN_URL
const key = `${schoolId}/avatars/${userId}.webp`;
await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body }));
await s3.send(new PutObjectCommand(/* ...overwrite... */));
await cloudfront.send(
  new CreateInvalidationCommand({
    DistributionId: env.CF_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: crypto.randomUUID(),
      Paths: { Quantity: 1, Items: [`/${key}`] },
    },
  }),
);
await db.user.update({
  where: { id: userId, schoolId },
  data: { avatarKey: key },
});

// content.tsx
<img src={`${env.NEXT_PUBLIC_CDN_URL}/${user.avatarKey}`} alt={user.name} />;
```

## Bad

```tsx
// content.tsx — direct S3 URL, no edge cache, and overwrite serves stale forever
<img
  src={`https://hogwarts-databayt.s3.amazonaws.com/${user.avatarKey}`}
  alt={user.name}
/>;
// actions.ts — overwrote the key but never invalidated CloudFront
await s3.send(
  new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: existingKey, Body }),
);
```

## Fix

Render `${NEXT_PUBLIC_CDN_URL}/${key}` instead of the `.s3.amazonaws.com` host, and fire a CloudFront `CreateInvalidation` for the path whenever you overwrite an existing key.
