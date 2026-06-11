/* Fire calculator — §10.3 VERIFIED two-part model.
   1) Roll 2D6, apply NEGATIVE score modifiers, look the modified score
      up on the correct results line → BASE casualties (+ FD/DT/FC flags).
   2) +CD modifiers grant bonus Casualty Dice, each hitting on 4–6.
   3) Halving (column/square firer; garrison target) applies to the
      FINAL total, rounding down. */
"use strict";

let FI = null;

const FIRE_SCORE_CHIPS = {
  infantry: [
    { id: "cas4",   label: "4+ casualties on firer",            v: -1 },
    { id: "cas8",   label: "8+ casualties (10+ Elite/Large)",   v: -2 },
    { id: "tgtBty", label: "Target deployed battery/skirmishers", v: -2 },
    { id: "cover",  label: "Target in cover",                   v: -1 },
    { id: "unf",    label: "Firer unformed (also Inferior line)", v: -2 }
  ],
  artillery: [
    { id: "cas4",   label: "4+ casualties on battery",          v: -1 },
    { id: "cas6",   label: "6+ casualties (8+ Elite/Large)",    v: -2 },
    { id: "moved",  label: "Moved or unlimbered",               v: -2 },
    { id: "unf",    label: "Unformed",                          v: -2 },
    { id: "ammo",   label: "Low on Ammunition (each)",          v: -2 },
    { id: "tgtBty", label: "Target deployed battery/skirmishers", v: -2 },
    { id: "cover",  label: "Target in cover",                   v: -1 }
  ]
};
const FIRE_CD_CHIPS = {
  infantry: [
    { id: "elite",  label: "Elite",                              cd: 1 },
    { id: "large",  label: "Large battalion in line",            cd: 1 },
    { id: "col3",   label: "Vs inf column at 3\" (firers Fresh)", cd: 1 },
    { id: "sqmass", label: "Target square / massed columns",     cd: 2 },
    { id: "fv",     label: "First Volley (1813)",                cd: 1 },
    { id: "bngun",  label: "Battalion gun",                      cd: 1 },
    { id: "skirm",  label: "Skirmishers! tasking",               cd: 1 }
  ],
  artillery: [
    { id: "elite",  label: "Elite battery (also inflicts DT)",   cd: 1 },
    { id: "lbcan",  label: "Large battery, canister",            cd: 1 },
    { id: "assault",label: "Assault Fire tasking",               cd: 2 },
    { id: "colrng", label: "Target column at close/effective",   cd: 1 },
    { id: "sqmass", label: "Target square / massed columns",     cd: 2 }
  ]
};

function fireDefaults() {
  return {
    mode: "infantry", line: "standardVolley", range: "batteryEffective",
    firerFormation: "line", targetGarrison: false,
    scoreMods: [], cdMods: [], dice: [0, 0], bonusHits: 0
  };
}

