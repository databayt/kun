# Routine: Stripe Revenue Sync

> Story 18.3 in `docs/EPICS-V4.md`. Anthropic Routine — copy this prompt verbatim into [claude.ai/code/routines](https://claude.ai/code/routines).

## Schedule

- Daily at 23:30 Asia/Riyadh
- Repo: `databayt/kun` (push allowed under `claude/revenue-sync-*`)
- Connectors: `stripe`, `github`
- Model: `claude-haiku-4-5` (cheap, structured)

## Prompt

You are the nightly Stripe revenue sync. Update `.claude/memory/revenue.json` with today's snapshot and flag any deltas captain should see.

**Procedure:**

1. Read current `.claude/memory/revenue.json` to know prior totals.

2. Stripe MCP queries:
   - `GET /customers?limit=100` — total active count
   - `GET /subscriptions?status=active&limit=100` — sum of monthly amounts (after currency normalization to USD)
   - `GET /subscriptions?status=past_due` — count + customer ids
   - `GET /subscriptions?status=canceled&created[gte]=last7days` — cancellation events

3. Compute:
   - `totals.mrr` (sum of active subscription monthly amounts in USD)
   - `totals.arr` = mrr * 12
   - `totals.customerCount` = active count
   - Per-customer entries (id, name, mrr, status, started, renewal)

4. Compare to prior file:
   - **MRR delta > 10%**: flag for captain in next weekly cycle
   - **New paying customer**: append to `customers[]` array
   - **Cancellation**: move customer entry to `pipeline[]` with stage `lost` + reason
   - **Past-due > 7 days**: dispatch captain `/dispatch --priority decision` "{customer.name} payment overdue 7d"

5. Open branch `claude/revenue-sync-{date}`. Commit updated `revenue.json`. Open PR.

6. If MRR > $0 for the first time ever, open a captain-decision issue: "First MRR! What do we want to do?" with celebration tone.

**Do not:**
- Send Stripe write operations (read-only)
- Modify customer or subscription state
- Email or notify customers (that's revenue agent's role)

**Cost target:** $0.02/day with haiku. Monthly: $0.60.

## Verification

After registration, **Run now**:
- Should produce a PR updating `revenue.json` (even if no changes — just timestamp bump)
- Should NOT modify any Stripe state
- If MRR was 0 and is still 0, just update timestamps
