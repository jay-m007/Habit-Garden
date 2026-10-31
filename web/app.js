import {
  dayKey, parseDay, addDays, weekdayIndex, emptyState, validateState, addHabit, updateHabit, removeHabit, toggleDay,
  setReminder, sampleState, status, summary, heatWeeks, PLANTS, PLANT_NAMES, STAGE_NAMES, LIMITS,
} from "./engine/index.js";
import { drawPlant, plantToDataUrl, POT_COLORS } from "./plants.js";

const KEY = "hg.v1";
const $ = (s, r = document) => r.querySelector(s);
const MOODS = { happy: "Happy", thirsty: "Thirsty", wilting: "Wilting" };
const NS = "http://www.w3.org/2000/svg";

/** Build elements without ever parsing HTML: text always goes in as text. */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === false || v == null) continue;
    if (k === "text") e.textContent = v; else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}
function droplet() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", "M12 2.5C9 7 5.5 10.4 5.5 14.6A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.4C18.5 10.4 15 7 12 2.5z");
  s.append(p);
  return s;
}

/* ---------- storage ---------- */
let today = dayKey();
let state = emptyState();
let canSave = true;

function load() {
  let text = null;
  try { text = localStorage.getItem(KEY); } catch { canSave = false; }
  if (!text) return;
  let ok = null;
  try { ok = validateState(JSON.parse(text), today); } catch { ok = null; }
  if (ok) { state = ok; return; }
  try { localStorage.setItem(KEY + ".unreadable", text); } catch { /* nothing to do */ }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); canSave = true; } catch { canSave = false; }
  $("#saveWarn").hidden = canSave;
}

/* ---------- small helpers ---------- */
let toastTimer = 0;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = true;
  void t.offsetWidth;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}
const fmtDay = (d, opts) => parseDay(d).toLocaleDateString(undefined, opts || { weekday: "short", day: "numeric", month: "short" });
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

function timeOfDay() {
  const hr = new Date().getHours();
  return hr < 5 ? "night" : hr < 11 ? "morning" : hr < 17 ? "day" : hr < 20 ? "evening" : "night";
}
function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? "Still up?" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Good night";
}
const habitOf = (id) => state.habits.find((x) => x.id === id);
const daysOf = (id) => state.done[id] || [];
const plantFor = (hab, st, extra = {}) =>
  drawPlant({ plant: hab.plant, stage: st.stage, mood: st.mood, pot: hab.pot, label: `${PLANT_NAMES[hab.plant]}, ${STAGE_NAMES[st.stage].toLowerCase()}, ${MOODS[st.mood].toLowerCase()}`, ...extra });
function metaLine(hab, st) {
  if (hab.kind === "daily") return st.streak ? st.streak + "\u2011day streak" : "No streak yet";
  const wk = st.weekDone >= hab.target ? "Goal met this week" : st.weekDone + " of " + hab.target + " this week";
  return wk + (st.streak ? " \u00b7 " + st.streak + "\u2011week streak" : "");
}

/* ---------- garden ---------- */
function card(hab, fresh) {
  const st = status(hab, daysOf(hab.id), today);
  const open = h("button", { class: "card-main", type: "button", "data-act": "open", "aria-label": hab.name + ". Open details" },
    h("span", { class: "plant-wrap" }, plantFor(hab, st)),
    h("span", { class: "pname", text: hab.name }),
    h("span", { class: "pmeta", text: metaLine(hab, st) }),
    h("span", { class: "tag " + st.mood, text: MOODS[st.mood] }));
  const water = h("button", { class: "water", type: "button", "data-act": "water", "aria-pressed": String(st.doneToday), "aria-label": (st.doneToday ? "Undo watering for " : "Water ") + hab.name },
    droplet(), h("span", { text: st.doneToday ? "Watered" : "Water" }),
    h("i", { class: "d" }), h("i", { class: "d" }), h("i", { class: "d" }), h("i", { class: "d" }));
  return h("article", { class: "pot-card mood-" + st.mood + (fresh ? "" : " static"), "data-id": hab.id }, open, water);
}

function renderProgress() {
  const box = $("#progress");
  const sm = summary(state, today);
  box.hidden = sm.total === 0;
  if (!sm.total) return;
  const frac = sm.settledToday / sm.total;
  $("#ringFg").style.strokeDashoffset = String(113.1 * (1 - frac));
  $("#progressText").textContent = sm.settledToday === sm.total
    ? "All looked after. Your garden is happy."
    : sm.settledToday + " of " + sm.total + " looked after today";
}

