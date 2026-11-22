import { describe, expect, it } from "vitest";
import { RECEIPT_MARKER, receiptSchema, uploadSchema } from "./contract";
import {
  claimRefusal, formatReceipt, normalizeRef, orderTasks, parseKunBlock, parseLabels, receiptRefusal, sanitizeFileName, uploadKey, wipLimitFor,
} from "./tasks";
import { presignUploads } from "./upload";
import type { RawTask } from "./tasks";

const noKun = { repos: [], items: [], after: [], driver: null, film: null, formula: null, weight: null };
const raw = (o: Partial<RawTask> & { id: string }): RawTask => ({
  repo: "kun", number: 1, title: "t", url: "", department: "sales", status: "todo", holder: null, assignee: null,
  priority: null, sprint: null, auto: false, kun: { ...noKun }, afterOpen: [], body: "",
  updatedAt: "", createdAt: "2026-01-01", sprintDue: null, ...o,
});

describe("parseKunBlock", () => {
  it("parses repos, items and after (bare refs resolve to the own repo)", () => {
    const b = parseKunBlock(
      "text\n<!-- kun: repos=hogwarts,kun; items=skill:proposal,skill:pricing; after=hogwarts#40,#41,#41,bad -->",
      "mkan",
    );
    expect(b.repos).toEqual(["hogwarts", "kun"]);
    expect(b.items).toEqual(["skill:proposal", "skill:pricing"]);
    expect(b.after).toEqual(["databayt/hogwarts#40", "databayt/mkan#41"]);
  });
  it("returns empty for no block or null body", () => {
    expect(parseKunBlock(null, "kun")).toEqual(noKun);
    expect(parseKunBlock("nothing", "kun").after).toEqual([]);
  });
  it("normalizes full refs", () => {
    expect(normalizeRef("databayt/Kun#5", "x")).toBe("databayt/kun#5");
    expect(normalizeRef("nope", "x")).toBeNull();
  });
});

describe("parseLabels", () => {
  it("reads dept, status, holder, priority and wip", () => {
    expect(parseLabels(["dept:sales", "holder:moed", "status:in-progress", "P1", "wip:2", "bug"])).toEqual({
      department: "sales", status: "in-progress", holder: "moed", assignee: null, priority: 1, wip: 2, auto: false,
    });
  });
  it("reads run:auto", () => {
    expect(parseLabels(["run:auto"]).auto).toBe(true);
    expect(parseLabels(["run:manual"]).auto).toBe(false);
  });
  it("ignores unknown departments; in-progress beats review", () => {
    const l = parseLabels(["dept:nope", "status:review", "status:in-progress"]);
    expect(l.department).toBeNull();
    expect(l.status).toBe("in-progress");
  });
  it("wip limit defaults to 1 and takes the max label", () => {
    expect(wipLimitFor([["x"]])).toBe(1);
    expect(wipLimitFor([["wip:3"], ["wip:2"]])).toBe(3);
  });
});