function buildFire() {
  FI = Store.get("fire_state2", null) || fireDefaults();
  const root = $("#tab-fire");
  root.innerHTML = "";
  const card = h("div", { class: "card", id: "fire-card" }, h("h2", {}, "Fire calculator (verified model)"));

  const single = (label, opts, cur, onPick) => {
    card.append(h("div", { class: "grouplabel" }, label));
    const wrap = h("div", { class: "chips" });
    for (const o of opts) {
      const b = h("button", { class: "chip" + (cur === o.v ? " on" : "") }, o.l, o.sub ? h("small", {}, o.sub) : null);
      b.addEventListener("click", () => {
        $$(".chip", wrap).forEach(c => c.classList.remove("on"));
        b.classList.add("on"); onPick(o.v); buzz(10);
      });
      wrap.append(b);
    }
    card.append(wrap);
  };

  single("Firer", [{ v: "infantry", l: "Infantry / skirmishers" }, { v: "artillery", l: "Artillery" }],
    FI.mode, v => { FI.mode = v; buildFire(); });

  if (FI.mode === "infantry") {
    single("Results line", [
      { v: "superiorVolley", l: "Superior", sub: "Elite/Vet/British" },
      { v: "standardVolley", l: "Standard", sub: "Line, not moved" },
      { v: "inferiorVolley", l: "Inferior", sub: "Recruit/Small/moved/unformed" }
    ], FI.line, v => { FI.line = v; fireOut(); });
    card.append(h("p", { class: "sub" },
      "Superior: " + FIRING_LINES.superiorVolley.who + " · Standard: " + FIRING_LINES.standardVolley.who +
      " · Inferior: " + FIRING_LINES.inferiorVolley.who));
    card.append(h("p", { class: "sub" },
      "Musketry ranges: square " + RANGES.musketry.square + " · volley " + RANGES.musketry.volley + " · skirmish " + RANGES.musketry.skirmish));
    single("Firer formation (for halving)", [
      { v: "line", l: "Line" }, { v: "column", l: "Column" }, { v: "square", l: "Square" }, { v: "skirmish", l: "Skirmishers" }
    ], FI.firerFormation, v => { FI.firerFormation = v; fireOut(); });
  } else {
    single("Range band", [
      { v: "batteryClose", l: "Canister/close" },
      { v: "batteryEffective", l: "Effective" },
      { v: "batteryLong", l: "Long" }
    ], FI.range, v => { FI.range = v; fireOut(); });
    const a = RANGES.artillery;
    card.append(h("p", { class: "sub" },
      "3-4pdr: " + a["3-4pdr"].canister + " / " + a["3-4pdr"].effective + " / " + a["3-4pdr"].long +
      " · 6-9pdr: " + a["6-9pdr"].canister + " / " + a["6-9pdr"].effective + " / " + a["6-9pdr"].long +
      " · 12pdr: " + a["12pdr"].canister + " / " + a["12pdr"].effective + " / " + a["12pdr"].long));
  }

  // target garrison toggle (halving)
  const gar = makeChip("Target is BUA/strongpoint garrison", "halve", on => { FI.targetGarrison = on; fireOut(); });
  if (FI.targetGarrison) gar.classList.add("on");
  card.append(h("div", { class: "grouplabel" }, "Target"), h("div", { class: "chips" }, gar));

  // score modifiers (negative, applied to the 2D6 roll)
  card.append(h("div", { class: "grouplabel" }, "Score modifiers (applied to the 2D6 roll)"));
  const sWrap = h("div", { class: "chips" });
  for (const m of FIRE_SCORE_CHIPS[FI.mode]) {
    const on = FI.scoreMods.includes(m.id);
    const chip = h("button", { class: "chip neg" + (on ? " on" : "") }, m.label, h("small", {}, String(m.v)));
    chip.addEventListener("click", () => {
      const i = FI.scoreMods.indexOf(m.id);
      if (i >= 0) { FI.scoreMods.splice(i, 1); chip.classList.remove("on"); }
      else { FI.scoreMods.push(m.id); chip.classList.add("on"); }
      fireOut(); buzz(10);
    });
    sWrap.append(chip);
  }
  card.append(sWrap);

  // bonus CD modifiers
  card.append(h("div", { class: "grouplabel" }, "Bonus Casualty Dice (each hits on 4–6)"));
  const cWrap = h("div", { class: "chips" });
  for (const m of FIRE_CD_CHIPS[FI.mode]) {
    const on = FI.cdMods.includes(m.id);
    const chip = h("button", { class: "chip" + (on ? " on" : "") }, m.label, h("small", {}, "+" + m.cd + " CD"));
    chip.addEventListener("click", () => {
      const i = FI.cdMods.indexOf(m.id);
      if (i >= 0) { FI.cdMods.splice(i, 1); chip.classList.remove("on"); }
      else { FI.cdMods.push(m.id); chip.classList.add("on"); }
      fireOut(); buzz(10);
    });
    cWrap.append(chip);
  }
  card.append(cWrap);

  // dice entry
  card.append(h("div", { class: "grouplabel" }, "The 2D6 fire roll"));
  const d1 = makeStepper(0, 6, FI.dice[0], v => { FI.dice[0] = v; fireOut(); });
  const d2 = makeStepper(0, 6, FI.dice[1], v => { FI.dice[1] = v; fireOut(); });
  card.append(h("div", { class: "flagrow" }, d1.el, d2.el));

  card.append(h("div", { class: "grouplabel" }, "Bonus-CD hits rolled (4–6 each)"));
  card.append(makeStepper(0, 12, FI.bonusHits, v => { FI.bonusHits = v; fireOut(); }).el);

  root.append(card);
  root.append(h("div", { class: "card resultpanel", id: "fire-out" }));

  // verified rules cards
  const rules = h("div", { class: "card", id: "fire-rules" }, h("h2", {}, "Fire rules (verified)"));
  const RULE_TITLES = {
    halving: "Halving chain", skirmishScreens: "Skirmisher screens", measurement: "Measurement",
    doubleSix: "Double 6 on casualty dice", assaultFire: "Assault Fire", largeBattery: "Large battery", grandBattery: "Grand Battery"
  };
  for (const [k, title] of Object.entries(RULE_TITLES)) {
    rules.append(h("details", { id: "fire-rule-" + k }, h("summary", {}, title), h("p", { class: "note" }, FIRE_RULES[k])));
    indexCard("fire", "fire-rule-" + k, title, FIRE_RULES[k]);
  }
  rules.append(h("details", { id: "fire-rule-flags" }, h("summary", {}, "FD / DT / FC / Destiny flags"),
    h("p", { class: "note" }, FIRE_MODIFIERS.flags)));
  indexCard("fire", "fire-rule-flags", "Fire flags FD DT FC Destiny", FIRE_MODIFIERS.flags);
  root.append(rules);

  indexCard("fire", "fire-card", "Fire calculator", "musketry artillery 2D6 score results line casualty dice halve column square garrison canister effective long superior standard inferior");
  fireOut();
}