function renderGarden() {
  today = dayKey();
  document.documentElement.dataset.tod = timeOfDay();
  $("#dateLine").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  $("#greet").textContent = greeting();
  const g = $("#garden");
  g.replaceChildren(...state.habits.map((x) => card(x, true)));
  $("#empty").hidden = state.habits.length > 0;
  renderProgress();
}

function refreshCard(id, splash) {
  const old = $('.pot-card[data-id="' + id + '"]');
  const hab = habitOf(id);
  if (!old || !hab) return renderGarden();
  const fresh = card(hab, false);
  if (splash) fresh.classList.add("just-watered");
  old.replaceWith(fresh);
  if (splash) setTimeout(() => fresh.classList.remove("just-watered"), 1000);
  renderProgress();
}

function water(id) {
  const hab = habitOf(id);
  if (!hab) return;
  const before = status(hab, daysOf(id), today);
  const r = toggleDay(state, id, today, today);
  if (!r) return;
  state = r.state;
  save();
  refreshCard(id, r.watered);
  if (!r.watered) return toast("Watering undone");
  const after = status(habitOf(id), daysOf(id), today);
  const marks = hab.kind === "daily" ? [3, 7, 14, 21, 30, 50, 100, 200, 365] : [2, 4, 8, 12, 26, 52];
  if (after.stage > before.stage) toast(hab.name + " grew: " + STAGE_NAMES[after.stage].toLowerCase() + "!");
  else if (marks.includes(after.streak)) toast(plural(after.streak, hab.kind === "daily" ? "day" : "week") + " in a row!");
  else toast("Watered " + hab.name);
}

/* ---------- heat maps ---------- */
const level = (v) => (v <= 0 ? "" : v < 0.34 ? " l1" : v < 0.67 ? " l2" : v < 1 ? " l3" : " l4");

function renderYear() {
  const body = $("#yearBody");
  if (!state.habits.length) {
    body.replaceChildren(h("div", { class: "cardbox empty-box" }, h("h2", { text: "Nothing to show yet" }), h("p", { class: "muted", text: "Plant a habit and water it a few times. Your year will fill in here." })));
    return;
  }
  const sm = summary(state, today);
  const unit = (b) => (b.kind === "weekly" ? "week" : "day");
  const tiles = h("div", { class: "tiles" },
    h("div", { class: "tile" }, h("b", { text: String(sm.waterings) }), h("span", { text: "Waterings so far" })),
    h("div", { class: "tile" }, h("b", { text: sm.bestNow.n ? plural(sm.bestNow.n, unit(sm.bestNow)) : "None yet" }), h("span", { text: "Best streak now" }), sm.bestNow.n ? h("small", { text: sm.bestNow.name }) : null),
    h("div", { class: "tile" }, h("b", { text: sm.bestEver.n ? plural(sm.bestEver.n, unit(sm.bestEver)) : "None yet" }), h("span", { text: "Best streak ever" }), sm.bestEver.n ? h("small", { text: sm.bestEver.name }) : null),
    h("div", { class: "tile" }, h("b", { text: sm.bestDay < 0 ? "None yet" : WEEKDAYS[sm.bestDay] }), h("span", { text: "Your best day" }), sm.bestDay >= 0 ? h("small", { text: plural(sm.byWeekday[sm.bestDay], "watering") }) : null));

  const weeks = heatWeeks(state, today, 30);
  let active = 0;
  const heat = h("div", { class: "heat", role: "img" });
  for (const col of weeks) for (const c of col) {
    if (c.done) active++;
    const label = fmtDay(c.day) + (c.future ? "" : ": " + c.done + " of " + c.total + " watered");
    heat.append(h("div", { class: "cell" + (c.future ? " fut" : level(c.value)) + (c.day === today ? " today" : ""), title: label }));
  }
  heat.setAttribute("aria-label", "Heat map of the last 30 weeks. " + plural(weeks.flat().filter((c) => c.done > 0).length, "day") + " with at least one watering.");
  const scroll = h("div", { class: "heat-scroll" }, heat);
  const legend = h("div", { class: "legend" }, "Less ", ...["", " l1", " l2", " l3", " l4"].map((l) => h("i", { class: "cell" + l })), " More");
  const heatBox = h("div", { class: "heat-wrap" }, h("h2", { text: "Garden activity" }), scroll, legend);

  const bars = h("div", { class: "bars" });
  for (const hab of state.habits) {
    const st = status(hab, daysOf(hab.id), today);
    const pct = Math.round(st.rate * 100);
    const fill = h("i");
    fill.style.width = pct + "%";
    bars.append(h("div", { class: "bar-row" }, h("b", { text: hab.name }), h("span", { text: pct + "%" }), h("div", { class: "track", role: "img", "aria-label": hab.name + ": " + pct + " percent over the last 4 weeks" }, fill)));
  }
  body.replaceChildren(tiles, heatBox, h("h2", { text: "Plant health, last 4 weeks" }), bars);
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
}