describe("orderTasks", () => {
  it("orders priority → sprint (current first) → age", () => {
    const out = orderTasks([
      raw({ id: "a", priority: 1 }), // no sprint: after sprinted P1s
      raw({ id: "b", sprint: "S2", sprintDue: "2026-12-01", priority: 0 }),
      raw({ id: "c", sprint: "S1", sprintDue: "2026-11-01", priority: 2 }),
      raw({ id: "d", sprint: "S1", sprintDue: "2026-11-01", priority: 1, afterOpen: ["x"] }),
      raw({ id: "e", sprint: "S1", sprintDue: "2026-11-01", priority: 1, createdAt: "2026-02-01" }),
      raw({ id: "f", sprint: "S1", sprintDue: "2026-11-01", priority: 1, createdAt: "2026-01-15" }),
      raw({ id: "g", sprint: "S2", sprintDue: "2026-12-01", priority: 1, createdAt: "2025-01-01" }),
      raw({ id: "h" }), // no priority: last
    ]);
    // P0 b; P1: current sprint S1 by age (d 01-01, f 01-15, e 02-01), S2 g, none a; P2 c; none h.
    expect(out.map((t) => t.id)).toEqual(["b", "d", "f", "e", "g", "a", "c", "h"]);
    expect(out.map((t) => t.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("kun block driver", () => {
  it("reads a known driver, ignores an unknown one", () => {
    expect(parseKunBlock("<!-- kun: driver=Codex -->", "kun").driver).toBe("codex");
    expect(parseKunBlock("<!-- kun: driver=agy; repos=kun -->", "kun").driver).toBe("agy");
    expect(parseKunBlock("<!-- kun: driver=gpt9 -->", "kun").driver).toBeNull();
    expect(parseKunBlock("<!-- kun: repos=kun -->", "kun").driver).toBeNull();
  });
});

describe("receipt", () => {
  const ok = { id: "databayt/kun#1", driver: "claude", model: "opus", durationMs: 90_000, commits: ["abc123"], artifacts: [], summary: "did it" };
  it("accepts a valid receipt and optional next", () => {
    expect(receiptSchema.safeParse(ok).success).toBe(true);
    expect(receiptSchema.safeParse({ ...ok, next: "ship" }).success).toBe(true);
  });
  it("rejects a bad id, an unknown driver, a negative duration, an empty or oversized summary", () => {
    expect(receiptSchema.safeParse({ ...ok, id: "kun#1" }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, driver: "gpt" }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, durationMs: -1 }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, summary: "  " }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, summary: "x".repeat(4001) }).success).toBe(false);
  });
  it("refuses unless the caller holds the task", () => {
    expect(receiptRefusal(null, "moed")?.error).toBe("not-found");
    expect(receiptRefusal({ holder: null, status: "todo" }, "moed")?.error).toBe("held");
    expect(receiptRefusal({ holder: "ali", status: "in-progress" }, "moed")?.error).toBe("held");
    expect(receiptRefusal({ holder: "moed", status: "done" }, "moed")?.error).toBe("held");
    expect(receiptRefusal({ holder: "moed", status: "in-progress" }, "moed")).toBeNull();
  });
  it("formats a comment that starts with the marker", () => {
    const text = formatReceipt(receiptSchema.parse({ ...ok, next: "ship" }), "moed");
    expect(text.startsWith(RECEIPT_MARKER)).toBe(true);
    expect(text).toContain("Duration: 1m 30s");
    expect(text).toContain("- abc123");
    expect(text).toContain("**Next**\nship");
  });
});

describe("claimRefusal", () => {
  const base = {
    task: { holder: null, status: "todo" as const, afterOpen: [], department: "sales" as const },
    login: "moed", departments: ["sales", "video"] as ("sales" | "video")[], inProgress: 0, wipLimit: 1,
  };
  it("allows a free, unblocked task in profile", () => expect(claimRefusal(base)).toBeNull());
  it("refuses a department outside the profile", () =>
    expect(claimRefusal({ ...base, task: { ...base.task, department: "tech" } })?.error).toBe("department"));
  it("refuses held by someone else", () =>
    expect(claimRefusal({ ...base, task: { ...base.task, holder: "abdout" } })?.error).toBe("held"));
  it("refuses blocked", () =>
    expect(claimRefusal({ ...base, task: { ...base.task, afterOpen: ["databayt/kun#1"] } })?.error).toBe("blocked"));
  it("refuses over the WIP limit, allows under a raised one", () => {
    expect(claimRefusal({ ...base, inProgress: 1 })?.error).toBe("wip");
    expect(claimRefusal({ ...base, inProgress: 1, wipLimit: 2 })).toBeNull();
  });
});

describe("claimRefusal doctor", () => {
  const base = {
    task: { holder: null, status: "todo" as const, afterOpen: [], department: "sales" as const },
    login: "moed", departments: ["sales"] as "sales"[], inProgress: 0, wipLimit: 1,
    now: new Date("2026-11-22T12:00:00Z"),
  };
  const readiness = (gate?: { pass: boolean; level?: "green" | "orange" | "red"; failing: string[]; at: string }) => ({
    percent: 80, failing: [], catalogVersion: 5, ...(gate ? { gate } : {}),
  });
  it("refuses a failing gate and names the steps", () => {
    const r = claimRefusal({ ...base, readiness: readiness({ pass: false, failing: ["launcher.c", "pack.sales"], at: "2026-11-22T11:00:00Z" }) });
    expect(r?.error).toBe("doctor");
    expect(r?.detail).toContain("launcher.c");
    expect(r?.detail).toContain("pack.sales");
  });
  it("refuses a stale verdict even when it passed", () => {
    const r = claimRefusal({ ...base, readiness: readiness({ pass: true, failing: [], at: "2026-11-20T11:00:00Z" }) });
    expect(r?.error).toBe("doctor");
    expect(r?.detail).toContain("48 h");
  });
  it("allows a fresh passing gate", () =>
    expect(claimRefusal({ ...base, readiness: readiness({ pass: true, failing: [], at: "2026-11-22T11:00:00Z" }) })).toBeNull());
  it("refuses a red level and names the core steps", () => {
    const r = claimRefusal({ ...base, readiness: readiness({ pass: false, level: "red", failing: ["engine.rules"], at: "2026-11-22T11:00:00Z" }) });
    expect(r?.error).toBe("doctor");
    expect(r?.detail).toContain("core");
    expect(r?.detail).toContain("engine.rules");
  });
  it("allows orange (extras missing) while fresh, refuses it once stale", () => {
    expect(claimRefusal({ ...base, readiness: readiness({ pass: true, level: "orange", failing: ["github.ssh"], at: "2026-11-22T11:00:00Z" }) })).toBeNull();
    const r = claimRefusal({ ...base, readiness: readiness({ pass: true, level: "orange", failing: ["github.ssh"], at: "2026-11-20T11:00:00Z" }) });
    expect(r?.detail).toContain("48 h");
  });
  it("allows a green level", () =>
    expect(claimRefusal({ ...base, readiness: readiness({ pass: true, level: "green", failing: [], at: "2026-11-22T11:00:00Z" }) })).toBeNull());
  it("allows an absent gate, an absent readiness or a garbled one (old apps are not locked out)", () => {
    expect(claimRefusal({ ...base, readiness: readiness() })).toBeNull();
    expect(claimRefusal({ ...base, readiness: null })).toBeNull();
    expect(claimRefusal({ ...base })).toBeNull();
    expect(claimRefusal({ ...base, readiness: { nope: 1 } })).toBeNull();
  });
  it("still reports a department refusal before the doctor", () => {
    const r = claimRefusal({ ...base, task: { ...base.task, department: "tech" }, readiness: readiness({ pass: false, failing: ["x"], at: "2026-11-22T11:00:00Z" }) });
    expect(r?.error).toBe("department");
  });
});

describe("work orders", () => {
  it("reads film, formula and weight from the kun block", () => {
    const b = parseKunBlock("<!-- kun: repos=hogwarts; items=skill:blender; after=#4; film=hogwarts-intro-introduction-v001; formula=video.order.blender; weight=5 -->", "hogwarts");
    expect(b.film).toBe("hogwarts-intro-introduction-v001");
    expect(b.formula).toBe("video.order.blender");
    expect(b.weight).toBe(5);
    expect(parseKunBlock("<!-- kun: weight=abc -->", "kun").weight).toBeNull();
  });
  it("reads for:<login> as the assignee", () => {
    expect(parseLabels(["dept:video", "for:Sedon"]).assignee).toBe("sedon");
  });
  it("lets the assignee claim outside his departments and refuses everyone else", () => {
    const base = {
      task: { holder: null, status: "todo" as const, afterOpen: [], department: "video" as const, assignee: "sedon" },
      login: "sedon", departments: ["tech", "support"] as ("tech" | "support")[], inProgress: 0, wipLimit: 1,
    };
    expect(claimRefusal(base)).toBeNull();
    const other = claimRefusal({ ...base, login: "ali", departments: ["video"] });
    expect(other?.error).toBe("held");
    expect(other?.detail).toContain("sedon");
  });
  it("prints the new receipt lines", () => {
    const hash = "a".repeat(64);
    const r = receiptSchema.parse({
      id: "databayt/kun#1", driver: "claude", model: "opus", durationMs: 1000, commits: [],
      artifacts: ["https://cdn.databayt.org/work/f/1/a.blend"], summary: "ok", formula: "video.order.blender", stage: "visual", hashes: [hash],
    });
    const t = formatReceipt(r, "sedon");
    expect(t).toContain("Formula: video.order.blender · Stage: visual");
    expect(t).toContain(`${hash}  https://cdn.databayt.org/work/f/1/a.blend`);
  });
  it("rejects hashes that do not match artifacts or are not sha256 hex", () => {
    const ok = { id: "databayt/kun#1", driver: "claude", model: "o", durationMs: 0, commits: [], artifacts: ["a", "b"], summary: "s" };
    expect(receiptSchema.safeParse({ ...ok, hashes: ["a".repeat(64)] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, hashes: ["zz", "zz"] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, hashes: ["a".repeat(64), "b".repeat(64)] }).success).toBe(true);
  });
});

describe("upload", () => {
  const task = { repo: "hogwarts", number: 42, kun: { ...noKun, film: "hogwarts-intro-introduction-v001" } };
  it("sanitises file names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\x\\scene one.blend")).toBe("scene one.blend");
    expect(sanitizeFileName("a\u0000b\n.mp4")).toBe("ab.mp4");
    expect(sanitizeFileName("..")).toBeNull();
    expect(sanitizeFileName("   ")).toBeNull();
    expect(sanitizeFileName("dir/")).toBeNull();
  });
  it("builds work/<film>/<issue>/<file>, falling back to the repo name", () => {
    expect(uploadKey(task, "a/b/classroom.blend")).toBe("work/hogwarts-intro-introduction-v001/42/classroom.blend");
    expect(uploadKey({ ...task, kun: noKun }, "x.png")).toBe("work/hogwarts/42/x.png");
  });
  it("enforces the schema bounds", () => {
    const f = { name: "a.mp4", size: 10, contentType: "video/mp4" };
    const id = "databayt/kun#1";
    expect(uploadSchema.safeParse({ id, files: [f] }).success).toBe(true);
    expect(uploadSchema.safeParse({ id, files: [] }).success).toBe(false);
    expect(uploadSchema.safeParse({ id, files: Array(21).fill(f) }).success).toBe(false);
    expect(uploadSchema.safeParse({ id, files: [{ ...f, size: 2 * 1024 ** 3 + 1 }] }).success).toBe(false);
    expect(uploadSchema.safeParse({ id, files: [{ ...f, size: 2 * 1024 ** 3 }] }).success).toBe(true);
    expect(uploadSchema.safeParse({ id: "kun#1", files: [f] }).success).toBe(false);
  });
  it("presigns through an injected signer and builds the public url", async () => {
    const calls: string[] = [];
    const out = await presignUploads(task, [{ name: "a.mp4", size: 1, contentType: "video/mp4" }], async (k, ct) => (calls.push(`${k}|${ct}`), `https://signed/${k}`));
    expect(calls).toEqual(["work/hogwarts-intro-introduction-v001/42/a.mp4|video/mp4"]);
    expect(out?.[0].publicUrl).toBe("https://cdn.databayt.org/work/hogwarts-intro-introduction-v001/42/a.mp4");
    expect(out?.[0].putUrl).toContain("https://signed/");
    expect(await presignUploads(task, [{ name: "..", size: 1, contentType: "x/y" }], async () => "u")).toBeNull();
  });
});
