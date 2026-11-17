import { describe, expect, it } from "vitest";
import { claimRefusal, normalizeRef, orderTasks, parseKunBlock, parseLabels, wipLimitFor } from "./tasks";
import type { RawTask } from "./tasks";

const raw = (o: Partial<RawTask> & { id: string }): RawTask => ({
  repo: "kun", number: 1, title: "t", url: "", department: "sales", status: "todo", holder: null,
  priority: null, sprint: null, kun: { repos: [], items: [], after: [] }, afterOpen: [], body: "",
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
    expect(parseKunBlock(null, "kun")).toEqual({ repos: [], items: [], after: [] });
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
      department: "sales", status: "in-progress", holder: "moed", priority: 1, wip: 2,
    });
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
  it("orders sprint → priority → unblocked → age", () => {
    const out = orderTasks([
      raw({ id: "a", priority: 0 }), // no sprint: last despite P0
      raw({ id: "b", sprint: "S2", sprintDue: "2026-12-01", priority: 0 }),
      raw({ id: "c", sprint: "S1", sprintDue: "2026-11-01", priority: 2 }),
      raw({ id: "d", sprint: "S1", sprintDue: "2026-11-01", priority: 1, afterOpen: ["x"] }),
      raw({ id: "e", sprint: "S1", sprintDue: "2026-11-01", priority: 1, createdAt: "2026-02-01" }),
      raw({ id: "f", sprint: "S1", sprintDue: "2026-11-01", priority: 1, createdAt: "2026-01-15" }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["f", "e", "d", "c", "b", "a"]);
    expect(out.map((t) => t.order)).toEqual([0, 1, 2, 3, 4, 5]);
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