/* ---------- habit detail ---------- */
let detailId = "";
function renderDetail() {
  const hab = habitOf(detailId);
  const dlg = $("#detailDlg");
  if (!hab) { if (dlg.open) dlg.close(); return; }
  const st = status(hab, daysOf(hab.id), today);
  const rate = Math.round(st.rate * 100);
  $("#detailH").textContent = hab.name;
  const set = new Set(daysOf(hab.id));
  const heat = h("div", { class: "heat big" });
  for (const col of heatWeeks(state, today, 20, hab.id)) for (const c of col) {
    if (c.future) { heat.append(h("div", { class: "cell fut" })); continue; }
    const on = set.has(c.day);
    heat.append(h("button", { class: "cell" + (on ? " l4" : "") + (c.day === today ? " today" : ""), type: "button", "data-day": c.day, "aria-pressed": String(on), "aria-label": fmtDay(c.day) + (on ? ", watered" : ", not watered") }));
  }
  const scroll = h("div", { class: "heat-scroll" }, heat);
  $("#detailBody").replaceChildren(
    h("div", { class: "detail-top" },
      h("div", { class: "plant-wrap" }, plantFor(hab, st)),
      h("div", {}, h("h3", { text: PLANT_NAMES[hab.plant] + ", " + STAGE_NAMES[st.stage].toLowerCase() }),
        h("p", { class: "muted small", text: hab.kind === "daily" ? "Every day" : plural(hab.target, "day") + " a week" }),
        h("span", { class: "tag " + st.mood, text: MOODS[st.mood] }))),
    h("div", { class: "stats" },
      h("div", {}, h("b", { text: plural(st.streak, hab.kind === "daily" ? "day" : "week") }), h("span", { text: "Current streak" })),
      h("div", {}, h("b", { text: plural(st.best, hab.kind === "daily" ? "day" : "week") }), h("span", { text: "Best streak" })),
      h("div", {}, h("b", { text: String(st.total) }), h("span", { text: "Waterings" })),
      h("div", {}, h("b", { text: rate + "%" }), h("span", { text: "Last 4 weeks" }))),
    h("h2", { text: "Last 20 weeks" }), scroll,
    h("p", { class: "hint", text: "Tap a day to add or remove a watering. Rows go Monday to Sunday." }));
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
}
function openDetail(id) {
  detailId = id;
  renderDetail();
  $("#detailDlg").showModal();
}

