# Auth Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | full-system (2FA, OAuth, tenant, tests) | production | 33 | **yes** |
| codebase | full-system (no tenant extensions) | production | 30 | no |
| mkan | standard (login/join/reset/password/verify) | development | 25 | no |
| shifa | standard (near-identical to mkan) | development | 23 | no |
| souq | clerk (incompatible) | production | 0 | no |

## Canonical: hogwarts

### File Structure

```
src/components/auth/
  # Core utilities
  auth.ts               # currentUser(), currentRole() via NextAuth auth()
  validation.ts         # Zod schemas with i18n factory: createLoginSchema(dict)
  user.ts               # getUserByEmail, getUserById, getOrCreateOAuthUser
  account.ts            # getAccountByUserId
  tokens.ts             # generateVerificationToken, generatePasswordResetToken, generate2FAToken
  mail.ts               # sendVerificationEmail, sendPasswordResetEmail, send2FAEmail
  password.ts           # hashPassword (PBKDF2 + salt)

  # UI components
  card-wrapper.tsx      # Auth card shell: header + social + content + back-button
  header.tsx            # Auth card header with label
  social.tsx            # Google/Facebook OAuth buttons
  form-error.tsx        # Red error banner
  form-success.tsx      # Green success banner
  error-card.tsx        # Full error card mapping NextAuth error codes
  back-button.tsx       # Link-styled navigation button
  login-button.tsx      # Login trigger (modal or redirect mode)
  logout-button.tsx     # Context-aware logout
  logout-action.ts      # Server action: signOut + redirect
  user-button.tsx       # Avatar dropdown menu (marketing/site/saas/platform variants)
  user-info.tsx         # Debug card showing user details
  role-gate.tsx         # Blocks children unless allowedRole matches

  # Hooks
  use-current-user.ts   # Returns session.data?.user
  use-current-role.ts   # Returns session.data?.user?.role

  # Auth flows (each: form.tsx + action.ts)
  login/form.tsx        # Email/password + OTP + social
  login/action.ts       # Credential auth + brute-force protection + 2FA
  join/form.tsx         # Registration form
  join/action.ts        # Register + hash + send verification
  reset/form.tsx        # Password reset request (email)
  reset/action.ts       # Generate reset token + send email
  password/form.tsx     # New password (from reset link)
  password/action.ts    # Validate token + update password
  verification/form.tsx # Auto-verify on mount via URL token
  verification/action.ts # Validate token + mark verified + OTP verify

  # Tenant extensions (hogwarts-only)
  prisma-adapter.ts     # Custom multi-tenant Prisma adapter
  admin-auth-guard.tsx  # Admin/Developer role guard
  tenant-login.tsx      # Tenant-specific OAuth redirect
```

### Architecture

Five-step auth flow, each as a subdirectory with `form.tsx` (client) + `action.ts` (server):

```
login → join → (verification) → reset → password
  ↓                                ↓
 2FA (OTP)                    New password
  ↓
 Dashboard
```

**Validation pattern**: i18n factory functions preferred over static schemas:
```typescript
// Preferred: i18n-aware
const schema = createLoginSchema(dictionary)

// Legacy: hardcoded English
const schema = LoginSchema
```

### Usage Example

**Auth page:**
```tsx
import { CardWrapper } from "@/components/auth/card-wrapper"
import { LoginForm } from "@/components/auth/login/form"

export default function LoginPage() {
  return (
    <CardWrapper headerLabel="Welcome back" showSocial backButtonHref="/join">
      <LoginForm />
    </CardWrapper>
  )
}
```

**Route protection:**
```tsx
import { currentUser, currentRole } from "@/components/auth/auth"
import { RoleGate } from "@/components/auth/role-gate"

// Server-side
const user = await currentUser()
if (!user) redirect("/login")

// Client-side
<RoleGate allowedRole="ADMIN">
  <AdminPanel />
</RoleGate>
```

## Clone

```
/clone pattern:auth
/clone hogwarts:src/components/auth/
```

## Migration

**From standard auth (mkan/shifa):**
1. Add missing components: user-button variants, admin-auth-guard
2. Upgrade validation to i18n factory pattern: `createLoginSchema(dictionary)`
3. Add 2FA support if needed (tokens.ts, verification/2f-token.ts)
4. Tenant extensions are optional — skip for single-tenant apps
