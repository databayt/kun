---
name: internationalization
description: i18n expert - Arabic/English, RTL/LTR, dictionaries, locale-aware formatting, Next.js App Router
model: opus
---

# Internationalization Expert

**Languages**: Arabic (RTL) + English (LTR)
**Framework**: Next.js 15 App Router
**Stack**: TypeScript, Tailwind CSS 4, React 19

---

## 1. Locale Configuration

### Type Definitions
```typescript
// config.ts
export const i18n = {
  defaultLocale: 'ar',
  locales: ['en', 'ar'] as const,
} as const

export type Locale = (typeof i18n.locales)[number]

export interface LocaleConfig {
  name: string
  nativeName: string
  dir: 'ltr' | 'rtl'
  flag: string
  dateFormat: string
  currency: { code: string; symbol: string; position: 'before' | 'after' }
}

export const localeConfig: Record<Locale, LocaleConfig> = {
  en: {
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    flag: '🇺🇸',
    dateFormat: 'MM/DD/YYYY',
    currency: { code: 'USD', symbol: '$', position: 'before' },
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
    dateFormat: 'DD/MM/YYYY',
    currency: { code: 'SAR', symbol: 'ر.س', position: 'after' },
  },
}

export const isRTL = (locale: Locale): boolean => locale === 'ar'
export const getDir = (locale: Locale): 'ltr' | 'rtl' => localeConfig[locale].dir
```

---

## 2. Dictionary Architecture

### File Organization
```
src/components/internationalization/
├── config.ts                    # Locale types & config
├── dictionaries.ts              # Server-side loaders
├── get-dictionary-client.ts     # Client-side loader
├── use-locale.ts                # Locale hooks
├── use-dictionary.ts            # Dictionary hooks
├── actions.ts                   # Server actions
├── middleware.ts                # Locale detection
├── language-switcher.tsx        # UI component
├── helpers/
│   └── index.ts                 # Message helpers
├── en.json                      # General English
├── ar.json                      # General Arabic
├── school-en.json               # Feature-specific English
├── school-ar.json               # Feature-specific Arabic
└── dictionaries/
    ├── en/
    │   ├── admin.json
    │   ├── finance.json
    │   ├── messages.json        # Validation, toast, errors
    │   └── [feature].json
    └── ar/
        └── [mirror of en/]
```

### Dictionary Type Definition
```typescript
// Types inferred from JSON structure
export type Dictionary = {
  // General keys (from en.json)
  metadata: { title: string; description: string }
  common: {
    loading: string
    error: string
    save: string
    cancel: string
    delete: string
    edit: string
    create: string
    search: string
    filter: string
    actions: string
    // ... other common keys
  }
  navigation: { [key: string]: string }
  auth: { [key: string]: string }

  // Feature-specific (nested under feature name)
  finance?: { [key: string]: string | object }
  admin?: { [key: string]: string | object }
  messages?: {
    validation: { [key: string]: string }
    toast: {
      success: { [key: string]: string }
      error: { [key: string]: string }
      warning: { [key: string]: string }
    }
    error: { [key: string]: string }
  }
}
```

### Server-Side Dictionary Loaders
```typescript
// dictionaries.ts
import type { Locale } from './config'

// Full dictionary loader (default)
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const dictionaries = {
    en: () => import('./en.json').then(m => m.default),
    ar: () => import('./ar.json').then(m => m.default),
  }
  return dictionaries[locale]?.() ?? dictionaries.en()
}

// Route-specific loaders (bundle optimization)
export async function getPlatformDictionary(locale: Locale) {
  const [general, school, messages] = await Promise.all([
    import(`./${locale}.json`).then(m => m.default),
    import(`./school-${locale}.json`).then(m => m.default),
    import(`./dictionaries/${locale}/messages.json`).then(m => m.default),
  ])
  return { ...general, ...school, messages }
}

export async function getFinanceDictionary(locale: Locale) {
  const [platform, finance] = await Promise.all([
    getPlatformDictionary(locale),
    import(`./dictionaries/${locale}/finance.json`).then(m => m.default),
  ])
  return { ...platform, finance }
}

export async function getAdminDictionary(locale: Locale) {
  const [platform, admin] = await Promise.all([
    getPlatformDictionary(locale),
    import(`./dictionaries/${locale}/admin.json`).then(m => m.default),
  ])
  return { ...platform, admin }
}

// Add more route-specific loaders as needed
```

