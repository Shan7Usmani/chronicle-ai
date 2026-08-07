import { describe, it, expect } from "vitest";
import { buildSchedule, getNextPendingSlot, isDueSlot } from "@/lib/schedule";

describe("buildSchedule", () => {
  it("seeds 12-14 slots across a 48h window", () => {
    const schedule = buildSchedule("abc-123", Date.parse("2026-08-07T00:00:00Z"));
    expect(schedule.length).toBeGreaterThanOrEqual(12);
    expect(schedule.length).toBeLessThanOrEqual(14);
    expect(schedule.every((s) => s.state === "pending")).toBe(true);
  });

  it("keeps a minimum 90-minute gap between slots", () => {
    const fromMs = Date.parse("2026-08-07T00:00:00Z");
    const schedule = buildSchedule("abc-123", fromMs);
    for (let i = 1; i < schedule.length; i++) {
      const gap = Date.parse(schedule[i].at) - Date.parse(schedule[i - 1].at);
      expect(gap).toBeGreaterThanOrEqual(90 * 60 * 1000);
    }
  });

  it("spreads the last slot within the 48h window", () => {
    const fromMs = Date.parse("2026-08-07T00:00:00Z");
    const schedule = buildSchedule("def-456", fromMs);
    const last = Date.parse(schedule[schedule.length - 1].at);
    expect(last).toBeLessThanOrEqual(fromMs + 48 * 60 * 60 * 1000);
  });

  it("is deterministic per agentId", () => {
    const a = buildSchedule("agent-x", Date.parse("2026-08-07T00:00:00Z"));
    const b = buildSchedule("agent-x", Date.parse("2026-08-07T00:00:00Z"));
    expect(a).toEqual(b);
  });
});

describe("getNextPendingSlot / isDueSlot", () => {
  it("returns the first pending slot at or before now", () => {
    const schedule = buildSchedule("abc", Date.now() - 60 * 60 * 1000);
    const slot = getNextPendingSlot(schedule, Date.now());
    expect(slot).not.toBeNull();
    expect(Date.parse(slot!.at)).toBeLessThanOrEqual(Date.now());
    expect(isDueSlot(schedule, Date.now())).toBe(true);
  });

  it("reports no due slot when the schedule is in the future", () => {
    const schedule = buildSchedule("abc", Date.now() + 24 * 60 * 60 * 1000);
    expect(getNextPendingSlot(schedule, Date.now())).toBeNull();
    expect(isDueSlot(schedule, Date.now())).toBe(false);
  });

  it("skips published slots", () => {
    const schedule = buildSchedule("abc", Date.now() - 60 * 60 * 1000);
    const published = schedule.map((s, i) =>
      i === 0 ? { ...s, state: "published" as const } : s,
    );
    const slot = getNextPendingSlot(published, Date.now());
    if (slot) {
      expect(slot.state).toBe("pending");
      expect(slot.at).not.toBe(published[0].at);
    }
  });
});
