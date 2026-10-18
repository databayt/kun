import { describe, expect, it } from "vitest";
import {
  dueSlots,
  findSlot,
  hasPlan,
  planFor,
  slotKey,
} from "@/components/root/social/plan";

describe("plan", () => {
  it("dates week 1 slot 1 on the start Monday and runs one a day", () => {
    const plan = planFor("balqalam");
    expect(plan[0]).toMatchObject({ key: "balqalam#001", date: "2026-10-19" });
    const w2s1 = plan.find((s) => s.week === 2 && s.slot === 1);
    expect(w2s1?.date).toBe("2026-10-26");
    const w1s7 = plan.find((s) => s.week === 1 && s.slot === 7);
    expect(w1s7?.date).toBe("2026-10-25");
  });

  it("keys match the queue loader's slot column", () => {
    expect(slotKey("balqalam", 12)).toBe("balqalam#012");
    expect(findSlot("balqalam#012")?.seq).toBe(12);
    expect(findSlot("balqalam#999")).toBeNull();
  });

  it("brands without a plan return nothing", () => {
    expect(hasPlan("mkan")).toBe(false);
    expect(planFor("mkan")).toEqual([]);
  });

  it("due slots are the overdue ones plus a rolling seven days", () => {
    const sunday = dueSlots("balqalam", new Date("2026-10-18T12:00:00Z"));
    expect(sunday.map((s) => s.date)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    const later = dueSlots("balqalam", new Date("2026-10-21T12:00:00Z"));
    expect(later.every((s) => s.date <= "2026-10-28")).toBe(true);
    expect(later).toHaveLength(10);
  });
});