### Fallback Strategy
```typescript
export async function getDictionarySafe(locale: Locale): Promise<Dictionary> {
  try {
    return await getDictionary(locale)
  } catch (error) {
    console.error(`Failed to load ${locale} dictionary, falling back to English`)
    return getDictionary('en')
  }
}
```

---

## 3. Server Components

### Page Pattern
```typescript
// app/[lang]/dashboard/page.tsx
import { getDictionary } from '@/components/internationalization/dictionaries'
import type { Locale } from '@/components/internationalization/config'
import { DashboardContent } from '@/components/dashboard/content'

interface PageProps {
  params: Promise<{ lang: Locale }>
}

export default async function DashboardPage({ params }: PageProps) {
  const { lang } = await params
  const dictionary = await getDictionary(lang)

  return <DashboardContent dictionary={dictionary} locale={lang} />
}
```

### Content Component (Server)
```typescript
// components/dashboard/content.tsx
import type { Dictionary } from '@/components/internationalization/dictionaries'
import type { Locale } from '@/components/internationalization/config'
import { DashboardTable } from './table'

interface ContentProps {
  dictionary: Dictionary
  locale: Locale
}

export async function DashboardContent({ dictionary, locale }: ContentProps) {
  // Server-side data fetching
  const data = await fetchDashboardData()

  return (
    <div>
      <h1>{dictionary.dashboard?.title}</h1>
      <p>{dictionary.dashboard?.description}</p>

      {/* Pass dictionary to client components */}
      <DashboardTable
        data={data}
        dictionary={dictionary}
        locale={locale}
      />
    </div>
  )
}
```

### Layout with Locale
```typescript
// app/[lang]/layout.tsx
import { i18n, type Locale, getDir } from '@/components/internationalization/config'
import { Inter, Tajawal } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal'
})

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ lang: Locale }>
}

export function generateStaticParams() {
  return i18n.locales.map(locale => ({ lang: locale }))
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  const isArabic = lang === 'ar'

  return (
    <html lang={lang} dir={getDir(lang)}>
      <body className={isArabic ? tajawal.className : inter.className}>
        {children}
      </body>
    </html>
  )
}
```

---

## 4. Client Components

### useLocale Hook
```typescript
// use-locale.ts
'use client'

import { useParams, usePathname } from 'next/navigation'
import { i18n, localeConfig, type Locale } from './config'

export function useLocale() {
  const params = useParams()
  const locale = (params?.lang as Locale) || i18n.defaultLocale

  return {
    locale,
    isRTL: locale === 'ar',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    config: localeConfig[locale],
  }
}

export function useSwitchLocaleHref() {
  const pathname = usePathname()
  const { locale } = useLocale()

  return (newLocale: Locale) => {
    if (!pathname) return `/${newLocale}`

    // Replace current locale in path
    const segments = pathname.split('/')
    segments[1] = newLocale
    return segments.join('/')
  }
}
```

### useDictionary Hook
```typescript
// use-dictionary.ts
'use client'

import { useState, useEffect } from 'react'
import { useLocale } from './use-locale'
import type { Dictionary } from './dictionaries'

// Client-side dictionary loader
async function getDictionaryClient(locale: string): Promise<Dictionary> {
  const [general, school] = await Promise.all([
    import(`./${locale}.json`).then(m => m.default),
    import(`./school-${locale}.json`).then(m => m.default),
  ])
  return { ...general, ...school }
}

export function useDictionary() {
  const { locale } = useLocale()
  const [dictionary, setDictionary] = useState<Dictionary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getDictionaryClient(locale)
      .then(setDictionary)
      .finally(() => setIsLoading(false))
  }, [locale])

  return { dictionary, isLoading }
}
```

