// Numbers for the Year screen: the calendar heatmap, totals and the best day of the week.
import { addDays, weekStart, weekdayIndex } from "./dates.js";
import { status } from "./habits.js";

/**
 * Columns of 7 days (Monday first), oldest week first, ending with the week of `today`.
 * With a habit id each cell is 0 or 1. Without one it is the share of the garden watered that day.
 */
export function heatWeeks(state, today, nWeeks, habitId) {
  const sets = new Map(state.habits.map((h) => [h.id, new Set(state.done[h.id] || [])]));
  const habits = habitId ? state.habits.filter((h) => h.id === habitId) : state.habits;
  const first = addDays(weekStart(today), -7 * (nWeeks - 1));
  const weeks = [];
  for (let w = 0; w < nWeeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(first, w * 7 + i);
      const future = day > today;
      let total = 0, done = 0;
      if (!future) for (const h of habits) {
        if (h.created > day && !sets.get(h.id).has(day)) continue;
        total++;
        if (sets.get(h.id).has(day)) done++;
      }
      col.push({ day, future, done, total, value: total ? done / total : 0 });
    }
    weeks.push(col);
  }
  return weeks;
}

export function summary(state, today) {
  let waterings = 0, bestNow = { name: "", n: 0 }, bestEver = { name: "", n: 0 }, doneToday = 0, settledToday = 0;
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const h of state.habits) {
    const days = state.done[h.id] || [];
    const st = status(h, days, today);
    waterings += days.length;
    for (const d of days) byWeekday[weekdayIndex(d)]++;
    if (st.streak > bestNow.n) bestNow = { name: h.name, n: st.streak, kind: h.kind };
    if (st.best > bestEver.n) bestEver = { name: h.name, n: st.best, kind: h.kind };
    if (st.doneToday) doneToday++;
    if (st.doneToday || st.weekMet) settledToday++;
  }
  let bestDay = -1, max = 0;
  byWeekday.forEach((n, i) => { if (n > max) { max = n; bestDay = i; } });
  return { waterings, bestNow, bestEver, doneToday, settledToday, total: state.habits.length, byWeekday, bestDay };
}
