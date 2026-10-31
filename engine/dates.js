// Day keys are local calendar days written "YYYY-MM-DD". Weeks run Monday to Sunday.
const pad = (n) => String(n).padStart(2, "0");

export function dayKey(d = new Date()) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/** A Date at local midnight for a day key, or null when the key is not a real day. */
export function parseDay(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
  return d;
}

export function addDays(k, n) {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from a to b (b minus a). */
export function diffDays(a, b) {
  const A = parseDay(a), B = parseDay(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}

/** 0 for Monday ... 6 for Sunday. */
export function weekdayIndex(k) {
  return (parseDay(k).getDay() + 6) % 7;
}

/** The Monday of the week that holds this day. */
export function weekStart(k) {
  return addDays(k, -weekdayIndex(k));
}
