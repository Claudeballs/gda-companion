/* GdA Companion — shell: tabs, theme, storage, search, shared widgets */
"use strict";

/* ---------- storage ---------- */
const Store = {
  get(k, fb) { try { const v = localStorage.getItem("gda_" + k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem("gda_" + k, JSON.stringify(v)); } catch (e) { /* full/blocked — table use survives without persistence */ } },
  del(k) { try { localStorage.removeItem("gda_" + k); } catch (e) {} }
};

/* ---------- tiny DOM helpers ---------- */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtMod = n => (n > 0 ? "+" + n : String(n));

/* ---------- haptics ---------- */
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms || 30); } catch (e) {} };

/* ---------- tabs ---------- */
const TABS = [
  { id: "charge", label: "Charge", icon: "⚔️" },
  { id: "rolloff", label: "Roll-Off", icon: "🎲" },
  { id: "fire", label: "Fire", icon: "💥" },
  { id: "tracker", label: "Tracker", icon: "🗺️" },
  { id: "procedures", label: "Steps", icon: "📋" },
  { id: "nations", label: "Nations", icon: "🎖️" },
  { id: "tactics", label: "Tactics", icon: "🧠" },
  { id: "terrain", label: "Terrain", icon: "🌲" }
];
function showTab(id, opts) {
  $$("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
  $$("main .tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + id));
  Store.set("tab", id);
  if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
}

/* ---------- theme ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  Store.set("theme", t);
  $("#themebtn").textContent = t === "dark" ? "☀️" : "🌙";
}

/* ---------- shared widgets ---------- */

/* stepper: returns {el, get, set} calling onChange(v) */
function makeStepper(min, max, val, onChange) {
  let v = val;
  const vEl = h("span", { class: "v" }, String(v));
  const set = nv => { v = Math.max(min, Math.min(max, nv)); vEl.textContent = String(v); onChange && onChange(v); };
  const el = h("span", { class: "step" },
    h("button", { onclick: () => { set(v - 1); buzz(10); } }, "−"),
    vEl,
    h("button", { onclick: () => { set(v + 1); buzz(10); } }, "+"));
  return { el, get: () => v, set };
}

/* iOS-style scroll-snap wheel: values array (numbers or strings).
   Returns {el, get, set}. */
function makeWheel(label, values, startIdx, onChange) {
  let idx = startIdx;
  const opts = values.map(v => h("div", { class: "opt" }, typeof v === "number" ? fmtMod(v) : String(v)));
  const wheel = h("div", { class: "wheel" }, h("div", { class: "pad" }), opts, h("div", { class: "pad" }));
  const sel = h("div", { class: "sel" }, typeof values[idx] === "number" ? fmtMod(values[idx]) : String(values[idx]));
  let scrollT;
  wheel.addEventListener("scroll", () => {
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const i = Math.max(0, Math.min(values.length - 1, Math.round(wheel.scrollTop / 44)));
      if (i !== idx) { idx = i; buzz(8); }
      sel.textContent = typeof values[idx] === "number" ? fmtMod(values[idx]) : String(values[idx]);
      onChange && onChange(values[idx], idx);
    }, 80);
  }, { passive: true });
  const el = h("div", { class: "wheelbox" },
    h("div", { class: "wl" }, label),
    h("div", { class: "wheelwrap" }, wheel),
    sel);
  // position after insertion
  requestAnimationFrame(() => { wheel.scrollTop = idx * 44; });
  return {
    el, get: () => values[idx],
    set: i => { idx = i; wheel.scrollTop = i * 44; sel.textContent = typeof values[i] === "number" ? fmtMod(values[i]) : String(values[i]); }
  };
}

/* 3D CSS die. makeDie(red) → {el, roll(value, mod), value} */
const DIE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const PIP_LAYOUT = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function makeDie(red) {
  const faces = [];
  for (let f = 1; f <= 6; f++) {
    const face = h("div", { class: "face f" + f });
    for (let cell = 0; cell < 9; cell++) {
      const pip = h("span", {});
      if (PIP_LAYOUT[f].includes(cell)) pip.className = "pip";
      pip.style.gridArea = (Math.floor(cell / 3) + 1) + " / " + (cell % 3 + 1);
      face.append(pip);
    }
    faces.push(face);
  }
  const el = h("div", { class: "die" + (red ? " red" : "") }, faces);
  let spins = 0;
  const api = {
    el, value: null,
    roll(value) {
      api.value = value;
      spins++;
      const [rx, ry] = DIE_ROT[value];
      el.style.transform = `rotateX(${rx + 360 * spins}deg) rotateY(${ry + 360 * spins}deg)`;
      setTimeout(() => buzz(20), 560);
      return value;
    },
    mark(on) { el.classList.toggle("rrmark", !!on); }
  };
  return api;
}
const d6 = () => 1 + Math.floor(Math.random() * 6);

/* chip helper: toggleable pill. spec: every selection reversible */
function makeChip(label, sub, onToggle, opts) {
  const chip = h("button", { class: "chip" + ((opts && opts.neg) ? " neg" : "") },
    label, sub ? h("small", {}, sub) : null);
  chip.addEventListener("click", () => {
    chip.classList.toggle("on");
    buzz(12);
    onToggle(chip.classList.contains("on"));
  });
  return chip;
}

