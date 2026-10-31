// The rules of the garden: streaks, how much a plant has grown, and how it feels today.
import { addDays, diffDays, weekStart, weekdayIndex, parseDay } from "./dates.js";

export const PLANTS = ["sunflower", "tulip", "fern", "cactus", "lavender", "bonsai"];
export const PLANT_NAMES = { sunflower: "Sunflower", tulip: "Tulip", fern: "Fern", cactus: "Cactus", lavender: "Lavender", bonsai: "Bonsai" };
export const POTS = 6;
export const LIMITS = { habits: 24, name: 40, days: 4000, editBack: 400 };
export const STAGE_NAMES = ["Seed", "Sprout", "Leafy", "Budding", "Blooming", "Flourishing"];

const MAX_WALK = 600;

/** Tidy raw habit input. Returns a habit or null when it cannot be used. */
export function cleanHabit(raw, today) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name);
  if (!name) return null;
  const kind = raw.kind === "weekly" ? "weekly" : "daily";
  let target = Math.round(Number(raw.target));
  if (kind === "daily") target = 7;
  else if (!(target >= 1 && target <= 6)) target = 3;
  const plant = PLANTS.includes(raw.plant) ? raw.plant : PLANTS[0];
  let pot = Math.round(Number(raw.pot));
  if (!(pot >= 0 && pot < POTS)) pot = 0;
  const created = parseDay(raw.created) ? raw.created : today;
  const id = typeof raw.id === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(raw.id) ? raw.id : "";
  return { id, name, kind, target, plant, pot, created };
}

export function newId(existing = []) {
  const taken = new Set(existing);
  for (;;) {
    const bytes = new Uint8Array(5);
    globalThis.crypto.getRandomValues(bytes);
    const id = "h" + [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("");
    if (!taken.has(id)) return id;
  }
}

const asSet = (days) => (days instanceof Set ? days : new Set(days || []));

/** How many ticks fall in the week that holds `day`. */
export function weekCount(days, day) {
  const set = asSet(days);
  const ws = weekStart(day);
  let n = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDays(ws, i))) n++;
  return n;
}

/** Current streak. Daily: days in a row. Weekly: weeks in a row that met the target. A day or week still in progress never breaks it. */
export function streak(h, days, today) {
  const set = asSet(days);
  let n = 0;
  if (h.kind === "daily") {
    let d = set.has(today) ? today : addDays(today, -1);
    while (set.has(d) && n < MAX_WALK) { n++; d = addDays(d, -1); }
    return n;
  }
  let ws = weekStart(today);
  if (weekCount(set, ws) >= h.target) n++;
  ws = addDays(ws, -7);
  while (weekCount(set, ws) >= h.target && n < MAX_WALK) { n++; ws = addDays(ws, -7); }
  return n;
}

/** The longest streak ever, by the same rules. */
export function bestStreak(h, days) {
  const set = asSet(days);
  if (!set.size) return 0;
  const sorted = [...set].sort();
  let best = 0;
  if (h.kind === "daily") {
    let run = 0, prev = null;
    for (const d of sorted) {
      run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }
    return best;
  }
  const weeks = new Map();
  for (const d of sorted) { const w = weekStart(d); weeks.set(w, (weeks.get(w) || 0) + 1); }
  let run = 0, prev = null;
  for (const [w, c] of [...weeks].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (c < h.target) { run = 0; prev = null; continue; }
    run = prev && diffDays(prev, w) === 7 ? run + 1 : 1;
    if (run > best) best = run;
    prev = w;
  }
  return best;
}

/** How well the plant has been looked after lately, from 0 to 1, over up to the last 4 weeks (at least 7 days). */
export function vitality(h, days, today) {
  const set = asSet(days);
  const age = Math.max(0, diffDays(h.created, today));
  const window = Math.min(28, Math.max(7, age + 1));
  let ticks = 0;
  for (let i = 0; i < window; i++) if (set.has(addDays(today, -i))) ticks++;
  const expected = h.kind === "daily" ? window : (h.target * window) / 7;
  return { ticks, window, rate: Math.min(1, ticks / expected) };
}

/** 0 seed, 1 sprout, 2 leafy, 3 budding, 4 blooming, 5 flourishing. */
export function stageOf(v) {
  if (v.ticks === 0) return 0;
  if (v.rate < 0.15) return 1;
  if (v.rate < 0.4) return 2;
  if (v.rate < 0.65) return 3;
  if (v.rate < 0.85) return 4;
  return 5;
}

/** "happy", "thirsty" or "wilting", from how long it has been since the last watering. */
export function mood(h, days, today) {
  const set = asSet(days);
  const age = Math.max(0, diffDays(h.created, today));
  if (h.kind === "daily") {
    let last = null;
    for (const d of set) if (d <= today && (!last || d > last)) last = d;
    const gap = last ? diffDays(last, today) : age;
    return gap <= 1 ? "happy" : gap <= 3 ? "thirsty" : "wilting";
  }
  const ws = weekStart(today);
  if (h.created >= ws) return "happy";
  const need = h.target - weekCount(set, today);
  if (need <= 0) return "happy";
  const left = 7 - weekdayIndex(today);
  const slack = left - need;
  if (slack >= 1) return "happy";
  if (slack === 0) return "thirsty";
  return weekCount(set, addDays(ws, -7)) >= h.target ? "thirsty" : "wilting";
}

/** Everything a card needs for one habit. */
export function status(h, days, today) {
  const set = asSet(days);
  const v = vitality(h, set, today);
  const wk = weekCount(set, today);
  return {
    doneToday: set.has(today),
    streak: streak(h, set, today),
    best: bestStreak(h, set),
    total: set.size,
    stage: stageOf(v),
    rate: v.rate,
    mood: mood(h, set, today),
    weekDone: wk,
    weekMet: h.kind === "weekly" && wk >= h.target,
  };
}
