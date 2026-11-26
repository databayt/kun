#!/usr/bin/env node
// combos.mjs — build kun's model classes as OmniRoute combos from providers.json.
//
//   node combos.mjs            create/replace every combo in providers.json `combos`
//   node combos.mjs --dry-run  print what each combo would hold
//
// A combo is one class of work (code, fast, vision, long, thrifty). Its
// members are the `roles[<role>]` models of every enabled provider that is CONNECTED in
// OmniRoute in providers.json order — so the catalog
// order is the quality ranking. Strategy `priority`: the first healthy member serves; when it
// is exhausted, rate-limited or failing, OmniRoute moves to the next ("when one finishes, go to
// the next"). Paid providers join only combos with `paid: true` and only when `enabled`.
// Re-run after connecting a provider (Machine → Providers does) or re-ranking the catalog.
import { api, catalog, connections, keychain } from "./omni.mjs";

const dry = process.argv.includes("--dry-run");
const BASE = process.env.OMNIROUTE_URL || "http://127.0.0.1:20128";

async function listedModels() {
  const key = keychain("OMNIROUTE_API_KEY");
  const r = await fetch(`${BASE}/v1/models`, { headers: { authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`/v1/models ${r.status}`);
  return new Set((await r.json()).data.map((m) => m.id));
}

async function main() {
  const cat = catalog();
  const conns = (await connections()) || [];
  const listed = await listedModels();
  const connected = (p) => conns.some?.((c) => c.name === `kun-${p.id}` && (c.isActive ?? c.active ?? true));
  const existing = await api("GET", "/api/combos").catch(() => ({}));
  const have = existing?.combos || existing?.data || (Array.isArray(existing) ? existing : []);
  const report = {};

  for (const [name, spec] of Object.entries(cat.combos).filter(([n]) => !n.startsWith("$"))) {
    const members = [];
    for (const p of cat.providers) {
      if (!p.enabled || p.via !== "omniroute" || !p.omniroute || !connected(p)) continue;
      if (p.tier === "paid" && !spec.paid) continue;
      for (const m of p.roles?.[spec.role] || []) {
        const id = `${p.omniroute}/${m}`;
        if (!listed.has(id)) console.error(`combos: ${id} is not in /v1/models — kept; OmniRoute skips it if it fails`);
        if (!members.includes(id)) members.push(id);
      }
    }
    report[name] = members;
    if (dry || !members.length) continue;
    const old = have.find?.((c) => c.name === name);
    if (old) await api("DELETE", `/api/combos/${encodeURIComponent(old.id)}`).catch(() => {});
    await api("POST", "/api/combos", { name, strategy: spec.strategy || "priority", enabled: true, models: members, config: {} });
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(`combos: ${e.message || e}`);
  process.exit(1);
});
