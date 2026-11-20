import { describe, expect, it } from "vitest";
import { RECEIPT_MARKER, receiptSchema } from "./contract";
import {
  claimRefusal, formatReceipt, normalizeRef, orderTasks, parseKunBlock, parseLabels, receiptRefusal, wipLimitFor,
} from "./tasks";
import type { RawTask } from "./tasks";

const raw = (o: Partial<RawTask> & { id: string }): RawTask => ({
  repo: "kun", number: 1, title: "t", url: "", department: "sales", status: "todo", holder: null,
  priority: null, sprint: null, auto: false, kun: { repos: [], items: [], after: [], driver: null }, afterOpen: [], body: "",
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
    expect(parseKunBlock(null, "kun")).toEqual({ repos: [], items: [], after: [], driver: null });
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
      department: "sales", status: "in-progress", holder: "moed", priority: 1, wip: 2, auto: false,
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
