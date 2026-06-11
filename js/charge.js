/* Charge calculator — the killer feature.
   Models the 2D6 charge test each side rolls: shows each side's net
   modifier live, takes the table-rolled dice, resolves band + column. */
"use strict";

const GRADES = ["Elite", "Veteran", "Line", "Recruit"];
const GRADE_UP = { Recruit: "Line", Line: "Veteran", Veteran: "Elite", Elite: "Elite" };

function blankSide(role) {
  return {
    role, type: "inf", grade: "Line", formation: "line", unformed: false,
    garrison: false, supports: [], general: false,
    brigade: null, unitCas: null, chargeCas: null,
    chargingOn: false, heavyCav: false, lancers: false, campaignCav: false,
    narrowFront: false, flanked: false, flankRear: false,
    dice: [0, 0]
  };
}

/* effective grade after General attached (test as next grade up) */
function effGrade(side) { return side.general ? GRADE_UP[side.grade] : side.grade; }

/* pure modifier computation → [{label, val}] */
function computeChargeMods(side, opp) {
  const mods = [];
  const isCharger = side.role === "charger";
  const g = effGrade(side);

  // grade (with Recruit-in-column/square exception)
  let gv = CHARGE_MODS.grade[g];
  let glabel = g + " grade";
  if (g === "Recruit" && (side.formation === "column" || side.formation === "square")) {
    gv = 0; glabel = "Recruit in column/square (penalty waived)";
  }
  if (side.general) glabel = "General attached: test as " + g + (g === side.grade ? " (already top grade)" : "");
  mods.push({ label: glabel, val: gv });

  // formation
  if (side.unformed) mods.push({ label: "Unformed", val: CHARGE_MODS.formation.unformed });
  if (side.type === "inf" && opp.type === "cav") {
    if (side.formation === "column" || side.formation === "square")
      mods.push({ label: "Infantry column/square vs cavalry", val: CHARGE_MODS.formation.infColumnOrSquareVsCav });
    if (side.formation === "line")
      mods.push({ label: "Infantry line vs cavalry", val: CHARGE_MODS.formation.infLineVsCav });
  }
  if (side.type === "inf" && side.formation === "square" && opp.type === "inf")
    mods.push({ label: "Square vs infantry", val: CHARGE_MODS.formation.squareVsInfantry });
  if (side.type === "cav" && side.narrowFront)
    mods.push({ label: "Cavalry on narrower frontage", val: CHARGE_MODS.formation.cavNarrowerFrontage });

  // charger-only situations
  if (isCharger) {
    if (side.chargingOn) mods.push({ label: "Charging On", val: CHARGE_MODS.charger.chargingOn });
    if (side.type === "cav" && side.heavyCav) mods.push({ label: "Heavy cavalry", val: CHARGE_MODS.charger.heavyCav });
    if (side.type === "cav" && side.lancers && opp.type === "inf")
      mods.push({ label: "Lancers vs infantry", val: CHARGE_MODS.charger.lancersVsInf });
    if (side.type === "cav" && side.campaignCav)
      mods.push({ label: "Campaign cavalry vs Heavy/Battle", val: CHARGE_MODS.charger.campaignCavVsHeavy });
    if (side.chargeCas) {
      let v = CHARGE_MODS.charger.chargeCasualties[side.chargeCas];
      if (side.chargeCas === "2" && g === "Elite" && CHARGE_MODS.charger.chargeCasualties.eliteImmune2) {
        mods.push({ label: "Charge casualties 2 (Elite — immune)", val: 0 });
      } else if (v) {
        mods.push({ label: "Charge casualties " + side.chargeCas, val: v });
      }
    }
  }

  // both sides: unit casualties, brigade state
  if (side.unitCas) mods.push({ label: side.unitCas + " casualties on unit", val: CHARGE_MODS.charger.unitCasualties[side.unitCas] });
  if (side.brigade) mods.push({ label: "Brigade " + side.brigade, val: CHARGE_MODS.charger.brigadeState[side.brigade] });

  // defender-only
  if (!isCharger) {
    if (side.flanked) mods.push({ label: "Flanked", val: CHARGE_MODS.defender.flanked });
    if (side.flankRear) mods.push({ label: "Charged in flank/rear", val: CHARGE_MODS.defender.flankRearCharged });
  }
  return mods;
}
const netOf = mods => mods.reduce((s, m) => s + m.val, 0);