### Language Switcher Component
```typescript
// language-switcher.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useSwitchLocaleHref } from './use-locale'
import { i18n, localeConfig, type Locale } from './config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'inline' | 'toggle'
}

export function LanguageSwitcher({ variant = 'dropdown' }: LanguageSwitcherProps) {
  const router = useRouter()
  const { locale, isRTL } = useLocale()
  const getSwitchHref = useSwitchLocaleHref()

  const switchLocale = (newLocale: Locale) => {
    router.push(getSwitchHref(newLocale))
  }

  if (variant === 'toggle') {
    const nextLocale = locale === 'ar' ? 'en' : 'ar'
    return (
      <Button variant="ghost" size="sm" onClick={() => switchLocale(nextLocale)}>
        {localeConfig[nextLocale].nativeName}
      </Button>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex gap-2">
        {i18n.locales.map((loc) => (
          <Button
            key={loc}
            variant={locale === loc ? 'default' : 'ghost'}
            size="sm"
            onClick={() => switchLocale(loc)}
          >
            {localeConfig[loc].flag} {localeConfig[loc].nativeName}
          </Button>
        ))}
      </div>
    )
  }

  // Default: dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="h-4 w-4 me-2" />
          {localeConfig[locale].nativeName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
        {i18n.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {localeConfig[loc].flag} {localeConfig[loc].nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Client Component with Dictionary
```typescript
// components/feature/table.tsx
'use client'

import { useMemo } from 'react'
import type { Dictionary } from '@/components/internationalization/dictionaries'
import type { Locale } from '@/components/internationalization/config'
import { getColumns } from './columns'

interface TableProps {
  data: Item[]
  dictionary: Dictionary
  locale: Locale
}

export function FeatureTable({ data, dictionary, locale }: TableProps) {
  // Generate columns with dictionary (memoized)
  const columns = useMemo(
    () => getColumns(dictionary, locale),
    [dictionary, locale]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder={dictionary.common.search}
    />
  )
}
```

---

## 5. RTL/LTR Layout

### Logical CSS Properties
```css
/* ALWAYS use logical properties for RTL/LTR support */

/* Margins */
.element {
  margin-inline-start: 1rem;   /* NOT margin-left */
  margin-inline-end: 1rem;     /* NOT margin-right */
  margin-inline: 1rem;         /* Both start and end */
}

/* Padding */
.element {
  padding-inline-start: 1rem;  /* NOT padding-left */
  padding-inline-end: 1rem;    /* NOT padding-right */
  padding-inline: 1rem;        /* Both start and end */
}

/* Positioning */
.element {
  inset-inline-start: 0;       /* NOT left: 0 */
  inset-inline-end: 0;         /* NOT right: 0 */
}

/* Text Alignment */
.element {
  text-align: start;           /* NOT text-align: left */
  text-align: end;             /* NOT text-align: right */
}

/* Borders */
.element {
  border-inline-start: 1px solid;  /* NOT border-left */
  border-inline-end: 1px solid;    /* NOT border-right */
}
```

### Tailwind CSS 4 RTL Classes
```tsx
// Use ms-* (margin-start) and me-* (margin-end) instead of ml-* and mr-*
<div className="ms-4 me-2">Start margin 4, end margin 2</div>

// Use ps-* (padding-start) and pe-* (padding-end)
<div className="ps-4 pe-2">Start padding 4, end padding 2</div>

// Use start-* and end-* for positioning
<div className="absolute start-0 end-auto">Positioned at start</div>

// Use text-start and text-end
<p className="text-start">Aligned to start</p>

// RTL-specific overrides when needed
<div className="flex rtl:flex-row-reverse">Reverse in RTL</div>
<div className="rounded-s-lg rtl:rounded-e-lg">Border radius start</div>

// Space between with direction awareness
<div className="flex gap-4 rtl:space-x-reverse">Spaced items</div>
```

### Font Configuration
```typescript
// app/[lang]/layout.tsx
import { Inter, Tajawal } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-tajawal',
})

// CSS Variables in globals.css
:root {
  --font-sans: var(--font-inter);
}

[dir="rtl"] {
  --font-sans: var(--font-tajawal);
}

// Apply in layout
<body className={`${inter.variable} ${tajawal.variable} font-sans`}>
```

### Common RTL Pitfalls
```tsx
// Icons that need flipping
<ChevronRight className="rtl:rotate-180" />  // Arrows
<ArrowLeft className="rtl:rotate-180" />     // Navigation arrows

// Flex direction
<div className="flex rtl:flex-row-reverse">  // When explicit LTR order needed

// Text truncation
<p className="truncate text-start">Long text...</p>

// Border radius
<div className="rounded-s-lg">  // Start side radius
<div className="rounded-e-lg">  // End side radius

