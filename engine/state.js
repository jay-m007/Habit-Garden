// The saved data, and the only ways to change it. Everything returns a new state; nothing is edited in place.
import { addDays, diffDays, parseDay } from "./dates.js";
import { cleanHabit, newId, LIMITS } from "./habits.js";

export const VERSION = 1;

export function emptyState() {
  return { v: VERSION, habits: [], done: {}, settings: { reminder: { on: false, time: "20:00" } } };
}

function cleanTime(t) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(t ?? ""));
  return m ? m[0] : "20:00";
}

/** Check data read from storage or a backup file. Returns a clean state, or null when it is not a Habit Garden backup. */
export function validateState(raw, today) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== VERSION) return null;
  if (!Array.isArray(raw.habits) || raw.habits.length > LIMITS.habits) return null;
  const out = emptyState();
  const seen = new Set();
  for (const r of raw.habits) {
    const h = cleanHabit(r, today);
    if (!h || !h.id || seen.has(h.id)) return null;
    seen.add(h.id);
    out.habits.push(h);
  }
  const done = raw.done && typeof raw.done === "object" && !Array.isArray(raw.done) ? raw.done : {};
  for (const h of out.habits) {
    const list = Object.hasOwn(done, h.id) ? done[h.id] : [];
    if (!Array.isArray(list) || list.length > LIMITS.days) return null;
    const days = new Set();
    for (const d of list) {
      if (typeof d !== "string" || !parseDay(d)) return null;
      if (d <= today) days.add(d);
    }
    out.done[h.id] = [...days].sort();
    const first = out.done[h.id][0];
    if (first && first < h.created) h.created = first;
  }
  const rem = raw.settings && typeof raw.settings === "object" ? raw.settings.reminder : null;
  if (rem && typeof rem === "object") out.settings.reminder = { on: rem.on === true, time: cleanTime(rem.time) };
  return out;
}

export function addHabit(state, input, today) {
  if (state.habits.length >= LIMITS.habits) return null;
  const h = cleanHabit({ ...input, id: "", created: today }, today);
  if (!h) return null;
  h.id = newId(state.habits.map((x) => x.id));
  return { ...state, habits: [...state.habits, h], done: { ...state.done, [h.id]: [] } };
}

export function updateHabit(state, id, patch, today) {
  const old = state.habits.find((h) => h.id === id);
  if (!old) return null;
  const h = cleanHabit({ ...old, ...patch, id, created: old.created }, today);
  if (!h) return null;
  return { ...state, habits: state.habits.map((x) => (x.id === id ? h : x)) };
}

export function removeHabit(state, id) {
  if (!state.habits.some((h) => h.id === id)) return null;
  const done = { ...state.done };
  delete done[id];
  return { ...state, habits: state.habits.filter((h) => h.id !== id), done };
}

/** Water (or un-water) one habit on one day. Future days and days too far back are refused. */
export function toggleDay(state, id, day, today) {
  const h = state.habits.find((x) => x.id === id);
  if (!h || !parseDay(day) || day > today || diffDays(day, today) > LIMITS.editBack) return null;
  const set = new Set(state.done[id] || []);
  let watered;
  if (set.has(day)) { set.delete(day); watered = false; }
  else {
    if (set.size >= LIMITS.days) return null;
    set.add(day); watered = true;
  }
  const habits = watered && day < h.created ? state.habits.map((x) => (x.id === id ? { ...x, created: day } : x)) : state.habits;
  return { state: { ...state, habits, done: { ...state.done, [id]: [...set].sort() } }, watered };
}

export function setReminder(state, on, time) {
  return { ...state, settings: { ...state.settings, reminder: { on: !!on, time: cleanTime(time) } } };
}

/** A small, repeatable example garden with some history, so a new visitor can see how it looks. */
export function sampleState(today) {
  let seed = 20261101;
  const rnd = () => { // mulberry32: small, repeatable and well mixed
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const defs = [
    { name: "Drink 8 glasses of water", kind: "daily", target: 7, plant: "sunflower", pot: 5, p: 0.93, age: 70 },
    { name: "Read 20 pages", kind: "daily", target: 7, plant: "lavender", pot: 3, p: 0.7, age: 50 },
    { name: "Meditate", kind: "daily", target: 7, plant: "bonsai", pot: 2, p: 0.45, age: 40, quiet: 5 },
    { name: "Gym", kind: "weekly", target: 4, plant: "cactus", pot: 1, p: 0.6, age: 60 },
    { name: "Call home", kind: "weekly", target: 2, plant: "tulip", pot: 4, p: 0.3, age: 35 },
  ];
  let s = emptyState();
  for (const d of defs) {
    s = addHabit(s, d, today);
    const h = s.habits[s.habits.length - 1];
    const days = [];
    for (let i = d.age; i >= 0; i--) {
      if (d.quiet && i < d.quiet) continue;
      const day = addDays(today, -i);
      if (i === 0 && h.kind === "daily" && d.p < 0.6) continue;
      if (rnd() < d.p) days.push(day);
    }
    s.done[h.id] = [...new Set(days)].sort();
    s.habits = s.habits.map((x) => (x.id === h.id ? { ...x, created: addDays(today, -d.age) } : x));
  }
  return s;
}
