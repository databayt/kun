# TypeScript — Full Coverage Strict Mode Sweep

Sweep every file for TypeScript anti-patterns: `any` types, `ts-ignore`, non-null assertions, unsafe casts, missing return types.

## Usage

- `typescript` — sweep ALL files in current product
- `typescript admission` — sweep only the admission block
- `typescript --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `typescript` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **`: any`** → replace with proper type or `unknown`
2. **`as any`** → use type guard or proper assertion
3. **`@ts-ignore`** → fix the type error or use `@ts-expect-error` with explanation
4. **`@ts-expect-error` without explanation** → add explanation comment
5. **`!.` non-null assertion** → use optional chaining `?.` or proper null check
6. **`Object` type** → use `Record<string, T>` or specific interface
7. **`Function` type** → use specific function type `() => void`

### Mode: Fix

This keyword finds AND fixes type issues. After each module, run `pnpm tsc --noEmit` to verify the fix didn't break types elsewhere.

### Important

- When replacing `any`, look at how the value is used downstream to determine the correct type
- Prefer `unknown` + type guard over `any` when the type truly varies
- For third-party library types, use the library's exported types
- Don't add return types to internal/unexported functions (TypeScript infers them)
- DO add return types to exported functions (API contract)