/* ---------- habit form ---------- */
const form = { id: "", kind: "daily", plant: PLANTS[0], pot: 0, armed: 0 };
function renderPlantPicker() {
  const box = $("#h-plants");
  box.replaceChildren(...PLANTS.map((p) => {
    const b = h("button", { type: "button", role: "radio", "data-plant": p, "aria-checked": String(form.plant === p), "aria-label": PLANT_NAMES[p] },
      drawPlant({ plant: p, stage: 4, mood: "happy", pot: form.pot, label: "" }), h("span", { text: PLANT_NAMES[p] }));
    b.querySelector("svg").setAttribute("aria-hidden", "true");
    b.querySelector("svg").removeAttribute("role");
    return b;
  }));
}
function renderPotPicker() {
  $("#h-pots").replaceChildren(...POT_COLORS.map((c, i) => {
    const b = h("button", { type: "button", role: "radio", "data-pot": i, "aria-checked": String(form.pot === i), "aria-label": "Pot colour " + (i + 1) });
    b.style.background = "linear-gradient(145deg," + c.rim + "," + c.body + ")";
    return b;
  }));
}
function syncKind() {
  for (const b of document.querySelectorAll("#h-kind button")) b.setAttribute("aria-checked", String(b.dataset.kind === form.kind));
  $("#h-weekBox").hidden = form.kind !== "weekly";
}
function openForm(id) {
  const hab = id ? habitOf(id) : null;
  form.id = id || "";
  form.kind = hab ? hab.kind : "daily";
  form.plant = hab ? hab.plant : PLANTS[state.habits.length % PLANTS.length];
  form.pot = hab ? hab.pot : state.habits.length % POT_COLORS.length;
  clearDelArm();
  $("#habitDlgH").textContent = hab ? "Edit habit" : "New habit";
  $("#h-save").textContent = hab ? "Save" : "Plant it";
  $("#h-name").value = hab ? hab.name : "";
  $("#h-msg").textContent = "";
  $("#h-del").hidden = !hab;
  const sel = $("#h-target");
  if (!sel.options.length) for (let n = 1; n <= 6; n++) sel.append(h("option", { value: n, text: plural(n, "day") }));
  sel.value = String(hab && hab.kind === "weekly" ? hab.target : 3);
  syncKind();
  renderPlantPicker();
  renderPotPicker();
  $("#habitDlg").showModal();
}
function clearDelArm() {
  clearTimeout(form.armed);
  form.armed = 0;
  const b = $("#h-del");
  b.textContent = "Delete";
  b.classList.remove("armed");
}
function submitForm(ev) {
  ev.preventDefault();
  const name = $("#h-name").value.trim();
  if (!name) { $("#h-msg").textContent = "Give your habit a name."; $("#h-name").focus(); return; }
  const input = { name, kind: form.kind, target: Number($("#h-target").value), plant: form.plant, pot: form.pot };
  if (form.id) {
    const next = updateHabit(state, form.id, input, today);
    if (!next) return;
    state = next;
    save();
    $("#habitDlg").close();
    renderGarden();
    if (detailId === form.id && $("#detailDlg").open) renderDetail();
    return toast("Saved");
  }
  const next = addHabit(state, input, today);
  if (!next) { $("#h-msg").textContent = "A garden holds " + LIMITS.habits + " habits at most."; return; }
  state = next;
  save();
  $("#habitDlg").close();
  renderGarden();
  toast("Planted " + name);
}

