# Smart Build Command

Run intelligent build with automatic error detection and fixing.

## Usage
- `/build` - Standard build (TypeScript check + production build)
- `/build recent` - Quick build for recent changes only
- `/build full` - Full build with all validations and analysis

## Argument: $ARGUMENTS

## Instructions

Execute the appropriate build variant based on the argument:

### If argument is "recent" or empty:
1. **Pre-flight Check** (5s)
   - Run `pnpm tsc --noEmit` to check TypeScript errors
   - If errors found, analyze and fix them automatically
   - Re-run TypeScript check after fixes

2. **Production Build** (30-60s)
   - Run `pnpm build`
   - Monitor for errors in real-time
   - If build fails, analyze error output and fix issues

3. **Post-Build Validation**
   - Verify build completed successfully
   - Report any warnings

### If argument is "full":
1. **Comprehensive Pre-Build Validation** (15s)
   - TypeScript compilation check (`pnpm tsc --noEmit`)
   - Prisma client sync check (`pnpm prisma generate`)
   - ESLint validation (`pnpm lint`)
   - Error pattern detection (dictionary, Prisma, enum errors)

2. **Execute Production Build** (30-90s)
   - Run `pnpm build` with full output
   - Track build time and performance

3. **Post-Build Analysis** (5s)
   - Bundle size analysis
   - Route-level performance metrics
   - Build warnings summary

4. **Recommendations**
   - Code-splitting opportunities
   - Bundle optimization suggestions
   - Caching improvements

### Error Handling Loop:
If any step fails:
1. Parse error messages to identify root cause
2. Apply automatic fixes where possible:
   - TypeScript errors: Fix type issues, missing imports, enum values
   - Prisma errors: Regenerate client, fix schema mismatches
   - Build errors: Fix module resolution, missing dependencies
3. Re-run the failed step
4. Repeat until success or max 5 attempts

### Success Criteria:
- TypeScript: 0 errors
- Build: Compiled successfully
- No blocking warnings

Report final status with:
- Build time
- Bundle sizes (if full)
- Any remaining warnings
