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
      ...cells.map(c => h("td", { class: "r-" + c.split(" ")[0].replace("!", "") }, c))));
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
    d.append(h("h3", {}, "Faltering Brigade table (verified)"), falterTableEl());
    d.append(h("p", { class: "note" }, FALTER_TRIGGER));
    for (const [k, v] of Object.entries(FALTER_RESULTS))
      d.append(h("p", { class: "note" }, h("b", {}, k + ": "), v));
    for (const n of FALTER_NOTES) d.append(h("p", { class: "note" }, n));
    return d;
  });
  root.append(falterWrap);
  indexCard("procedures", "walk-falter", "Faltering Brigade table",
    FALTER_TRIGGER + " " + Object.values(FALTER_RESULTS).join(" ") + " " + FALTER_NOTES.join(" ") + " obey rally retire sauve qui peut");

  /* ADC taskings — complete, VERIFIED against the rulebook QRS */
  const adc = h("div", { class: "card", id: "adc-card" }, h("h2", {}, "ADC taskings (verified, complete)"));
  for (const t of TASKINGS) {
    const costLabel = typeof t.cost === "number" ? t.cost + " ADC" : t.cost;
    adc.append(h("details", {},
      h("summary", {}, t.n + " — " + costLabel),
      h("p", { class: "sub" }, h("b", {}, "Does: "), t.does),
      t.limits ? h("p", { class: "note" }, h("b", {}, "Limits: "), t.limits) : null));
  }
  for (const n of TASKING_NOTES) adc.append(h("p", { class: "note" }, n));
  root.append(adc);
  indexCard("procedures", "adc-card", "ADC taskings",
    TASKINGS.map(t => t.n + " " + t.does + " " + t.limits).join(" ") + " " + TASKING_NOTES.join(" "));

  /* dispersal thresholds + verified casualty-levels table (§10.5) */
  const disp = h("div", { class: "card", id: "dispersal-card" }, h("h2", {}, "Casualty levels & dispersal (verified)"));
  const ct = h("table", { class: "ft" });
  ct.append(h("tr", {}, h("th", {}, "Unit"), h("th", {}, "Fresh"), h("th", {}, "−1 at"), h("th", {}, "−2 at"), h("th", {}, "Disperse")));
  for (const r of CASUALTY_LEVELS)
    ct.append(h("tr", {}, h("td", { style: "text-align:left;" }, r.unit), h("td", {}, r.fresh), h("td", {}, r.l1), h("td", {}, r.l2), h("td", { class: "r-Sauve" }, r.disperse)));
  disp.append(ct);
  for (const d of DISPERSAL) disp.append(h("p", { class: "note" }, d));
  root.append(disp);
  indexCard("procedures", "dispersal-card", "Casualty levels dispersal thresholds",
    DISPERSAL.join(" ") + " " + CASUALTY_LEVELS.map(r => r.unit + " " + r.disperse).join(" "));

  /* melee quick-reference (verified §10.6) */
  const ml = h("div", { class: "card", id: "melee-ref-card" }, h("h2", {}, "Melee tables (verified)"));
  ml.append(h("p", { class: "note" },
    "Base CD: Infantry " + MELEE_CD.infantry + " · Cavalry " + MELEE_CD.cavalry + " · Cossacks " + MELEE_CD.cossacks +
    " · Artillery " + MELEE_CD.artillery + ". Hits on " + MELEE_CD.hitOn + ". Minimum " + MELEE_CD.minimum + "."));
  const mlt = h("table", { class: "ft" });
  mlt.append(h("tr", {}, h("th", {}, "Diff"), h("th", {}, "Cav v Cav · Inf v Inf"), h("th", {}, "Cav vs Inf"), h("th", {}, "Inf vs BUA")));
  for (const [band, r] of Object.entries(MELEE_RESULTS))
    mlt.append(h("tr", {}, h("td", {}, band), h("td", {}, r.cavCavInfInf), h("td", {}, r.cavVsInf), h("td", {}, r.infVsBUA)));
  ml.append(mlt);
  const modsList = h("details", {}, h("summary", {}, "all melee CD modifiers"));
  for (const grp of [MELEE_MODS.unit, MELEE_MODS.situation, MELEE_MODS.position])
    for (const [k, v] of Object.entries(grp))
      modsList.append(h("p", { class: "note" }, h("b", {}, k.replace(/([A-Z])/g, " $1").toLowerCase() + ": "), v));
  ml.append(modsList);
  for (const n of MELEE_NOTES) ml.append(h("p", { class: "note" }, n));
  root.append(ml);
  indexCard("procedures", "melee-ref-card", "Melee tables CD modifiers results firefight fight on",
    JSON.stringify(MELEE_MODS).replace(/[{}"\[\]]/g, " ") + " " + MELEE_NOTES.join(" "));

  /* the only items still open with the umpire (§10.7) */
  const vf = h("div", { class: "card", id: "verify-card" },
    h("h2", {}, "Open items with the umpire"),
    h("p", { class: "sub" }, "Everything else in the app is verified against the rulebook + official FAQ."));
  for (const v of VERIFY_LIST) vf.append(h("p", { class: "note" }, v));
  root.append(vf);
  indexCard("procedures", "verify-card", "Open items umpire", VERIFY_LIST.join(" "));
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

/* ---------- terrain + verified movement & ranges (§10.1–10.2) ---------- */
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

  // movement rates (verified, rulebook p56)
  const mv = h("div", { class: "card", id: "terrain-movement" }, h("h2", {}, "Movement rates (verified)"));
  const mt = h("table", { class: "ft" });
  mt.append(h("tr", {}, h("th", {}, ""), h("th", {}, "Rate")));
  const mrow = (l, v) => mt.append(h("tr", {}, h("td", { style: "text-align:left;" }, l), h("td", {}, v)));
  mrow("Infantry line", MOVEMENT.infantry.line); mrow("Infantry column", MOVEMENT.infantry.column);
  mrow("Infantry square", MOVEMENT.infantry.square); mrow("Skirmishers", MOVEMENT.infantry.skirmish);
  mrow("Inf evade/retire", MOVEMENT.infantry.evadeRetire); mrow("Inf retreat/rout", MOVEMENT.infantry.retreatRout);
  mrow("Cavalry line", MOVEMENT.cavalry.line); mrow("Cav skirmish/evade/retire", MOVEMENT.cavalry.skirmishEvadeRetire);
  mrow("Cav retreat/rout", MOVEMENT.cavalry.retreatRout);
  mrow("Horse artillery", MOVEMENT.horseArtillery); mrow("Foot artillery", MOVEMENT.footArtillery);
  mrow("Generals", MOVEMENT.generals);
  mrow("Charge bonus inf / cav", MOVEMENT.chargeBonus.infantry + " / " + MOVEMENT.chargeBonus.cavalry);
  mrow("Step back inf / cav", MOVEMENT.stepBack.infantry + " / " + MOVEMENT.stepBack.cavalry);
  mrow("Manhandle/wheel battery", MOVEMENT.stepBack.manhandleOrWheelBattery);
  mv.append(mt);
  for (const k of ["moveToFlank", "oblique", "aboutFace", "minimumCloseDistance", "unformed", "roughTerrain", "severeTerrain", "fallingBackThroughGaps"])
    mv.append(h("p", { class: "note" }, h("b", {}, k.replace(/([A-Z])/g, " $1").toLowerCase() + ": "), MOVEMENT[k]));
  root.append(mv);
  indexCard("terrain", "terrain-movement", "Movement rates",
    JSON.stringify(MOVEMENT).replace(/[{}"\[\]]/g, " "));

  // weapon ranges (verified, rulebook p76)
  const rg = h("div", { class: "card", id: "terrain-ranges" }, h("h2", {}, "Weapon ranges (verified)"));
  rg.append(h("p", { class: "note" }, h("b", {}, "Musketry: "),
    "square " + RANGES.musketry.square + " · volley " + RANGES.musketry.volley + " · skirmish " + RANGES.musketry.skirmish));
  const rt = h("table", { class: "ft" });
  rt.append(h("tr", {}, h("th", {}, "Guns"), h("th", {}, "Canister"), h("th", {}, "Effective"), h("th", {}, "Long")));
  for (const [g, r] of Object.entries(RANGES.artillery))
    rt.append(h("tr", {}, h("td", {}, g), h("td", {}, r.canister), h("td", {}, r.effective), h("td", {}, r.long)));
  rg.append(rt);
  root.append(rg);
  indexCard("terrain", "terrain-ranges", "Weapon ranges musketry artillery canister effective long",
    JSON.stringify(RANGES).replace(/[{}"\[\]]/g, " "));
}

function buildReference() {
  buildNations();
  buildTactics();
  buildTerrain();
}