/* ---------- views ---------- */
let view = "garden";
function show(v) {
  view = v;
  for (const id of ["garden", "year", "more"]) $("#view-" + id).hidden = id !== v;
  for (const b of document.querySelectorAll(".dock button")) { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
  $("#fab").hidden = v !== "garden";
  if (v === "garden") renderGarden();
  if (v === "year") renderYear();
  if (v === "more") renderMore();
  window.scrollTo({ top: 0 });
}

/* ---------- more: reminder, share, backup ---------- */
function renderMore() {
  const r = state.settings.reminder;
  $("#remOn").checked = r.on;
  $("#remTime").value = r.time;
}
async function onReminder() {
  const msg = $("#remMsg");
  msg.className = "fb";
  msg.textContent = "";
  let on = $("#remOn").checked;
  if (on) {
    if (!("Notification" in window)) { msg.className = "fb bad"; msg.textContent = "This browser cannot show notifications."; on = false; }
    else if (Notification.permission === "denied") { msg.className = "fb bad"; msg.textContent = "Notifications are blocked for this site. Allow them in your browser settings."; on = false; }
    else if (Notification.permission === "default") {
      let p = "denied";
      try { p = await Notification.requestPermission(); } catch { /* keep denied */ }
      if (p !== "granted") { msg.className = "fb bad"; msg.textContent = "Without permission there is nothing to show."; on = false; }
    }
  }
  $("#remOn").checked = on;
  state = setReminder(state, on, $("#remTime").value || "20:00");
  save();
  if (on) { msg.className = "fb ok"; msg.textContent = "Reminder set for " + state.settings.reminder.time + " each day."; }
}
function maybeRemind() {
  const r = state.settings.reminder;
  if (!r.on || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  if (hm < r.time) return;
  let last = "";
  try { last = localStorage.getItem("hg.notified") || ""; } catch { /* ignore */ }
  if (last === today) return;
  const sm = summary(state, today);
  if (!sm.total || sm.settledToday === sm.total) return;
  try { localStorage.setItem("hg.notified", today); } catch { /* ignore */ }
  const left = sm.total - sm.settledToday;
  const body = plural(left, "plant") + (left === 1 ? " is" : " are") + " waiting for water.";
  const show = () => { try { new Notification("Habit Garden", { body, icon: "icon-192.png", tag: "hg-daily" }); } catch { /* not allowed here */ } };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification("Habit Garden", { body, icon: "icon-192.png", tag: "hg-daily" })).catch(show);
  } else show();
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function backup() {
  download("habit-garden-" + today + ".json", new Blob([JSON.stringify(state, null, 1)], { type: "application/json" }));
  const m = $("#backupMsg");
  m.className = "fb ok";
  m.textContent = "Backup downloaded.";
}
function restore(file) {
  const m = $("#backupMsg");
  m.className = "fb bad";
  if (!file) return;
  if (file.size > 2_000_000) { m.textContent = "That file is too big to be a Habit Garden backup."; return; }
  const fr = new FileReader();
  fr.onload = () => {
    let next = null;
    try { next = validateState(JSON.parse(String(fr.result)), today); } catch { next = null; }
    if (!next) { m.textContent = "That does not look like a Habit Garden backup."; return; }
    try { localStorage.setItem(KEY + ".before-restore", JSON.stringify(state)); } catch { /* ignore */ }
    state = next;
    save();
    m.className = "fb ok";
    m.textContent = "Restored " + plural(state.habits.length, "habit") + ". Your earlier garden was replaced.";
    renderMore();
  };
  fr.onerror = () => { m.textContent = "Could not read that file."; };
  fr.readAsText(file);
}

async function shareImage() {
  const btn = $("#shareImg");
  if (!state.habits.length) return toast("Plant something first");
  btn.disabled = true;
  try {
    const list = state.habits.slice(0, 9);
    const cols = Math.min(3, list.length), rows = Math.ceil(list.length / cols);
    const cw = 330, ch = 410, W = 1080, top = 230, H = top + rows * ch + 130;
    const c = h("canvas", { width: W, height: H });
    const x = c.getContext("2d");
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#fde6cf"); bg.addColorStop(0.5, "#e3efe6"); bg.addColorStop(1, "#d5e4fa");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const font = (w, s) => w + " " + s + "px ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif";
    x.fillStyle = "#17261f"; x.font = font(800, 68); x.fillText("My Habit Garden", 60, 110);
    const sm = summary(state, today);
    x.fillStyle = "#4f6258"; x.font = font(600, 32);
    x.fillText(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "  ·  " + sm.settledToday + " of " + sm.total + " looked after", 60, 168);
    const rr = (px, py, w, hh, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + hh, r); x.arcTo(px + w, py + hh, px, py + hh, r); x.arcTo(px, py + hh, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
    const x0 = (W - cols * cw) / 2;
    const imgs = await Promise.all(list.map((hab) => new Promise((res) => {
      const st = status(hab, daysOf(hab.id), today);
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = plantToDataUrl({ plant: hab.plant, stage: st.stage, mood: st.mood, pot: hab.pot });
    })));
    list.forEach((hab, i) => {
      const st = status(hab, daysOf(hab.id), today);
      const px = x0 + (i % cols) * cw + 12, py = top + Math.floor(i / cols) * ch + 6, w = cw - 24, hh = ch - 24;
      x.save(); x.shadowColor = "rgba(40,70,55,.22)"; x.shadowBlur = 28; x.shadowOffsetY = 10;
      x.fillStyle = "rgba(255,255,255,.62)"; rr(px, py, w, hh, 36); x.fill(); x.restore();
      x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 2; rr(px, py, w, hh, 36); x.stroke();
      if (imgs[i]) x.drawImage(imgs[i], px + (w - 230) / 2, py + 14, 230, 268);
      x.textAlign = "center"; x.fillStyle = "#17261f"; x.font = font(750, 30);
      let name = hab.name;
      while (name.length > 3 && x.measureText(name).width > w - 36) name = name.slice(0, -2);
      if (name !== hab.name) name = name.trimEnd() + "…";
      x.fillText(name, px + w / 2, py + 316);
      x.fillStyle = "#4f6258"; x.font = font(650, 25);
      x.fillText(metaLine(hab, st), px + w / 2, py + 352);
      x.textAlign = "left";
    });
    x.fillStyle = "#4f6258"; x.font = font(650, 28); x.textAlign = "center";
    x.fillText("Habit Garden  ·  jay-m007.github.io/Habit-Garden", W / 2, H - 54);
    await new Promise((res) => c.toBlob((b) => { if (b) download("my-habit-garden.png", b); res(); }, "image/png"));
    toast("Picture saved");
  } finally { btn.disabled = false; }
}

/* ---------- colour mode ---------- */
const MODES = ["auto", "light", "dark"];
function mode() { try { const m = localStorage.getItem("hg.mode"); return MODES.includes(m) ? m : "auto"; } catch { return "auto"; } }
function applyMode(m) {
  const root = document.documentElement;
  if (m === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", m);
  const b = $("#modeBtn");
  b.textContent = m[0].toUpperCase() + m.slice(1);
  b.setAttribute("aria-label", "Colour mode: " + m + ". Press to change.");
}

/* ---------- wiring ---------- */
function wire() {
  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const act = t.closest("[data-act]");
    if (act) {
      const id = act.closest(".pot-card") ? act.closest(".pot-card").dataset.id : "";
      if (act.dataset.act === "water") return water(id);
      if (act.dataset.act === "open") return openDetail(id);
      if (act.dataset.act === "new") return openForm("");
      if (act.dataset.act === "sample") { state = sampleState(today); save(); renderGarden(); return toast("A sample garden. Clear it any time in More."); }
    }
    const nav = t.closest(".dock button");
    if (nav) return show(nav.dataset.view);
    if (t.closest("[data-close]")) { const d = t.closest("dialog"); if (d) d.close(); return; }
    if (t instanceof HTMLDialogElement) t.close();
  });
  $("#modeBtn").addEventListener("click", () => {
    const next = MODES[(MODES.indexOf(mode()) + 1) % MODES.length];
    try { localStorage.setItem("hg.mode", next); } catch { /* ignore */ }
    applyMode(next);
  });
  $("#habitForm").addEventListener("submit", submitForm);
  $("#h-kind").addEventListener("click", (e) => { const b = e.target.closest("button[data-kind]"); if (b) { form.kind = b.dataset.kind; syncKind(); } });
  $("#h-plants").addEventListener("click", (e) => { const b = e.target.closest("button[data-plant]"); if (b) { form.plant = b.dataset.plant; for (const x of $("#h-plants").children) x.setAttribute("aria-checked", String(x.dataset.plant === form.plant)); } });
  $("#h-pots").addEventListener("click", (e) => { const b = e.target.closest("button[data-pot]"); if (b) { form.pot = Number(b.dataset.pot); renderPotPicker(); renderPlantPicker(); } });
  $("#h-del").addEventListener("click", () => {
    if (!form.armed) {
      const b = $("#h-del");
      b.textContent = "Tap again to delete";
      b.classList.add("armed");
      form.armed = setTimeout(clearDelArm, 4000);
      return;
    }
    const name = (habitOf(form.id) || {}).name || "habit";
    const next = removeHabit(state, form.id);
    clearDelArm();
    if (!next) return;
    state = next;
    save();
    $("#habitDlg").close();
    if ($("#detailDlg").open) $("#detailDlg").close();
    renderGarden();
    toast("Removed " + name);
  });
  $("#d-edit").addEventListener("click", () => { const id = detailId; $("#detailDlg").close(); openForm(id); });
  $("#detailBody").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-day]");
    if (!b) return;
    const r = toggleDay(state, detailId, b.dataset.day, today);
    if (!r) return toast("That day cannot be changed");
    state = r.state;
    save();
    renderDetail();
    refreshCard(detailId, false);
  });
  $("#remOn").addEventListener("change", onReminder);
  $("#remTime").addEventListener("change", onReminder);
  $("#shareImg").addEventListener("click", shareImage);
  $("#backup").addEventListener("click", backup);
  $("#restoreFile").addEventListener("change", (e) => { restore(e.target.files[0]); e.target.value = ""; });
  let wipeTimer = 0;
  $("#wipe").addEventListener("click", () => {
    const b = $("#wipe");
    if (!wipeTimer) {
      b.textContent = "Tap again to clear everything";
      b.classList.add("armed");
      wipeTimer = setTimeout(() => { wipeTimer = 0; b.textContent = "Clear everything"; b.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(wipeTimer);
    wipeTimer = 0;
    b.textContent = "Clear everything";
    b.classList.remove("armed");
    try { localStorage.setItem(KEY + ".before-clear", JSON.stringify(state)); } catch { /* ignore */ }
    state = emptyState();
    save();
    toast("Garden cleared");
    show("garden");
  });
  const tick = () => {
    if (dayKey() !== today) { renderGarden(); if (view === "year") renderYear(); }
    maybeRemind();
  };
  setInterval(tick, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}

load();
applyMode(mode());
wire();
show("garden");
save();
maybeRemind();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
