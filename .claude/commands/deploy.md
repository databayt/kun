# Vercel Deploy Command

Deploy to Vercel with automatic error detection and fixing until deployment succeeds.

## Usage
- `/deploy` - Deploy to production and watch until success
- `/deploy preview` - Deploy to preview environment
- `/deploy logs` - Fetch and analyze recent deployment logs
- `/deploy status` - Check current deployment status

## Argument: $ARGUMENTS

## Instructions

Execute deployment workflow based on the argument:

### If argument is "logs":
1. List recent deployments: `npx vercel list --yes`
2. Identify failed deployments (status: Error)
3. Inspect the most recent failed deployment
4. Fetch and analyze build logs
5. Report error summary with root cause analysis

### If argument is "status":
1. List deployments: `npx vercel list --yes`
2. Show status of last 5 deployments
3. Report current production state

### If argument is "preview" or empty/production:
Execute the full deployment loop:

#### Phase 1: Pre-Deployment Validation
1. **Git Status Check**
   - Check for uncommitted changes
   - Ensure branch is up to date with remote

2. **Local Build Test** (if not recently built)
   - Run `pnpm tsc --noEmit`
   - Run `pnpm build` to verify build passes locally
   - Fix any errors before deploying

#### Phase 2: Deploy
1. **Trigger Deployment**
   - For production: `npx vercel --prod --yes`
   - For preview: `npx vercel --yes`

2. **Monitor Deployment**
   - Track deployment progress in real-time
   - Capture deployment URL and ID

#### Phase 3: Watch and Validate
1. **Check Deployment Status**
   - Poll `npx vercel inspect <deployment-url>` every 30 seconds
   - Wait for status to be "Ready" or "Error"

2. **If Status is "Error":**
   - Fetch deployment logs: `npx vercel inspect <url> --logs`
   - Analyze error messages
   - Identify root cause:
     - Build errors: TypeScript, module resolution
     - Runtime errors: Missing env vars, API failures
     - Configuration errors: vercel.json, next.config issues
   - Apply fixes automatically where possible
   - Commit and push fixes
   - Trigger new deployment
   - Repeat until success (max 5 attempts)

3. **If Status is "Ready":**
   - Report success with deployment URLs
   - List all aliases (production domains)

### Common Vercel Errors and Fixes:
- **TypeScript errors**: Fix types, update tsconfig.json excludes
- **Module not found**: Check imports, add missing dependencies
- **Build timeout**: Optimize build, split large components
- **Memory exceeded**: Reduce bundle size, lazy load components
- **Env var missing**: Check Vercel environment variables
- **Prisma errors**: Ensure prisma generate runs in build

### Success Criteria:
- Deployment status: Ready
- All aliases assigned
- No runtime errors in first 30 seconds

### Output:
Report final deployment with:
- Deployment URL
- Production aliases
- Build duration
- Any warnings to monitor
