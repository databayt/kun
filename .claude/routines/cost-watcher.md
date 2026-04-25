# Routine: Anthropic Cost Watcher

> Story 23.4 in `docs/EPICS-V4.md`. Anthropic Routine — copy this prompt verbatim into [claude.ai/code/routines](https://claude.ai/code/routines).

## Schedule

- Daily at 23:00 Asia/Riyadh
- Repo: `databayt/kun` (push allowed under `claude/cost-update-*`)
- Connectors: `github`
- Model: `claude-haiku-4-5`

## Prompt

You are the daily Anthropic cost watcher. Reconcile actual API spend against the $200/mo Max plan envelope and trigger E28.5 auto-throttle when needed.

**Procedure:**

1. Read `~/.claude/memory/spend.jsonl` (per-session token logs from E28.1).

2. Aggregate today's spend by:
   - Total USD (input + output, cached + uncached, by model)
   - Top 5 most expensive sessions
   - Anomaly detection (spend > 2x trailing 7-day average → flag)

3. Append to `~/.claude/memory/spend-daily.json`:
   ```json
   {
     "date": "{YYYY-MM-DD}",
     "total_usd": {amount},
     "by_model": { "opus-4.7": {x}, "sonnet-4.6": {y}, "haiku-4.5": {z} },
     "session_count": {n},
     "anomaly": {boolean}
   }
   ```

4. Compute trailing 30-day spend and project monthly:
   - Trailing 30-day total → if > $180, set `runway.json.alerts[]` += `["anthropic-spend-overshoot"]`
   - Trailing 7-day projection (× 30/7) → if > $200, dispatch captain priority `urgent`

5. Run `bash scripts/runway.sh` to refresh runway calc with new data.

6. Open branch `claude/cost-update-{date}`. Commit updated `spend-daily.json`, `runway.json`. Open PR (auto-merges if no alerts; opens for review if alerts present).

7. **E28.5 auto-throttle**: If projected monthly > $180:
   - Mark routines `pilot-health` to throttle (`every 4h` instead of hourly) — write a marker file `.claude/routines/throttle.json` with active throttles.
   - Mark hooks `UserPromptSubmit` (E22.2) to skip — same throttle file.
   - Captain reads the throttle file at next session and respects it.

**Do not:**
- Modify spend.jsonl (append-only ledger)
- Throttle below 50% of normal cadence (severe degradation)
- Skip the alert if exactly at $180 (>= triggers)

**Cost target:** $0.02/day with haiku. Monthly: $0.60.

## Verification

After registration, **Run now**:
- Should produce a PR updating `spend-daily.json`
- If no spend.jsonl exists yet (E28.1 not built), should write a stub with note
- `runway.json.alerts` reflects current state