function rerollSummary(side) {
  const n = side.supports.length;
  if (!n) return "no support re-rolls";
  const deg = side.supports.filter(s => s.degraded).length;
  return n + " re-roll" + (n > 1 ? "s" : "") + (deg ? " (" + deg + " at −1)" : "");
}

/* ---------- UI ---------- */
let CH; // state {charger, defender}

function buildCharge() {
  CH = Store.get("charge_state", null) || { charger: blankSide("charger"), defender: blankSide("defender") };
  CH.charger.role = "charger"; CH.defender.role = "defender";
  const root = $("#tab-charge");
  root.innerHTML = "";
  root.append(
    h("div", { class: "duelgrid" },
      chargeSideCard(CH.charger, CH.defender),
      chargeSideCard(CH.defender, CH.charger)),
    h("div", { class: "card resultpanel", id: "charge-result" }),
    h("div", { class: "card", id: "charge-table-card" },
      h("h2", {}, "Charge results"),
      h("div", { id: "charge-table-holder" }),
      h("details", {},
        h("summary", {}, "Common mistakes (FAQ)"),
        ...CHARGE_RESULT_NOTES.map(n => h("p", { class: "note" }, n))),
      h("details", {},
        h("summary", {}, "Supports & re-rolls — the rules"),
        h("p", { class: "note" }, CHARGE_MODS.supports))));
  refreshCharge();

  indexCard("charge", "charge-table-card", "Charge results table",
    CHARGE_RESULTS.map(r => r.by + " " + r.infVsInfArty + " " + r.cavVsCav + " " + r.cavVsInfArty).join(" ")
    + " " + CHARGE_RESULT_NOTES.join(" ") + " " + CHARGE_MODS.supports);
}

function singleSelect(opts, cur, onPick) {
  const wrap = h("div", { class: "chips" });
  for (const o of opts) {
    const b = h("button", { class: "chip" + (cur === o.v ? " on" : "") }, o.l, o.sub ? h("small", {}, o.sub) : null);
    b.addEventListener("click", () => {
      $$(".chip", wrap).forEach(c => c.classList.remove("on"));
      const newVal = (o.allowOff && cur === o.v) ? null : o.v;
      if (newVal !== null) b.classList.add("on");
      cur = newVal; onPick(newVal); buzz(12);
    });
    wrap.append(b);
  }
  return wrap;
}

