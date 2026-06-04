---
domain: s3
severity: error
paths: ["**/actions.ts", "**/upload/**/*.ts", "**/lib/s3.ts"]
since: "AWS S3"
---

# Client uploads/downloads go through short-lived presigned URLs

The browser must never hold AWS credentials and the bucket must never be public-write. A Server Action mints a presigned PUT/GET that expires in minutes, scoped to a tenant-prefixed key, so leaked links die fast and tenants can't read each other's objects.

## Good

```tsx
// actions.ts — Server Action, runs on the server with auth() + scoped key
"use server";
export async function getUploadUrl(input: { fileName: string; type: string }) {
  const session = await auth();
  if (!session?.user.schoolId) throw new Error("Unauthorized");
  const { fileName, type } = uploadSchema.parse(input);
  const key = `${session.user.schoolId}/uploads/${crypto.randomUUID()}-${fileName}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: type,
    }),
    { expiresIn: 300 }, // 5 minutes
  );
  return { url, key };
}
```

## Bad

```tsx
// form.tsx — credentials shipped to the browser, unbounded public-write bucket
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_KEY!, // leaked to every visitor
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET!,
  },
});
await s3.send(
  new PutObjectCommand({
    Bucket: "public-write-bucket",
    Key: file.name,
    Body: file,
  }),
);
```

## Fix

Move credentials server-side, mint a presigned URL in a Server Action with `expiresIn` and a `schoolId`-prefixed key, and have the client PUT/GET only that URL.
