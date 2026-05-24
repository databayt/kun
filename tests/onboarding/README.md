# Onboarding test suite

Validates the kun onboarding wizard + doc — installer scripts, the step manifest, and `content/docs/onboarding.mdx`.

## Run

```bash
bash tests/onboarding/run.sh                # all suites
bash tests/onboarding/run.sh lint           # just lint
bash tests/onboarding/run.sh behavior parity
```

Exits 0 on full pass, 1 on any failure.

## Suites

| Suite | What it asserts |
|---|---|
| `lint` | `shellcheck` clean on `.sh` installers · `wizard-steps.json` parses · doc ≤300 lines · no stale Tailscale/Apple Notes references |
| `behavior` | `state_get`/`state_set` round-trips · git-config autofill · `mcp.json` → role mapping · `BACKEND_ARGS` shape |
| `parity` | All three installers expose the same flags · parallel final-panel bullets · matching state-file schema |
| `links` | Every `/docs/<x>` link in `onboarding.mdx` resolves to a real file · anchor targets exist when used |

## Dependencies

- `bash` 4+ (for `mapfile`)
- `shellcheck` (`brew install shellcheck`)
- `python3` (ships with macOS)
- `node` (already required by the kun app)

No npm packages; no test framework. The suite is self-contained.

## Add a test

Drop a new `<name>.test.sh` file in this directory. The orchestrator auto-discovers it. Skeleton:

```bash
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
suite_name "my new suite"

assert_eq "expected" "$(some-command)" "some-command returns expected"

suite_summary
```

See `lib.sh` for the full assertion API.