function chargeSideCard(side, opp) {
  const isC = side.role === "charger";
  const card = h("div", { class: "card sidecard" + (isC ? "" : " def") });
  card.append(h("h2", {}, isC ? "Charger" : "Defender"));

  // type
  card.append(h("div", { class: "grouplabel" }, "Type"));
  const types = [{ v: "inf", l: "Infantry" }, { v: "cav", l: "Cavalry" }];
  if (!isC) types.push({ v: "arty", l: "Artillery" });
  card.append(singleSelect(types, side.type, v => { side.type = v || side.type; refreshCharge(); }));

  // grade
  card.append(h("div", { class: "grouplabel" }, "Grade"));
  card.append(singleSelect(GRADES.map(g => ({ v: g, l: g })), side.grade, v => { side.grade = v || side.grade; refreshCharge(); }));

  // formation
  card.append(h("div", { class: "grouplabel" }, "Formation"));
  const forms = [{ v: "line", l: "Line" }, { v: "column", l: "Column" }, { v: "square", l: "Square" }, { v: "garrison", l: "Garrison (BUA)" }];
  card.append(singleSelect(forms, side.formation, v => { side.formation = v || side.formation; refreshCharge(); }));
  const unfChip = makeChip("Unformed", "−2", on => { side.unformed = on; refreshCharge(); }, { neg: true });
  if (side.unformed) unfChip.classList.add("on");
  card.append(h("div", { class: "chips" }, unfChip));

  // supports
  card.append(h("div", { class: "grouplabel" }, "Supports (re-rolls)"));
  const supHolder = h("div", { class: "chips" });
  const renderSups = () => {
    supHolder.innerHTML = "";
    side.supports.forEach((s, i) => {
      const b = h("button", { class: "chip" + (s.degraded ? " neg on" : " on") },
        "S" + (i + 1), h("small", {}, s.degraded ? "degraded −1" : "normal"));
      b.addEventListener("click", () => { s.degraded = !s.degraded; renderSups(); refreshCharge(); buzz(12); });
      supHolder.append(b);
    });
  };
  const supStep = makeStepper(0, 3, side.supports.length, v => {
    while (side.supports.length < v) side.supports.push({ degraded: false });
    side.supports.length = v;
    renderSups(); refreshCharge();
  });
  card.append(h("div", { class: "flagrow" }, supStep.el, h("span", { class: "sub" }, "tap a support to mark degraded")));
  renderSups();
  card.append(supHolder);

  // situation toggles
  card.append(h("div", { class: "grouplabel" }, "Situation"));
  const sit = h("div", { class: "chips" });
  const tog = (label, sub, key, neg) => {
    const c = makeChip(label, sub, on => { side[key] = on; refreshCharge(); }, { neg });
    if (side[key]) c.classList.add("on");
    sit.append(c);
  };
  tog("General attached", "grade up", "general");
  if (isC) {
    tog("Charging On", "+1", "chargingOn");
    tog("Heavy cavalry", "+1", "heavyCav");
    tog("Lancers vs inf", "+1", "lancers");
    tog("Campaign cav vs Heavy", "−1", "campaignCav", true);
    tog("Narrower frontage", "−1 cav", "narrowFront", true);
  } else {
    tog("Flanked", "−2", "flanked", true);
    tog("Charged in flank/rear", "−4", "flankRear", true);
    tog("Narrower frontage", "−1 cav", "narrowFront", true);
  }
  card.append(sit);

  card.append(h("div", { class: "grouplabel" }, "Brigade state"));
  card.append(singleSelect(
    [{ v: "hesitant", l: "Hesitant", sub: "−1", allowOff: true }, { v: "faltering", l: "Faltering", sub: "−1", allowOff: true }, { v: "demoralised", l: "Demoralised", sub: "−1", allowOff: true }],
    side.brigade, v => { side.brigade = v; refreshCharge(); }));

  card.append(h("div", { class: "grouplabel" }, "Casualties on unit"));
  card.append(singleSelect(
    [{ v: null, l: "0–3", allowOff: false }, { v: "4+", l: "4–7", sub: "−1" }, { v: "8+", l: "8+", sub: "−2" }],
    side.unitCas, v => { side.unitCas = v; refreshCharge(); }));

  if (isC) {
    card.append(h("div", { class: "grouplabel" }, "Charge casualties (this charge)"));
    card.append(singleSelect(
      [{ v: null, l: "0–1" }, { v: "2", l: "2", sub: "−1" }, { v: "3-4", l: "3–4", sub: "−2" }, { v: "5+", l: "5+", sub: "−3" }],
      side.chargeCas, v => { side.chargeCas = v; refreshCharge(); }));
  }

  // net + why
  card.append(
    h("div", { class: "netrow" },
      h("span", { class: "netmod", id: "net-" + side.role }, "+0"),
      h("span", { class: "sub" }, "net modifier")),
    h("details", { id: "why-" + side.role },
      h("summary", {}, "why?"),
      h("ul", { class: "whylist", id: "whylist-" + side.role })),
    h("div", { class: "sub", id: "rr-" + side.role }));

  // dice entry
  card.append(h("div", { class: "grouplabel" }, "Dice (2D6 rolled at the table)"));
  const d1 = makeStepper(0, 6, side.dice[0], v => { side.dice[0] = v; refreshCharge(); });
  const d2 = makeStepper(0, 6, side.dice[1], v => { side.dice[1] = v; refreshCharge(); });
  card.append(h("div", { class: "flagrow" }, d1.el, d2.el));
  return card;
}

