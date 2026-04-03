# SaaS Feature Generator (Deprecated)

**Use the feature pipeline instead.** This command has been replaced by structured pipeline stages.

## Migration

| Old | New |
|-----|-----|
| `/saas billing` | `/feature billing` (full pipeline) |
| Schema only | `/schema billing` |
| Actions only | `/code billing` |
| UI only | `/wire billing` |

## Argument: $ARGUMENTS

If called, delegate to `/feature $ARGUMENTS`.