// Absolute positioning
<div className="absolute start-0">  // NOT left-0
<div className="absolute end-0">    // NOT right-0
```

---

## 6. Formatting Utilities

### Number Formatting
```typescript
// lib/i18n-format.ts

export function formatNumber(
  num: number | null | undefined,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  if (num == null) return ''
  return new Intl.NumberFormat(locale, options).format(num)
}

export function formatCompactNumber(num: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num)
}
```

### Currency Formatting
```typescript
export function formatCurrency(
  amount: number | null | undefined,
  locale: Locale,
  currency?: string
): string {
  if (amount == null) return ''

  const currencyCode = currency || (locale === 'ar' ? 'SAR' : 'USD')

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
```

### Date Formatting
```typescript
export function formatDate(
  date: Date | string | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...options,
  }).format(dateObj)
}

export function formatDateTime(
  date: Date | string | null | undefined,
  locale: Locale
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateObj)
}

export function formatRelativeTime(
  date: Date | string,
  locale: Locale
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = (dateObj.getTime() - now.getTime()) / 1000

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  // Determine best unit
  const minute = 60
  const hour = minute * 60
  const day = hour * 24
  const week = day * 7
  const month = day * 30
  const year = day * 365

  const absDiff = Math.abs(diffInSeconds)

  if (absDiff < minute) {
    return rtf.format(Math.round(diffInSeconds), 'second')
  } else if (absDiff < hour) {
    return rtf.format(Math.round(diffInSeconds / minute), 'minute')
  } else if (absDiff < day) {
    return rtf.format(Math.round(diffInSeconds / hour), 'hour')
  } else if (absDiff < week) {
    return rtf.format(Math.round(diffInSeconds / day), 'day')
  } else if (absDiff < month) {
    return rtf.format(Math.round(diffInSeconds / week), 'week')
  } else if (absDiff < year) {
    return rtf.format(Math.round(diffInSeconds / month), 'month')
  } else {
    return rtf.format(Math.round(diffInSeconds / year), 'year')
  }
}
```

### List & Percentage Formatting
```typescript
export function formatList(items: string[], locale: Locale): string {
  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(items)
}