function refreshCharge() {
  if (!CH) return;
  Store.set("charge_state", CH);
  const cMods = computeChargeMods(CH.charger, CH.defender);
  const dMods = computeChargeMods(CH.defender, CH.charger);
  const cNet = netOf(cMods), dNet = netOf(dMods);

  for (const [role, mods, net] of [["charger", cMods, cNet], ["defender", dMods, dNet]]) {
    const el = $("#net-" + role);
    if (!el) return;
    el.textContent = fmtMod(net);
    const ul = $("#whylist-" + role);
    ul.innerHTML = "";
    for (const m of mods) ul.append(h("li", {}, m.label, h("b", {}, fmtMod(m.val))));
    if (!mods.length) ul.append(h("li", {}, "no modifiers", h("b", {}, "0")));
    $("#rr-" + role).textContent = "Supports: " + rerollSummary(role === "charger" ? CH.charger : CH.defender);
  }

  // result
  const res = $("#charge-result");
  res.innerHTML = "";
  res.append(h("h2", {}, "Result"));
  const diceOk = CH.charger.dice.every(d => d >= 1) && CH.defender.dice.every(d => d >= 1);
  const colKey = chargeColKey(CH.charger.type, CH.defender.type);

  if (!diceOk) {
    res.append(h("p", { class: "sub" }, "Enter both sides' 2D6 above. Net modifiers update live as you tap."));
    res.append(h("p", { class: "sub" },
      "Charger " + fmtMod(cNet) + " · Defender " + fmtMod(dNet) + " · column: " + COL_LABELS[colKey]));
  } else {
    const cTot = CH.charger.dice[0] + CH.charger.dice[1] + cNet;
    const dTot = CH.defender.dice[0] + CH.defender.dice[1] + dNet;
    const diff = cTot - dTot;
    const band = chargeBand(diff);
    const outcome = band[colKey];
    res.append(
      h("p", { class: "totalsub" },
        "Charger " + (CH.charger.dice[0] + CH.charger.dice[1]) + " " + fmtMod(cNet) + " = " + cTot +
        "  ·  Defender " + (CH.defender.dice[0] + CH.defender.dice[1]) + " " + fmtMod(dNet) + " = " + dTot),
      h("div", { class: "bigdiff " + (diff >= 0 ? "good" : "bad") },
        diff > 0 ? "WON BY " + diff : diff === 0 ? "TIED" : "LOST BY " + (-diff)),
      h("div", { class: "sub" }, COL_LABELS[colKey] + " · row " + band.by),
      h("div", { class: "outcome " + (diff >= 1 ? "good" : "bad") }, outcome));
    if (/Volley!/.test(outcome)) res.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[0]));
    if (/Victory!/.test(outcome)) res.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[1]));
    if (/Melee|Élan/.test(outcome))
      res.append(h("button", { class: "bigbtn", onclick: () => openMelee(CH, outcome) }, "Resolve melee →"));
  }
  res.append(h("button", {
    class: "bigbtn alt", onclick: () => {
      Store.set("rolloff_handoff", {
        type: colKey,
        sides: [
          { name: "Charger", mods: computeChargeMods(CH.charger, CH.defender), supports: CH.charger.supports },
          { name: "Defender", mods: computeChargeMods(CH.defender, CH.charger), supports: CH.defender.supports }
        ]
      });
      buildRolloff(); showTab("rolloff");
    }
  }, "Resolve as Roll-Off 🎲"));

  const holder = $("#charge-table-holder");
  holder.innerHTML = "";
  const band = diceOk ? chargeBand((CH.charger.dice[0] + CH.charger.dice[1] + cNet) - (CH.defender.dice[0] + CH.defender.dice[1] + dNet)) : null;
  holder.append(renderChargeTable(band, colKey));
}