/* ---------- charge results lookup (shared by Charge & Roll-Off) ---------- */
function chargeBand(diff) {
  return CHARGE_RESULTS.find(r => diff >= r.min && diff <= r.max);
}
function chargeColKey(chargerType, defenderType) {
  if (chargerType === "cav") return defenderType === "cav" ? "cavVsCav" : "cavVsInfArty";
  return "infVsInfArty";
}
const COL_LABELS = { infVsInfArty: "Inf vs Inf/Arty", cavVsCav: "Cav vs Cav", cavVsInfArty: "Cav vs Inf/Arty" };

function renderChargeTable(hlBand, hlCol) {
  const tbl = h("table", { class: "cr" });
  tbl.append(h("tr", {},
    h("th", {}, "Won by"),
    h("th", { class: hlCol === "infVsInfArty" ? "hl" : "" }, "Inf v Inf/Arty"),
    h("th", { class: hlCol === "cavVsCav" ? "hl" : "" }, "Cav v Cav"),
    h("th", { class: hlCol === "cavVsInfArty" ? "hl" : "" }, "Cav v Inf/Arty")));
  for (const r of CHARGE_RESULTS) {
    const isRow = hlBand && r.by === hlBand.by;
    tbl.append(h("tr", { class: isRow ? "hl" : "" },
      h("td", {}, r.by),
      h("td", { class: isRow && hlCol === "infVsInfArty" ? "hl" : "" }, r.infVsInfArty),
      h("td", { class: isRow && hlCol === "cavVsCav" ? "hl" : "" }, r.cavVsCav),
      h("td", { class: isRow && hlCol === "cavVsInfArty" ? "hl" : "" }, r.cavVsInfArty)));
  }
  return tbl;
}

/* ---------- session log (Roll-Off / melee audit trail) ---------- */
const SessionLog = {
  all() { return Store.get("log", []); },
  add(entry) { const l = SessionLog.all(); l.unshift({ ts: Date.now(), ...entry }); Store.set("log", l.slice(0, 60)); },
  clear() { Store.del("log"); }
};

/* ---------- search ---------- */
const SearchIndex = []; // {tab, cardId, title, text}
function indexCard(tab, cardId, title, text) {
  const entry = { tab, cardId, title, text: (title + " " + text).toLowerCase() };
  const i = SearchIndex.findIndex(e => e.tab === tab && e.cardId === cardId);
  if (i >= 0) SearchIndex[i] = entry; else SearchIndex.push(entry);
}
function runSearch(q) {
  const res = $("#searchresults");
  res.innerHTML = "";
  q = q.trim().toLowerCase();
  if (q.length < 2) return;
  const terms = q.split(/\s+/);
  const hits = SearchIndex
    .map(e => ({ e, score: terms.reduce((s, t) => s + (e.text.includes(t) ? 1 : 0), 0) }))
    .filter(x => x.score === Math.max(1, x.score) && x.score >= Math.ceil(terms.length / 2))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
  if (!hits.length) { res.append(h("p", { class: "sub" }, "No matches.")); return; }
  for (const { e } of hits) {
    const snippet = snippetFor(e, terms);
    res.append(h("button", { class: "sres", onclick: () => jumpTo(e) },
      h("div", { class: "where" }, TABS.find(t => t.id === e.tab)?.label || e.tab),
      h("div", { html: "<b>" + esc(e.title) + "</b>" }),
      h("div", { class: "sub", html: snippet })));
  }
}
function snippetFor(e, terms) {
  const raw = e.text;
  const i = raw.indexOf(terms[0]);
  const start = Math.max(0, i - 40);
  let snip = esc(raw.slice(start, start + 150));
  for (const t of terms) snip = snip.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
  return (start ? "…" : "") + snip + "…";
}
function jumpTo(e) {
  $("#searchpanel").classList.remove("on");
  showTab(e.tab);
  const card = document.getElementById(e.cardId);
  if (card) {
    if (card.tagName === "DETAILS") card.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("hl-card"); void card.offsetWidth; card.classList.add("hl-card");
  }
}

/* ---------- reset game ---------- */
function resetGame() {
  if (!confirm("Reset game? Tracker state, calculator inputs and the duel log will be cleared. Theme is kept.")) return;
  const theme = Store.get("theme", "dark");
  Object.keys(localStorage).filter(k => k.startsWith("gda_")).forEach(k => localStorage.removeItem(k));
  Store.set("theme", theme);
  location.reload();
}

/* ---------- boot ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // header
  $("#themebtn").addEventListener("click", () =>
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  applyTheme(Store.get("theme", "dark"));
  $("#searchbtn").addEventListener("click", () => {
    $("#searchpanel").classList.add("on");
    $("#searchinput").value = ""; $("#searchresults").innerHTML = "";
    $("#searchinput").focus();
  });
  $("#searchclose").addEventListener("click", () => $("#searchpanel").classList.remove("on"));
  $("#searchinput").addEventListener("input", ev => runSearch(ev.target.value));

  // tab bar
  const bar = $("#tabbar");
  for (const t of TABS) {
    bar.append(h("button", { "data-tab": t.id, onclick: () => showTab(t.id) },
      h("span", { class: "ti" }, t.icon), t.label));
  }

  // build feature tabs (each module exposes buildX on window)
  buildCharge();
  buildRolloff();
  buildFire();
  buildTracker();
  buildProcedures();
  buildReference(); // nations, tactics, terrain

  showTab(Store.get("tab", "charge"));
});