export function formatPercentage(
  value: number,
  locale: Locale,
  decimals = 2
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatFileSize(bytes: number, locale: Locale): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${formatNumber(size, locale, { maximumFractionDigits: 1 })} ${units[unitIndex]}`
}
```

---

## 7. Message Helpers

### Validation Helper
```typescript
// helpers/index.ts

export class ValidationHelper {
  constructor(private d: Dictionary) {}

  // Basic validations
  required() {
    return this.d.messages?.validation?.required || 'This field is required'
  }

  email() {
    return this.d.messages?.validation?.email || 'Invalid email address'
  }

  minLength(min: number) {
    const msg = this.d.messages?.validation?.minLength || 'Minimum {min} characters'
    return msg.replace('{min}', String(min))
  }

  maxLength(max: number) {
    const msg = this.d.messages?.validation?.maxLength || 'Maximum {max} characters'
    return msg.replace('{max}', String(max))
  }

  min(min: number) {
    const msg = this.d.messages?.validation?.min || 'Minimum value is {min}'
    return msg.replace('{min}', String(min))
  }

  max(max: number) {
    const msg = this.d.messages?.validation?.max || 'Maximum value is {max}'
    return msg.replace('{max}', String(max))
  }

  positive() {
    return this.d.messages?.validation?.positive || 'Must be a positive number'
  }

  passwordMismatch() {
    return this.d.messages?.validation?.passwordMismatch || 'Passwords do not match'
  }

  // Entity-specific
  title = {
    tooShort: (min: number) => this.minLength(min),
    tooLong: (max: number) => this.maxLength(max),
  }

  subdomain = {
    invalid: () => this.d.messages?.validation?.subdomain?.invalid || 'Invalid subdomain',
    taken: () => this.d.messages?.validation?.subdomain?.taken || 'Subdomain already taken',
  }
}
```

### Toast Helper
```typescript
export class ToastHelper {
  constructor(private d: Dictionary) {}

  success = {
    created: () => this.d.messages?.toast?.success?.created || 'Created successfully',
    updated: () => this.d.messages?.toast?.success?.updated || 'Updated successfully',
    deleted: () => this.d.messages?.toast?.success?.deleted || 'Deleted successfully',
    saved: () => this.d.messages?.toast?.success?.saved || 'Saved successfully',

    // Entity-specific
    studentCreated: () => this.d.messages?.toast?.success?.studentCreated || 'Student created',
    teacherCreated: () => this.d.messages?.toast?.success?.teacherCreated || 'Teacher created',
    invoiceCreated: () => this.d.messages?.toast?.success?.invoiceCreated || 'Invoice created',
  }

  error = {
    createFailed: () => this.d.messages?.toast?.error?.createFailed || 'Failed to create',
    updateFailed: () => this.d.messages?.toast?.error?.updateFailed || 'Failed to update',
    deleteFailed: () => this.d.messages?.toast?.error?.deleteFailed || 'Failed to delete',
    saveFailed: () => this.d.messages?.toast?.error?.saveFailed || 'Failed to save',
  }

  warning = {
    unsavedChanges: () => this.d.messages?.toast?.warning?.unsavedChanges || 'Unsaved changes',
    confirmDelete: () => this.d.messages?.toast?.warning?.confirmDelete || 'Confirm deletion',
  }

  info = {
    loading: () => this.d.messages?.toast?.info?.loading || 'Loading...',
    saving: () => this.d.messages?.toast?.info?.saving || 'Saving...',
    processing: () => this.d.messages?.toast?.info?.processing || 'Processing...',
  }
}
```

### Error Helper
```typescript
export class ErrorHelper {
  constructor(private d: Dictionary) {}

  server = {
    internalError: () => this.d.messages?.error?.server?.internal || 'Internal server error',
    serviceUnavailable: () => this.d.messages?.error?.server?.unavailable || 'Service unavailable',
    timeout: () => this.d.messages?.error?.server?.timeout || 'Request timeout',
  }

  auth = {
    invalidCredentials: () => this.d.messages?.error?.auth?.invalid || 'Invalid credentials',
    sessionExpired: () => this.d.messages?.error?.auth?.expired || 'Session expired',
    unauthorized: () => this.d.messages?.error?.auth?.unauthorized || 'Unauthorized',
    forbidden: () => this.d.messages?.error?.auth?.forbidden || 'Access denied',
  }

  tenant = {
    missingSchoolContext: () => this.d.messages?.error?.tenant?.missing || 'School context required',
    invalidSchool: () => this.d.messages?.error?.tenant?.invalid || 'Invalid school',
  }

  resource = {
    notFound: () => this.d.messages?.error?.resource?.notFound || 'Resource not found',
    alreadyExists: () => this.d.messages?.error?.resource?.exists || 'Already exists',
  }

  file = {
    tooLarge: (max: string) => {
      const msg = this.d.messages?.error?.file?.tooLarge || 'File exceeds {max}'
      return msg.replace('{max}', max)
    },
    invalidType: () => this.d.messages?.error?.file?.invalidType || 'Invalid file type',
  }
}
```

### Helper Factory
```typescript
export function createI18nHelpers(dictionary: Dictionary) {
  return {
    validation: new ValidationHelper(dictionary),
    toast: new ToastHelper(dictionary),
    error: new ErrorHelper(dictionary),
  }
}

// React hook version
export function useI18nMessages(dictionary: Dictionary | null) {
  return useMemo(() => {
    if (!dictionary) return null
    return createI18nHelpers(dictionary)
  }, [dictionary])
}
```

---

## 8. Middleware

### Locale Detection
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

const locales = ['en', 'ar']
const defaultLocale = 'ar'

function getLocale(request: NextRequest): string {
  // 1. Check URL path
  const pathname = request.nextUrl.pathname
  const pathnameLocale = locales.find(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
  if (pathnameLocale) return pathnameLocale

  // 2. Check cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale

  // 3. Negotiate from Accept-Language header
  const headers = { 'accept-language': request.headers.get('accept-language') || '' }
  const languages = new Negotiator({ headers }).languages()

  try {
    return match(languages, locales, defaultLocale)
  } catch {
    return defaultLocale
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if pathname has locale
  const pathnameHasLocale = locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!pathnameHasLocale) {
    const locale = getLocale(request)

    // Redirect to locale-prefixed URL
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`

    const response = NextResponse.redirect(url)

    // Set locale cookie
    response.cookies.set('NEXT_LOCALE', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
    })

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip internal paths
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
```

### Server Action for Locale Switching
```typescript
// actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { i18n, type Locale } from './config'

export async function setLocale(locale: Locale, pathname: string) {
  // Validate locale
  if (!i18n.locales.includes(locale)) {
    throw new Error(`Invalid locale: ${locale}`)
  }

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })

  // Build new URL with locale
  const currentLocale = pathname.split('/')[1]
  const isValidLocale = i18n.locales.includes(currentLocale as Locale)

  const newPathname = isValidLocale
    ? pathname.replace(`/${currentLocale}`, `/${locale}`)
    : `/${locale}${pathname}`

  redirect(newPathname)
}
```

---

## 9. Quality Checklist

### Setup Verification
- [ ] `config.ts` has Locale type and localeConfig
- [ ] `dictionaries.ts` exports getDictionary and route-specific loaders
- [ ] Middleware handles locale detection and redirects
- [ ] Root layout sets `lang` and `dir` attributes on `<html>`
- [ ] Fonts configured for both Arabic (Tajawal) and English (Inter)

### Dictionary Completeness
- [ ] All AR keys have matching EN keys
- [ ] All EN keys have matching AR keys
- [ ] No empty string values
- [ ] Placeholders use consistent format ({name}, {count}, etc.)
- [ ] Dictionary type definition matches JSON structure

### Component Compliance
- [ ] All user-facing text from dictionary (no hardcoded strings)
- [ ] Column definitions use dictionary for headers
- [ ] Form labels and placeholders from dictionary
- [ ] Error messages from ErrorHelper
- [ ] Toast messages from ToastHelper
- [ ] Validation messages from ValidationHelper

### RTL/LTR Layout
- [ ] Using logical properties (ms-*, me-*, ps-*, pe-*)
- [ ] No hardcoded left/right (use start/end)
- [ ] Icons that need flipping use `rtl:rotate-180`
- [ ] Dropdown menus align correctly in RTL
- [ ] Text truncation works in both directions

### Formatting
- [ ] Numbers use Intl.NumberFormat
- [ ] Currencies use formatCurrency()
- [ ] Dates use Intl.DateTimeFormat
- [ ] Relative times use formatRelativeTime()
- [ ] Lists use Intl.ListFormat

### TypeScript
- [ ] No `any` types for dictionary access
- [ ] Dictionary type properly inferred
- [ ] No invalid property access patterns
- [ ] Optional chaining for nested dictionary keys

---

## 10. Common Anti-Patterns

### Dictionary Access
```typescript
// BAD - Hardcoded string
<button>Save</button>

// GOOD - From dictionary
<button>{dictionary.common.save}</button>

// BAD - No null safety
<span>{dictionary.feature.title}</span>

// GOOD - With optional chaining and fallback
<span>{dictionary.feature?.title || 'Title'}</span>
```

### RTL Layout
```typescript
// BAD - Physical properties
<div className="ml-4 mr-2 pl-4 pr-2">

// GOOD - Logical properties
<div className="ms-4 me-2 ps-4 pe-2">

// BAD - Fixed text alignment
<p className="text-left">

// GOOD - Direction-aware alignment
<p className="text-start">
```

### Formatting
```typescript
// BAD - Manual formatting
const price = `$${amount.toFixed(2)}`

// GOOD - Intl formatting
const price = formatCurrency(amount, locale)

// BAD - Manual date formatting
const date = `${d.getMonth()}/${d.getDate()}/${d.getFullYear()}`

// GOOD - Intl formatting
const date = formatDate(d, locale)
```

### Component Props
```typescript
// BAD - Not passing locale context
<ChildComponent />

// GOOD - Passing dictionary and locale
<ChildComponent dictionary={dictionary} locale={locale} />

// BETTER - Using context for deeply nested components
<I18nProvider dictionary={dictionary} locale={locale}>
  <ChildComponent />
</I18nProvider>
```

---

## Invoke When

- Adding new features with user-facing text
- Creating forms with validation messages
- Building tables with column headers
- Implementing toast notifications
- Fixing RTL/LTR layout issues
- Adding new dictionary keys
- Migrating hardcoded strings to dictionary
- Optimizing dictionary bundle size
- Setting up i18n in a new project

**Rule**: Every user-facing string must come from the dictionary. No exceptions.