function fireOut() {
  Store.set("fire_state2", FI);
  const out = $("#fire-out");
  if (!out) return;
  out.innerHTML = "";
  out.append(h("h2", {}, "Fire result"));

  const lineKey = FI.mode === "infantry" ? FI.line : FI.range;
  const scoreModList = FIRE_SCORE_CHIPS[FI.mode].filter(m => FI.scoreMods.includes(m.id));
  const scoreMod = scoreModList.reduce((s, m) => s + m.v, 0);
  const bonusCD = FIRE_CD_CHIPS[FI.mode].filter(m => FI.cdMods.includes(m.id)).reduce((s, m) => s + m.cd, 0);

  if (!(FI.dice[0] >= 1 && FI.dice[1] >= 1)) {
    out.append(h("p", { class: "sub" },
      "Enter the 2D6 roll. Line: " + FIRING_LINES[lineKey].label +
      " · score mod " + fmtMod(scoreMod) + " · bonus CD " + bonusCD +
      (bonusCD ? " (roll them now, hits on 4–6)" : "")));
    return;
  }

  const raw = FI.dice[0] + FI.dice[1];
  const score = raw + scoreMod;
  const row = FIRING_TABLE[lineKey];
  const idx = score <= 3 ? 0 : score >= 12 ? 8 : (score <= 9 ? score - 3 : 7);
  const cell = row[idx];

  // parse the cell: number, ½, —, FD, FC, "FD if Recruit", "/DT"
  let base = 0, flags = [];
  const m = String(cell).match(/^(½|\d+)/);
  if (m) base = m[1] === "½" ? 0.5 : parseInt(m[1], 10);
  if (/FD/.test(cell)) flags.push("FD — " + (cell.includes("if Recruit") ? "only if firer is Recruit: " : "") + "firer loses Fire Discipline");
  if (/FC/.test(cell)) flags.push("FC — battery takes a Fatigue Casualty (2 on Assault Fire; Elite/Large ignore the first)");
  if (/DT/.test(cell)) flags.push("DT — target takes a Discipline Test");
  if (FI.dice[0] === 6 && FI.dice[1] === 6) flags.push("DOUBLE 6 — Destiny!");
  if (FI.mode === "artillery" && FI.dice[0] === 1 && FI.dice[1] === 1) flags.push("DOUBLE 1 — battery Low on Ammunition");

  let total = base + FI.bonusHits;
  const chain = [
    raw + " rolled " + (scoreMod ? fmtMod(scoreMod) + " = " + score : "(no score mods)"),
    FIRING_LINES[lineKey].label + " line → " + cell + " base",
    FI.bonusHits ? "+ " + FI.bonusHits + " bonus-CD hit" + (FI.bonusHits > 1 ? "s" : "") + " (of " + bonusCD + " CD)" : null
  ].filter(Boolean);

  const firerHalves = FI.mode === "infantry" && (FI.firerFormation === "column" || FI.firerFormation === "square");
  if (firerHalves) { total = total / 2; chain.push("halve (firer in " + FI.firerFormation + ") → " + total); }
  if (FI.targetGarrison) { total = total / 2; chain.push("halve again (garrison target) → " + total); }
  total = Math.floor(total);
  chain.push("round down → " + total);

  out.append(h("div", { class: "bigdiff good" }, total + " casualt" + (total === 1 ? "y" : "ies")));
  out.append(h("p", { class: "totalsub" }, chain.join("  ·  ")));
  for (const f of flags) out.append(h("p", { class: "note" }, f));
  if (bonusCD && FI.bonusHits === 0)
    out.append(h("p", { class: "sub" }, "You have " + bonusCD + " bonus CD — roll them (hits on 4–6) and enter the hits above."));
  out.append(h("p", { class: "sub" }, FIRE_RULES.measurement));
}
