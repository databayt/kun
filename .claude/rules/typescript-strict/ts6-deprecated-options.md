---
domain: typescript-strict
severity: error
paths: ["tsconfig.json", "**/tsconfig*.json"]
since: "TypeScript 6.0"
---

# No TypeScript 6-deprecated compiler options — they error in 6.0 and are gone in 7.0

TypeScript 6.0 turned legacy options into errors that only `"ignoreDeprecations": "6.0"` silences, and 7.0 — npm's `latest` since the native release — removes them outright. The ones older templates and agents still emit: `baseUrl` (no longer a resolution root), `moduleResolution: "node"`/`"node10"`/`"classic"`, `target: "es5"` with `downlevelIteration`, `module: "amd" | "umd" | "system"`, `outFile`, `esModuleInterop: false`, and `import … assert {}`. 6.0 also flips defaults — `strict: true`, `types: []` (ambient `@types/*` stop loading unless listed), `rootDir: "."`, `noUncheckedSideEffectImports: true`. Write `paths` targets with a `./` prefix, keep `moduleResolution: "bundler"`, and never add `ignoreDeprecations`: it defers the break to the TS 7 bump. A bare `pnpm add -D typescript` now installs 7, so keep an explicit `^6` or `^5.9` range until that bump is decided.

## Good

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] },
  },
}
```

## Bad

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".", // error in 6.0, removed in 7.0
    "moduleResolution": "node", // node10: deprecated
    "paths": { "@/*": ["src/*"] }, // resolved against baseUrl
    "ignoreDeprecations": "6.0", // hides the error until TS 7 breaks the build
  },
}
```

## Fix

Delete `baseUrl` and prefix every `paths` target with `./`, switch to `moduleResolution: "bundler"`, list needed ambient packages in `types` if they stop resolving, and remove `ignoreDeprecations`.

> Source: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ · https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
