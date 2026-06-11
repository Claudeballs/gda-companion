/* Procedures (walkers + ADC taskings + dispersal), Nations, Tactics,
   Terrain — reference content rendered from data.js, all search-indexed. */
"use strict";

/* ---------- step-through walker widget ---------- */
function makeWalker(id, title, steps, extraAtEnd) {
  let i = Store.get("walker_" + id, 0);
  if (i >= steps.length) i = 0;
  const card = h("div", { class: "card", id: "walk-" + id });
  const body = h("div", { class: "walkstep" });
  const draw = () => {
    Store.set("walker_" + id, i);
    body.innerHTML = "";
    const s = steps[i];
    body.append(
      h("div", { class: "sn" }, "STEP " + (i + 1) + " OF " + steps.length),
      h("h3", {}, s.t),
      h("p", { class: "sub" }, s.r),
      h("div", { class: "walkerr" }, h("b", {}, "Common error: "), s.err));
    if (i === steps.length - 1 && extraAtEnd) body.append(extraAtEnd());
  };
  card.append(h("h2", {}, title), body,
    h("div", { class: "seg" },
      h("button", { onclick: () => { i = Math.max(0, i - 1); draw(); } }, "← Back"),
      h("button", { class: "on", onclick: () => { i = Math.min(steps.length - 1, i + 1); draw(); buzz(12); } }, "NEXT →"),
      h("button", { onclick: () => { i = 0; draw(); } }, "Restart")));
  draw();
  indexCard("procedures", "walk-" + id, title, steps.map(s => s.t + " " + s.r + " " + s.err).join(" "));
  return card;
}

function falterTableEl() {
  const tbl = h("table", { class: "ft" });
  tbl.append(h("tr", {}, h("th", {}, "Grade"), ...FALTER_DICE_LABELS.map(d => h("th", {}, d))));
  const rows = [["Elite", FALTER_TABLE.Elite], ["Veteran / Line", FALTER_TABLE.VeteranLine], ["Recruit", FALTER_TABLE.Recruit]];
  for (const [label, cells] of rows) {
    tbl.append(h("tr", {}, h("td", {}, h("b", {}, label)),
      ...cells.map(c => h("td", { class: "r-" + c.replace("!", "") }, c))));
  }
  return tbl;
}

function buildProcedures() {
  const root = $("#tab-procedures");
  root.innerHTML = "";

  root.append(makeWalker("charge", "Charge sequence", CHARGE_WALKER, () =>
    h("button", { class: "bigbtn", onclick: () => showTab("charge") }, "Open the Charge calculator →")));

  const falterWrap = makeWalker("falter", "Faltering brigade", FALTER_WALKER, () => {
    const d = h("div", {});
    d.append(h("h3", {}, "Faltering Brigade table",
      h("span", { class: "badge-verify" }, "⚠ verify wording")), falterTableEl());
    for (const n of FALTER_NOTES) d.append(h("p", { class: "note" }, n));
    return d;
  });
  root.append(falterWrap);
  indexCard("procedures", "walk-falter", "Faltering Brigade table", FALTER_NOTES.join(" ") + " obey rally retire sauve");

  /* ADC taskings */
  const adc = h("div", { class: "card", id: "adc-card" },
    h("h2", {}, "ADC taskings", h("span", { class: "badge-verify" }, "⚠ confirm full list vs rulebook")));
  for (const t of TASKINGS) {
    adc.append(h("details", {},
      h("summary", {}, t.n + " — " + t.cost + " ADC"),
      h("p", { class: "sub" }, h("b", {}, "Does: "), t.does),
      h("p", { class: "note" }, h("b", {}, "Limits: "), t.limits)));
  }
  root.append(adc);
  indexCard("procedures", "adc-card", "ADC taskings", TASKINGS.map(t => t.n + " " + t.does + " " + t.limits).join(" "));

  /* dispersal thresholds */
  const disp = h("div", { class: "card", id: "dispersal-card" }, h("h2", {}, "Dispersal thresholds"));
  for (const d of DISPERSAL) disp.append(h("p", { class: "note" }, d));
  root.append(disp);
  indexCard("procedures", "dispersal-card", "Dispersal thresholds", DISPERSAL.join(" "));

  /* verify list */
  const vf = h("div", { class: "card", id: "verify-card" },
    h("h2", {}, "⚠ Data awaiting umpire sign-off"),
    h("p", { class: "sub" }, "Cards carrying the ⚠ badge use data not yet confirmed against the rulebook. Confirm each, then the badge comes off in data.js:"));
  for (const v of VERIFY_LIST) vf.append(h("p", { class: "note" }, v));
  root.append(vf);
  indexCard("procedures", "verify-card", "Unverified data list", VERIFY_LIST.join(" "));
}

