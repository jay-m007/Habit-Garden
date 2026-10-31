import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

const T = "2026-11-01"; // a Sunday
const daily = { id: "a", name: "Water", kind: "daily", target: 7, plant: "fern", pot: 0, created: "2026-01-01" };
const weekly = (n) => ({ id: "b", name: "Gym", kind: "weekly", target: n, plant: "cactus", pot: 1, created: "2026-01-01" });
const run = (from, n) => Array.from({ length: n }, (_, i) => E.addDays(from, i));

test("dates: add, diff, weeks", () => {
  assert.equal(E.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(E.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(E.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(E.diffDays("2026-10-25", "2026-11-01"), 7);
  assert.equal(E.diffDays("2026-03-28", "2026-03-30"), 2);
  assert.equal(E.weekdayIndex("2026-11-01"), 6);
  assert.equal(E.weekdayIndex("2026-10-26"), 0);
  assert.equal(E.weekStart("2026-11-01"), "2026-10-26");
  assert.equal(E.parseDay("2026-02-30"), null);
  assert.equal(E.parseDay("nope"), null);
});

test("daily streak: today counts, yesterday keeps it alive, a gap breaks it", () => {
  assert.equal(E.streak(daily, run("2026-10-29", 4), T), 4);
  assert.equal(E.streak(daily, run("2026-10-28", 4), T), 4);
  assert.equal(E.streak(daily, run("2026-10-27", 4), T), 0);
  assert.equal(E.streak(daily, [], T), 0);
  assert.equal(E.streak(daily, ["2026-11-01", "2026-10-30"], T), 1);
});

test("weekly streak: a week in progress never breaks it", () => {
  const h = weekly(2);
  const lastTwoWeeks = ["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"];
  assert.equal(E.streak(h, lastTwoWeeks, "2026-10-29"), 2);
  assert.equal(E.streak(h, ["2026-10-19", "2026-10-21", "2026-10-26"], "2026-10-29"), 1);
  assert.equal(E.streak(h, ["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-27"], "2026-10-29"), 2);
  assert.equal(E.streak(h, ["2026-10-12", "2026-10-14"], "2026-10-29"), 0);
});

test("best streak", () => {
  assert.equal(E.bestStreak(daily, [...run("2026-03-01", 5), ...run("2026-04-01", 9), "2026-05-05"]), 9);
  assert.equal(E.bestStreak(daily, []), 0);
  const h = weekly(2);
  const days = ["2026-03-02", "2026-03-04", "2026-03-09", "2026-03-11", "2026-03-23", "2026-03-25", "2026-03-30"];
  assert.equal(E.bestStreak(h, days), 2);
});

test("vitality and stages grow with care", () => {
  const none = E.vitality(daily, [], T);
  assert.equal(E.stageOf(none), 0);
  const stage = (days, h = daily) => E.stageOf(E.vitality(h, days, T));
  assert.equal(stage(["2026-11-01"]), 1);
  assert.ok(stage(run("2026-10-12", 20)) >= 4);
  assert.equal(stage(run("2026-10-05", 28)), 5);
  const fresh = { ...daily, created: T };
  assert.equal(stage(["2026-11-01"], fresh), 1);
  const young = { ...daily, created: "2026-10-30" };
  assert.ok(stage(run("2026-10-30", 3), young) >= 3);
  assert.ok(stage(run("2026-10-30", 3), young) < 6);
});

test("weekly plants are judged against their own target", () => {
  const h = weekly(2);
  const days = run("2026-10-05", 28).filter((d) => E.weekdayIndex(d) < 2);
  assert.equal(E.stageOf(E.vitality(h, days, T)), 5);
});

test("mood: happy, thirsty, wilting", () => {
  assert.equal(E.mood(daily, ["2026-10-31"], T), "happy");
  assert.equal(E.mood(daily, ["2026-10-30"], T), "thirsty");
  assert.equal(E.mood(daily, ["2026-10-29"], T), "thirsty");
  assert.equal(E.mood(daily, ["2026-10-28"], T), "wilting");
  assert.equal(E.mood(daily, ["2026-10-20"], T), "wilting");
  assert.equal(E.mood({ ...daily, created: T }, [], T), "happy");
  const h = weekly(3);
  assert.equal(E.mood(h, ["2026-10-26", "2026-10-27", "2026-10-28"], "2026-10-31"), "happy");
  assert.equal(E.mood(h, ["2026-10-19", "2026-10-20", "2026-10-21"], "2026-10-28"), "happy");
  assert.equal(E.mood(h, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-26"], "2026-11-01"), "thirsty");
  assert.equal(E.mood(h, ["2026-10-26"], "2026-11-01"), "wilting");
});

test("status bundles the card data", () => {
  const s = E.status(daily, run("2026-10-29", 4), T);
  assert.equal(s.doneToday, true);
  assert.equal(s.streak, 4);
  assert.equal(s.total, 4);
  assert.equal(s.mood, "happy");
  const w = E.status(weekly(2), ["2026-10-26", "2026-10-27"], T);
  assert.equal(w.weekMet, true);
  assert.equal(w.weekDone, 2);
});

test("add, update, remove, toggle", () => {
  let s = E.emptyState();
  s = E.addHabit(s, { name: "  Read   a  lot ", kind: "weekly", target: 4, plant: "tulip", pot: 2 }, T);
  assert.equal(s.habits.length, 1);
  const h = s.habits[0];
  assert.equal(h.name, "Read a lot");
  assert.match(h.id, /^h[0-9a-z]{10}$/);
  assert.equal(E.addHabit(s, { name: "   " }, T), null);
  const t1 = E.toggleDay(s, h.id, T, T);
  assert.equal(t1.watered, true);
  assert.deepEqual(t1.state.done[h.id], [T]);
  const t2 = E.toggleDay(t1.state, h.id, T, T);
  assert.equal(t2.watered, false);
  assert.deepEqual(t2.state.done[h.id], []);
  assert.equal(E.toggleDay(s, h.id, "2026-11-02", T), null, "no future days");
  assert.equal(E.toggleDay(s, h.id, "2024-01-01", T), null, "not too far back");
  assert.equal(E.toggleDay(s, "nope", T, T), null);
  const back = E.toggleDay(s, h.id, "2026-10-20", T);
  assert.equal(back.state.habits[0].created, "2026-10-20");
  const u = E.updateHabit(s, h.id, { name: "Read", plant: "bonsai", kind: "daily" }, T);
  assert.equal(u.habits[0].plant, "bonsai");
  assert.equal(u.habits[0].target, 7);
  assert.equal(u.habits[0].id, h.id);
  assert.equal(E.removeHabit(t1.state, h.id).habits.length, 0);
  assert.equal(Object.keys(E.removeHabit(t1.state, h.id).done).length, 0);
});

test("limits on habits", () => {
  let s = E.emptyState();
  for (let i = 0; i < E.LIMITS.habits; i++) s = E.addHabit(s, { name: "h" + i }, T);
  assert.equal(s.habits.length, E.LIMITS.habits);
  assert.equal(E.addHabit(s, { name: "one more" }, T), null);
  const ids = new Set(s.habits.map((h) => h.id));
  assert.equal(ids.size, E.LIMITS.habits);
});

test("validateState accepts good data and refuses hostile data", () => {
  let s = E.sampleState(T);
  const round = E.validateState(JSON.parse(JSON.stringify(s)), T);
  assert.ok(round);
  assert.deepEqual(round.done, s.done);
  assert.equal(E.validateState(null, T), null);
  assert.equal(E.validateState([], T), null);
  assert.equal(E.validateState({ v: 2, habits: [], done: {} }, T), null);
  assert.equal(E.validateState({ v: 1, habits: "x" }, T), null);
  const evil = JSON.parse('{"v":1,"habits":[{"id":"__proto__","name":"x"}],"done":{"__proto__":["2026-01-01"]}}');
  assert.equal(E.validateState(evil, T), null);
  const dupe = { v: 1, habits: [{ id: "a", name: "x" }, { id: "a", name: "y" }], done: {} };
  assert.equal(E.validateState(dupe, T), null);
  const badDay = { v: 1, habits: [{ id: "a", name: "x" }], done: { a: ["2026-02-31"] } };
  assert.equal(E.validateState(badDay, T), null);
  const huge = { v: 1, habits: [{ id: "a", name: "x" }], done: { a: new Array(E.LIMITS.days + 1).fill("2026-01-01") } };
  assert.equal(E.validateState(huge, T), null);
  const tooMany = { v: 1, habits: Array.from({ length: 25 }, (_, i) => ({ id: "a" + i, name: "x" })), done: {} };
  assert.equal(E.validateState(tooMany, T), null);
  const future = E.validateState({ v: 1, habits: [{ id: "a", name: "x", created: "2026-01-01" }], done: { a: ["2026-11-01", "2027-01-01"] } }, T);
  assert.deepEqual(future.done.a, [T], "future ticks are dropped");
  const script = E.validateState({ v: 1, habits: [{ id: "a", name: "<img src=x onerror=alert(1)>", plant: "evil", pot: 99, kind: "x" }], done: {} }, T);
  assert.equal(script.habits[0].plant, "sunflower");
  assert.equal(script.habits[0].pot, 0);
  assert.equal(script.habits[0].kind, "daily");
  const rem = E.validateState({ v: 1, habits: [], done: {}, settings: { reminder: { on: true, time: "99:99" } } }, T);
  assert.deepEqual(rem.settings.reminder, { on: true, time: "20:00" });
});

test("sample garden is varied and valid", () => {
  const s = E.sampleState(T);
  assert.equal(s.habits.length, 5);
  assert.ok(E.validateState(JSON.parse(JSON.stringify(s)), T));
  const stages = new Set(s.habits.map((h) => E.status(h, s.done[h.id], T).stage));
  assert.ok(stages.size >= 3, "different growth stages");
  const moods = new Set(s.habits.map((h) => E.status(h, s.done[h.id], T).mood));
  assert.ok(moods.size >= 2, "not every plant happy");
  const a = E.sampleState(T), b = E.sampleState(T);
  assert.deepEqual(a.habits.map((h) => h.name), b.habits.map((h) => h.name));
  assert.deepEqual(Object.values(a.done), Object.values(b.done), "repeatable");
});

test("heatmap shape and values", () => {
  const s = E.sampleState(T);
  const w = E.heatWeeks(s, T, 20);
  assert.equal(w.length, 20);
  assert.ok(w.every((c) => c.length === 7));
  assert.equal(w[19][6].day, T);
  assert.equal(w[19][6].future, false);
  assert.equal(E.heatWeeks(s, "2026-10-28", 2)[1][6].future, true);
  const one = E.heatWeeks(s, T, 4, s.habits[0].id).flat().filter((c) => !c.future);
  assert.ok(one.every((c) => c.value === 0 || c.value === 1));
  const all = E.heatWeeks(s, T, 4).flat();
  assert.ok(all.every((c) => c.value >= 0 && c.value <= 1));
});

test("summary", () => {
  const s = E.sampleState(T);
  const m = E.summary(s, T);
  assert.equal(m.total, 5);
  assert.ok(m.waterings > 100);
  assert.ok(m.bestEver.n >= m.bestNow.n);
  assert.ok(m.bestDay >= 0 && m.bestDay <= 6);
  assert.equal(m.byWeekday.reduce((a, b) => a + b, 0), m.waterings);
  assert.equal(E.summary(E.emptyState(), T).bestDay, -1);
});

test("reminder setting", () => {
  const s = E.setReminder(E.emptyState(), true, "07:30");
  assert.deepEqual(s.settings.reminder, { on: true, time: "07:30" });
  assert.equal(E.setReminder(s, false, "bad").settings.reminder.time, "20:00");
});
