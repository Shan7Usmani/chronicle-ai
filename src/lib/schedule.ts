import type { PublishSlot } from "@/lib/types";
import { env } from "@/lib/config";

const WINDOW_MS = 48 * 60 * 60 * 1000;
const MIN_GAP_MS = 90 * 60 * 1000;

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSchedule(agentId: string, fromMs: number = Date.now()): PublishSlot[] {
  const rand = mulberry32(hashSeed(agentId));
  const count = 12 + Math.floor(rand() * 3);
  const times: number[] = [];

  const end = fromMs + WINDOW_MS;
  const jitterRange = Math.min(10, Math.max(1, env.PUBLISH_FIRST_SLOT_MIN));
  const firstOffset = (env.PUBLISH_FIRST_SLOT_MIN + rand() * jitterRange) * 60 * 1000;
  const first = fromMs + firstOffset;
  times.push(first);

  const spacing = (end - first) / (count - 1);
  for (let i = 1; i < count; i++) {
    const jitter = spacing * (rand() - 0.5) * 0.4;
    let slot = first + spacing * i + jitter;
    if (slot - times[i - 1] < MIN_GAP_MS) slot = times[i - 1] + MIN_GAP_MS;
    if (slot > end) slot = end;
    times.push(slot);
  }

  return times.map((at) => ({
    at: new Date(at).toISOString(),
    state: "pending" as const,
  }));
}

export function getNextPendingSlot(schedule: PublishSlot[], nowMs: number): PublishSlot | null {
  return (
    schedule.find(
      (slot) => slot.state === "pending" && new Date(slot.at).getTime() <= nowMs,
    ) ?? null
  );
}

export function isDueSlot(schedule: PublishSlot[], nowMs: number): boolean {
  return getNextPendingSlot(schedule, nowMs) !== null;
}