/* ---------- nations ---------- */
const NATION_ICON = {
  France: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="44" width="48" height="8" rx="2" fill="#4a6fd4"/><rect x="22" y="44" width="16" height="8" fill="#fff"/><rect x="38" y="44" width="16" height="8" rx="2" fill="#d04848"/>
    <path d="M18 40c0-14 4-26 12-26s12 12 12 26z" fill="#2c3147"/>
    <circle cx="30" cy="20" r="4" fill="#d4a843"/><path d="M28 8l4-6 2 8z" fill="#d04848"/></svg>`,
  Prussia: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="44" width="48" height="8" rx="2" fill="#23252c"/><rect x="22" y="44" width="16" height="8" fill="#fff"/>
    <path d="M16 40c0-10 6-22 14-22s14 12 14 22z" fill="#2c3147"/>
    <path d="M26 18h8l-4-10z" fill="#d4a843"/><circle cx="30" cy="26" r="3.4" fill="#fff"/></svg>`,
  Russia: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="44" width="48" height="8" rx="2" fill="#2e8b57"/><rect x="22" y="44" width="16" height="8" fill="#fff"/><rect x="38" y="44" width="16" height="8" rx="2" fill="#d04848"/>
    <path d="M19 40l2-22h18l2 22z" fill="#2c3147"/>
    <path d="M21 18l9-8 9 8z" fill="#23252c"/><circle cx="30" cy="28" r="3.4" fill="#d4a843"/></svg>`
};

function buildNations() {
  const root = $("#tab-nations");
  root.innerHTML = "";
  root.append(h("p", { class: "sub", style: "margin:2px 4px 10px;" },
    "1813 framing. Icons are original in-project SVGs (copyright-safe). To use period plates instead, drop public-domain Knötel images into img/ and reference them here — verify the PD tag on each file."));
  for (const [nation, lines] of Object.entries(NATIONS)) {
    const card = h("div", { class: "card", id: "nation-" + nation },
      h("div", { class: "flagrow" },
        h("div", { style: "width:54px;height:54px;flex:0 0 auto;", html: NATION_ICON[nation] }),
        h("h2", { style: "margin:0;" }, nation === "Prussia" ? "Prussia (Late)" : nation)));
    for (const l of lines) card.append(h("p", { class: "note" }, l));
    root.append(card);
    indexCard("nations", "nation-" + nation, nation, lines.join(" "));
  }
}

/* ---------- tactics ---------- */
function buildTactics() {
  const root = $("#tab-tactics");
  root.innerHTML = "";
  const block = (title, list, prefix) => {
    const card = h("div", { class: "card", id: "tactics-" + prefix }, h("h2", {}, title));
    list.forEach(([head, why], i) => {
      const id = "tac-" + prefix + "-" + i;
      const det = h("details", { id },
        h("summary", {}, (i + 1) + ". " + head),
        h("p", { class: "sub" }, why));
      card.append(det);
      indexCard("tactics", id, head, why);
    });
    root.append(card);
  };
  block("Attacking", TACTICS_ATTACK, "atk");
  block("Defending", TACTICS_DEFEND, "def");
}

/* ---------- terrain ---------- */
function buildTerrain() {
  const root = $("#tab-terrain");
  root.innerHTML = "";
  for (const [name, lines] of Object.entries(TERRAIN)) {
    const id = "terrain-" + name.replace(/[^a-z]/gi, "");
    const card = h("div", { class: "card", id },
      h("h2", {}, name, TERRAIN_VERIFY[name] ? h("span", { class: "badge-verify" }, "⚠ unverified") : null));
    for (const l of lines) card.append(h("p", { class: "note" }, l));
    root.append(card);
    indexCard("terrain", id, name, lines.join(" "));
  }
}

function buildReference() {
  buildNations();
  buildTactics();
  buildTerrain();
}
