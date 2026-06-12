/* Charge tab — the full charge in ONE flow (rebuilt per Andy's table
   feedback, 2026-06-13): configure both sides → ROLL in-app (animated
   2D6 per side) → spend support re-roll tokens → doubles flagged with
   their own re-roll → result in big type with nations ("FRANCE WINS
   vs PRUSSIA") and the Charge Results row+column highlighted.
   Manual dice entry stays available for table-rolled dice. */
"use strict";

const GRADES = ["Elite", "Veteran", "Line", "Recruit"];
const GRADE_UP = { Recruit: "Line", Line: "Veteran", Veteran: "Elite", Elite: "Elite" };
const CH_NATIONS = ["France", "Prussia", "Russia"];
const CH_TINT = { France: "#4a6fd4", Prussia: "#8d93a5", Russia: "#2e8b57", "—": "var(--accent)" };

function blankSide(role) {
  return {
    role, nation: "—", type: "inf", grade: "Line", formation: "line", unformed: false,
    garrison: false, mob: false, supports: [], general: false,
    brigade: null, alreadyCas: 0, fireCas: 0,
    chargingOn: false, heavyCav: false, lancers: false, campaignCav: false,
    narrowFront: false, flanked: false, flankRear: false,
    dice: [0, 0]
  };
}

/* effective grade after General attached (test as next grade up) */
function effGrade(side) { return side.general ? GRADE_UP[side.grade] : side.grade; }

/* pure modifier computation → [{label, val, suppressed?}] */
function computeChargeMods(side, opp) {
  const mods = [];
  const isCharger = side.role === "charger";
  const g = effGrade(side);

  let gv = CHARGE_MODS.grade[g];
  let glabel = g + " grade";
  if (g === "Recruit" && (side.formation === "column" || side.formation === "square")) {
    gv = 0; glabel = "Recruit in column/square (penalty waived)";
  }
  if (side.general) glabel = "General attached: test as " + g + (g === side.grade ? " (already top grade)" : "");
  mods.push({ label: glabel, val: gv });

  if (side.unformed) mods.push({ label: "Unformed", val: CHARGE_MODS.formation.unformed });
  if (side.type === "inf" && opp.type === "cav") {
    if (side.formation === "column" || side.formation === "square") {
      // §3.2b interaction logic — enforced, with the reason shown.
      if (side.flankRear) {
        mods.push({ label: "Column/square +2 SUPPRESSED — charged in flank/rear gets no column bonus", val: 0, suppressed: true });
      } else if (side.mob && side.formation === "column") {
        mods.push({ label: "Column +2 SUPPRESSED — column of mob (retiring/routing mass) gets no column bonus", val: 0, suppressed: true });
      } else {
        mods.push({ label: "Infantry column/square vs cavalry", val: CHARGE_MODS.formation.infColumnOrSquareVsCav });
      }
    }
    if (side.formation === "line")
      mods.push({ label: "Infantry line vs cavalry", val: CHARGE_MODS.formation.infLineVsCav });
  }
  if (side.type === "inf" && side.formation === "square" && opp.type === "inf")
    mods.push({ label: "Square vs infantry", val: CHARGE_MODS.formation.squareVsInfantry });
  if (side.type === "cav" && side.narrowFront)
    mods.push({ label: "Cavalry on narrower frontage", val: CHARGE_MODS.formation.cavNarrowerFrontage });

  if (isCharger) {
    if (side.chargingOn) mods.push({ label: "Charging On", val: CHARGE_MODS.charger.chargingOn });
    if (side.type === "cav" && side.heavyCav) mods.push({ label: "Heavy cavalry", val: CHARGE_MODS.charger.heavyCav });
    if (side.type === "cav" && side.lancers && opp.type === "inf")
      mods.push({ label: "Lancers vs infantry", val: CHARGE_MODS.charger.lancersVsInf });
    if (side.type === "cav" && side.campaignCav)
      mods.push({ label: "Campaign cavalry vs Heavy/Battle", val: CHARGE_MODS.charger.campaignCavVsHeavy });
    // Charge casualties come from DEFENSIVE FIRE (closing + supporting
    // fire after the move to 3") — entered as a count, band derived.
    const fc = side.fireCas || 0;
    const band = fc >= 5 ? "5+" : fc >= 3 ? "3-4" : fc === 2 ? "2" : null;
    if (band) {
      const v = CHARGE_MODS.charger.chargeCasualties[band];
      if (band === "2" && g === "Elite" && CHARGE_MODS.charger.chargeCasualties.eliteImmune2) {
        mods.push({ label: "Defensive-fire casualties " + fc + " (Elite — immune to the first band)", val: 0 });
      } else {
        mods.push({ label: "Defensive-fire casualties " + fc + " (band " + band + ")", val: v });
      }
    }
  }

  // fatigue is CUMULATIVE: the charger's defensive-fire casualties
  // count toward its total IMMEDIATELY, so fire can tip the unit over
  // the 4+/8+ threshold for this very test (Andy, 13 Jun).
  const cum = (side.alreadyCas || 0) + (isCharger ? (side.fireCas || 0) : 0);
  if (cum >= 4) {
    const band = cum >= 8 ? "8+" : "4+";
    const src = isCharger && side.fireCas
      ? cum + " total casualties (" + (side.alreadyCas || 0) + " before + " + side.fireCas + " from defensive fire)"
      : cum + " casualties on unit";
    mods.push({ label: src + " — fatigue " + band, val: CHARGE_MODS.charger.unitCasualties[band] });
  }
  if (side.brigade) mods.push({ label: "Brigade " + side.brigade, val: CHARGE_MODS.charger.brigadeState[side.brigade] });

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

function sideName(side) {
  return side.nation !== "—" ? side.nation.toUpperCase()
    : side.role === "charger" ? "CHARGER" : "DEFENDER";
}

/* ---------- melee queue — charges bank here, the Melee phase drains it.
   GdA resolves all melees at the end of the turn; a big turn can bank
   two or three charges (multiple brigades, town assaults) and resolve
   them in order without losing any charge's context. ---------- */
const MeleeQueue = {
  all() { return Store.get("melee_queue", []); },
  add(entry) { const q = MeleeQueue.all(); q.push(entry); Store.set("melee_queue", q); },
  remove(id) { Store.set("melee_queue", MeleeQueue.all().filter(e => e.id !== id)); },
  clear() { Store.del("melee_queue"); }
};

/* ---------- state ---------- */
let CH;       // {charger, defender}
let CHR;      // roll runtime: {rolled:{}, dieApis:{}, spent flags, logged}

/* called by the Fire tab's defensive-fire tally — keeps the charger's
   fire-casualty count in step with the running total over there */
function setChargeFireCas(total) {
  if (!CH) return;
  CH.charger.fireCas = total;
  Store.set("charge_state", CH);
  // rebuild only if the charge hasn't been rolled yet (defensive fire
  // precedes the test; post-roll the dice stand)
  if (!CHR || (!CHR.rolled.charger && !CHR.rolled.defender)) buildCharge();
  else refreshCharge();
}

function chrReset() {
  CHR = { rolled: { charger: false, defender: false }, dieApis: {}, rerolls: [], logged: false };
  CH.charger.dice = [0, 0];
  CH.defender.dice = [0, 0];
  CH.charger.supports.forEach(s => s.spent = false);
  CH.defender.supports.forEach(s => s.spent = false);
}

function buildCharge() {
  CH = Store.get("charge_state", null) || { charger: blankSide("charger"), defender: blankSide("defender") };
  CH.charger.role = "charger"; CH.defender.role = "defender";
  // migrate pre-13-Jun saved state: band string → casualty count
  if (CH.charger.fireCas === undefined) {
    CH.charger.fireCas = { "2": 2, "3-4": 3, "5+": 5 }[CH.charger.chargeCas] || 0;
    delete CH.charger.chargeCas;
  }
  // migrate band-chip fatigue → numeric (fatigue is CUMULATIVE with
  // this charge's fire casualties — needs a real number to add to)
  for (const s of [CH.charger, CH.defender]) {
    if (s.alreadyCas === undefined) {
      s.alreadyCas = { "4+": 4, "8+": 8 }[s.unitCas] || 0;
      delete s.unitCas;
    }
  }
  // session-scoped roll state never persists (dice can't be replayed from storage)
  chrReset();

  const root = $("#tab-charge");
  root.innerHTML = "";
  root.append(
    h("div", { class: "duelgrid" },
      chargeSideCard(CH.charger, CH.defender),
      chargeSideCard(CH.defender, CH.charger)),
    h("div", { class: "card", id: "charge-fire-stage" },
      h("h2", {}, "Defensive fire — before the test"),
      h("p", { class: "note" },
        "Chargers are at the 3\" point; reactions are done (square test / opportunity charge). " +
        "Now the defender's CLOSING and SUPPORTING fire happens: a screened target's whole skirmish " +
        "screen evades and fires first (vs infantry only), then close-order defensive fire. " +
        "ALL casualties — screen plus close order — count toward the charger's test."),
      h("button", { class: "bigbtn alt", onclick: () => showTab("fire") }, "Resolve each firer on the Fire tab → (tally feeds back here)"),
      (() => {
        const tally = Store.get("deffire_tally", []);
        if (!tally.length) return null;
        const box = h("div", { class: "note" },
          h("b", {}, "Fire-tab tally: "),
          tally.map(e => e.cas + " (" + e.label + ")").join(" + ") + " = " +
          tally.reduce((a, e) => a + e.cas, 0) + " — fed into the counter below. ",
          h("button", {
            class: "chip neg", onclick: () => {
              Store.del("deffire_tally");
              CH.charger.fireCas = 0; Store.set("charge_state", CH);
              buildCharge();
            }
          }, "clear"));
        return box;
      })(),
      h("div", { class: "flagrow" },
        h("span", { class: "sub", style: "max-width:180px;" }, "Casualties taken by the CHARGER from defensive fire (all firers combined)"),
        makeStepper(0, 15, CH.charger.fireCas || 0, v => { CH.charger.fireCas = v; refreshCharge(); }).el),
      h("div", { class: "sub", id: "firecas-derived" }),
      h("p", { class: "sub" }, "Fatigue is CUMULATIVE: these fire casualties also add to the charger's \"already on unit\" total automatically — if they tip it past 4+ or 8+, the fatigue penalty applies to this same test (see the why-list).")),
    h("div", { class: "card", id: "charge-roll-card" },
      h("h2", {}, "Roll the charge"),
      h("div", { class: "duelgrid" },
        rollPanel(CH.charger), rollPanel(CH.defender)),
      h("button", { class: "bigbtn", id: "charge-roll-btn", onclick: rollCharge }, "⚔️ ROLL THE CHARGE — both sides 2D6"),
      h("button", {
        class: "bigbtn alt", id: "charge-new-btn", style: "display:none", onclick: () => {
          // Charge On / echelon: the attacker fights on — keep his
          // whole setup, but defensive-fire casualties are per-charge
          // and the new target is configured from blank.
          CH.charger.fireCas = 0;
          CH.defender = blankSide("defender");
          Store.set("charge_state", CH);
          chrReset(); buildCharge();
        }
      }, "New charge — same attacker, new target"),
      h("button", {
        class: "bigbtn alt", id: "charge-clear-btn", style: "display:none", onclick: () => {
          CH = { charger: blankSide("charger"), defender: blankSide("defender") };
          Store.set("charge_state", CH);
          chrReset(); buildCharge();
        }
      }, "New charge — DIFFERENT troops (clear both sides)"),
      h("details", {},
        h("summary", {}, "dice were rolled on the table — enter them instead"),
        manualDiceRow(CH.charger), manualDiceRow(CH.defender))),
    h("div", { class: "card resultpanel", id: "charge-result" }),
    h("div", { class: "card", id: "melee-queue-card", style: "display:none" }),
    h("div", { class: "card", id: "charge-table-card" },
      h("h2", {}, "Charge results"),
      h("div", { id: "charge-table-holder" }),
      h("details", {},
        h("summary", {}, "Common mistakes (FAQ)"),
        ...CHARGE_RESULT_NOTES.map(n => h("p", { class: "note" }, n))),
      h("details", {},
        h("summary", {}, "Interaction logic the calculator enforces"),
        ...CHARGE_LOGIC.map(n => h("p", { class: "note" }, n))),
      h("details", {},
        h("summary", {}, "Supports & re-rolls — the rules"),
        h("p", { class: "note" }, CHARGE_MODS.supports))));
  refreshCharge();

  indexCard("charge", "charge-table-card", "Charge results table",
    CHARGE_RESULTS.map(r => r.by + " " + r.infVsInfArty + " " + r.cavVsCav + " " + r.cavVsInfArty).join(" ")
    + " " + CHARGE_RESULT_NOTES.join(" ") + " " + CHARGE_MODS.supports + " destiny blunder double");
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

  card.append(h("div", { class: "grouplabel" }, "Nation (for the result banner)"));
  card.append(singleSelect(CH_NATIONS.map(n => ({ v: n, l: n, allowOff: true })), side.nation === "—" ? null : side.nation,
    v => { side.nation = v || "—"; refreshCharge(); }));

  card.append(h("div", { class: "grouplabel" }, "Type"));
  const types = [{ v: "inf", l: "Infantry" }, { v: "cav", l: "Cavalry" }];
  if (!isC) types.push({ v: "arty", l: "Artillery" });
  card.append(singleSelect(types, side.type, v => { side.type = v || side.type; refreshCharge(); }));

  card.append(h("div", { class: "grouplabel" }, "Grade"));
  card.append(singleSelect(GRADES.map(g => ({ v: g, l: g })), side.grade, v => { side.grade = v || side.grade; refreshCharge(); }));

  card.append(h("div", { class: "grouplabel" }, "Formation"));
  const forms = [{ v: "line", l: "Line" }, { v: "column", l: "Column" }, { v: "square", l: "Square" }, { v: "garrison", l: "Garrison (BUA)" }];
  card.append(singleSelect(forms, side.formation, v => { side.formation = v || side.formation; refreshCharge(); }));
  const unfChip = makeChip("Unformed", "−2", on => { side.unformed = on; refreshCharge(); }, { neg: true });
  if (side.unformed) unfChip.classList.add("on");
  card.append(h("div", { class: "chips" }, unfChip));

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
    while (side.supports.length < v) side.supports.push({ degraded: false, spent: false });
    side.supports.length = v;
    renderSups(); refreshCharge();
  });
  card.append(h("div", { class: "flagrow" }, supStep.el, h("span", { class: "sub" }, "tap a support to mark degraded")));
  renderSups();
  card.append(supHolder);

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
    tog("Column of mob", "no col bonus", "mob", true);
    tog("Narrower frontage", "−1 cav", "narrowFront", true);
  }
  card.append(sit);
  card.append(h("div", { class: "sub", id: "suppress-" + side.role, style: "color:var(--warn);" }));

  card.append(h("div", { class: "grouplabel" }, "Brigade state"));
  card.append(singleSelect(
    [{ v: "hesitant", l: "Hesitant", sub: "−1", allowOff: true }, { v: "faltering", l: "Faltering", sub: "−1", allowOff: true }, { v: "demoralised", l: "Demoralised", sub: "−1", allowOff: true }],
    side.brigade, v => { side.brigade = v; refreshCharge(); }));

  card.append(h("div", { class: "grouplabel" }, "Casualties ALREADY on unit (fatigue total before this charge)"));
  card.append(h("div", { class: "flagrow" },
    makeStepper(0, 20, side.alreadyCas || 0, v => { side.alreadyCas = v; refreshCharge(); }).el,
    h("span", { class: "sub" }, "4+ = −1 · 8+ = −2" + (isC ? " — this charge's fire casualties ADD to this automatically (cumulative)" : ""))));
  // charge casualties from defensive fire are entered in the
  // "Defensive fire" stage of the roll card, not here — they don't
  // exist until the fire has happened.

  card.append(
    h("div", { class: "netrow" },
      h("span", { class: "netmod", id: "net-" + side.role }, "+0"),
      h("span", { class: "sub" }, "net modifier")),
    h("details", { id: "why-" + side.role },
      h("summary", {}, "why?"),
      h("ul", { class: "whylist", id: "whylist-" + side.role })),
    h("div", { class: "sub", id: "rr-" + side.role }));
  return card;
}

/* ---------- roll flow ---------- */

function rollPanel(side) {
  const box = h("div", { style: "text-align:center;" });
  box.append(
    h("div", { class: "grouplabel", id: "rolllabel-" + side.role }, side.role),
    h("div", { class: "dicepair", "data-ch-dice": side.role }),
    h("div", { class: "totalbig", "data-ch-total": side.role }, ""),
    h("div", { class: "totalsub", "data-ch-sub": side.role }, ""),
    h("div", { "data-ch-double": side.role }),
    h("div", { class: "chips", style: "justify-content:center;", "data-ch-tokens": side.role }));
  return box;
}

function manualDiceRow(side) {
  const d1 = makeStepper(0, 6, 0, v => { side.dice[0] = v; CHR.rolled[side.role] = side.dice.every(d => d >= 1); refreshCharge(); });
  const d2 = makeStepper(0, 6, 0, v => { side.dice[1] = v; CHR.rolled[side.role] = side.dice.every(d => d >= 1); refreshCharge(); });
  return h("div", { class: "flagrow" }, h("span", { class: "sub", style: "width:90px;" }, side.role), d1.el, d2.el);
}

function rollCharge() {
  if (CHR.rolled.charger || CHR.rolled.defender) return;
  for (const side of [CH.charger, CH.defender]) {
    const wrap = $('[data-ch-dice="' + side.role + '"]');
    wrap.innerHTML = "";
    const red = side.role === "defender";
    CHR.dieApis[side.role] = [makeDie(red), makeDie(red)];
    wrap.append(CHR.dieApis[side.role][0].el, CHR.dieApis[side.role][1].el);
  }
  $("#charge-roll-btn").style.display = "none";
  $("#charge-new-btn").style.display = "block";
  $("#charge-clear-btn").style.display = "block";
  // setTimeout, NOT requestAnimationFrame: rAF is suspended in hidden/
  // backgrounded tabs, which left the roll permanently stuck.
  setTimeout(() => {
    for (const side of [CH.charger, CH.defender]) {
      side.dice = [CHR.dieApis[side.role][0].roll(d6()), CHR.dieApis[side.role][1].roll(d6())];
      CHR.rolled[side.role] = true;
    }
    setTimeout(refreshCharge, 650);
  }, 50);
}

function chTokens(side) {
  const wrap = $('[data-ch-tokens="' + side.role + '"]');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!CHR.rolled[side.role]) return;
  side.supports.forEach(sp => {
    const tok = h("button", { class: "token" + (sp.spent ? " spent" : "") },
      h("span", { class: "mini" }), "re-roll" + (sp.degraded ? " −1" : ""));
    tok.addEventListener("click", () => { if (!sp.spent) chSpendToken(side, sp, tok); });
    wrap.append(tok);
  });
}

function chSpendToken(side, sp, tok) {
  const pick = h("div", { class: "chips", style: "justify-content:center;" },
    h("span", { class: "sub" }, "Re-roll which die?"),
    h("button", { class: "chip" }, "Die 1 (" + side.dice[0] + ")"),
    h("button", { class: "chip" }, "Die 2 (" + side.dice[1] + ")"),
    h("button", { class: "chip neg" }, "cancel"));
  tok.after(pick);
  const btns = $$("button.chip", pick);
  const doRe = idx => {
    pick.remove();
    sp.spent = true;
    let v = d6();
    if (sp.degraded) v = Math.max(1, v - 1);
    const apis = CHR.dieApis[side.role];
    if (apis) { apis[idx].roll(v); apis[idx].mark(sp.degraded); }
    side.dice[idx] = v;   // the new face STANDS
    CHR.rerolls.push(side.role + " die" + (idx + 1) + "→" + v + (sp.degraded ? " (−1)" : ""));
    setTimeout(refreshCharge, 650);
  };
  btns[0].addEventListener("click", () => doRe(0));
  btns[1].addEventListener("click", () => doRe(1));
  btns[2].addEventListener("click", () => pick.remove());
}

/* Destiny / blunder doubles — the SPEC defines that double 6 on an
   initial 2D6 is Destiny but NOT its effect, and does not define
   double 1. Flag both, offer the re-roll Andy wants, point at the
   umpire for the effect. Never invent rules content. */
function chDoubles(side) {
  const holder = $('[data-ch-double="' + side.role + '"]');
  if (!holder) return;
  holder.innerHTML = "";
  if (!CHR.rolled[side.role]) return;
  const [a, b] = side.dice;
  if (a !== b || (a !== 1 && a !== 6)) return;
  const label = a === 6 ? "⚡ DOUBLE 6 — DESTINY!" : "💀 DOUBLE 1 — blunder!";
  holder.append(
    h("div", { class: "trigbanner flash", style: "margin:6px 0;" }, label + " Effect: ask the umpire."),
    h("button", {
      class: "bigbtn alt", style: "min-height:46px;margin:4px 0;", onclick: () => {
        const apis = CHR.dieApis[side.role];
        const v1 = d6(), v2 = d6();
        if (apis) { apis[0].roll(v1); apis[1].roll(v2); }
        side.dice = [v1, v2];
        CHR.rerolls.push(side.role + " " + label.replace(/[⚡💀] /, "") + " re-roll → " + v1 + "+" + v2);
        setTimeout(refreshCharge, 650);
      }
    }, "Re-roll this side's 2D6 (result will be highlighted)"));
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
    for (const m of mods) {
      const li = h("li", {}, m.label, h("b", {}, fmtMod(m.val)));
      if (m.suppressed) li.style.opacity = ".55";
      ul.append(li);
    }
    if (!mods.length) ul.append(h("li", {}, "no modifiers", h("b", {}, "0")));
    $("#rr-" + role).textContent = "Supports: " + rerollSummary(role === "charger" ? CH.charger : CH.defender);
    const supNote = $("#suppress-" + role);
    if (supNote) {
      const sup = mods.filter(m => m.suppressed);
      supNote.textContent = sup.length ? "⚠ " + sup.map(m => m.label).join(" · ") : "";
    }
  }

  // defensive-fire derived band readout
  const fcEl = $("#firecas-derived");
  if (fcEl) {
    const fc = CH.charger.fireCas || 0;
    let mod = fc >= 5 ? -3 : fc >= 3 ? -2 : fc === 2 ? -1 : 0;
    let note = "";
    if (fc === 2 && effGrade(CH.charger) === "Elite") { mod = 0; note = " (Elite shrugs the first band)"; }
    fcEl.textContent = fc <= 1 ? "0–1 casualties → no penalty on the test."
      : fc + " casualties → " + (mod ? fmtMod(mod) : "no penalty") + " on the charge test" + note + ".";
  }

  // roll panels
  for (const [side, net] of [[CH.charger, cNet], [CH.defender, dNet]]) {
    const lab = $("#rolllabel-" + side.role);
    if (lab) lab.textContent = sideName(side) + "  (" + fmtMod(net) + ")";
    const tot = $('[data-ch-total="' + side.role + '"]');
    const sub = $('[data-ch-sub="' + side.role + '"]');
    if (tot && CHR.rolled[side.role]) {
      tot.textContent = String(side.dice[0] + side.dice[1] + net);
      sub.textContent = side.dice[0] + " + " + side.dice[1] + "  " + fmtMod(net) + " mod";
    } else if (tot) { tot.textContent = ""; sub.textContent = ""; }
    chTokens(side);
    chDoubles(side);
  }

  // result
  const res = $("#charge-result");
  if (!res) return;
  res.innerHTML = "";
  res.append(h("h2", {}, "Result"));
  const colKey = chargeColKey(CH.charger.type, CH.defender.type);
  const diceOk = CHR.rolled.charger && CHR.rolled.defender
    && CH.charger.dice.every(d => d >= 1) && CH.defender.dice.every(d => d >= 1);

  let band = null;
  if (!diceOk) {
    res.append(h("p", { class: "sub" }, "Set both sides up, then ROLL THE CHARGE. " +
      "Net: " + sideName(CH.charger) + " " + fmtMod(cNet) + " · " + sideName(CH.defender) + " " + fmtMod(dNet) +
      " · column: " + COL_LABELS[colKey]));
  } else {
    const cTot = CH.charger.dice[0] + CH.charger.dice[1] + cNet;
    const dTot = CH.defender.dice[0] + CH.defender.dice[1] + dNet;
    const diff = cTot - dTot;
    band = chargeBand(diff);
    const outcome = band[colKey];
    const winnerSide = diff > 0 ? CH.charger : diff < 0 ? CH.defender : null;

    if (winnerSide) {
      const loserSide = winnerSide === CH.charger ? CH.defender : CH.charger;
      res.append(h("div", {
        class: "bigdiff", style: "color:" + CH_TINT[winnerSide.nation]
      }, sideName(winnerSide) + " WINS"));
      res.append(h("div", { class: "sub" },
        "vs " + sideName(loserSide) + " · by " + Math.abs(diff) + " · " +
        cTot + " plays " + dTot + " · " + COL_LABELS[colKey] + " row " + band.by));
    } else {
      res.append(h("div", { class: "bigdiff" }, "TIED"), h("div", { class: "sub" }, cTot + " apiece — row " + band.by));
    }
    res.append(h("div", { class: "outcome " + (diff >= 1 ? "good" : "bad") }, outcome));
    if (/Volley!/.test(outcome)) res.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[0]));

    /* ---- follow-up actions the result demands, right here ---- */
    if (/Victory!/.test(outcome) && winnerSide === CH.charger) {
      const isCav = CH.charger.type === "cav";
      res.append(h("p", { class: "note" },
        "Victory! — the winner MUST now choose: Charge On (" + (isCav ? "+5D6\"" : "+3D6\"") + ") or Take Ground." +
        (colKey === "cavVsInfArty" ? " This result also costs the winner 1 casualty; the defender is Ridden Down." : "")));
      const chargeOnBtn = h("button", {
        class: "bigbtn", onclick: () => {
          const n = isCav ? 5 : 3;
          const rolls = Array.from({ length: n }, () => d6());
          const dist = rolls.reduce((a, b) => a + b, 0);
          buzz(30);
          const resultRow = h("div", {},
            h("div", { class: "outcome good" }, "CHARGE ON: " + n + "D6 → " + rolls.join("+") + " = +" + dist + "\" move"),
            h("button", {
              class: "bigbtn", onclick: () => {
                CH.charger.chargingOn = true;       // +1 on the follow-on test
                CH.charger.fireCas = 0;             // new target's fire hasn't happened
                CH.defender = blankSide("defender");
                Store.set("charge_state", CH);
                chrReset(); buildCharge();
              }
            }, "Set up the follow-on charge → (Charging On +1 pre-ticked)"));
          chargeOnBtn.replaceWith(resultRow);
          takeGroundBtn.remove();
        }
      }, "⚡ CHARGE ON — roll the " + (isCav ? "5D6\"" : "3D6\"") + " now");
      const takeGroundBtn = h("button", {
        class: "bigbtn alt", onclick: () => {
          takeGroundBtn.replaceWith(h("p", { class: "outcome good" }, "TAKE GROUND — occupy the beaten enemy's position. Charge complete."));
          chargeOnBtn.remove();
        }
      }, "🚩 TAKE GROUND — occupy their position, stop there");
      res.append(chargeOnBtn, takeGroundBtn);
    }
    if (/Rout 1D6/.test(outcome)) {
      const b = h("button", {
        class: "bigbtn alt", onclick: () => {
          const v = d6(); buzz(20);
          b.replaceWith(h("p", { class: "outcome bad" }, "Defender's rout roll: 1D6 → " + v));
        }
      }, "Roll the defender's rout (1D6)");
      res.append(b);
    }
    if (/Retreat 1D3/.test(outcome)) {
      const who = /Def Retreat/.test(outcome) ? "defender's" : "loser's";
      const b = h("button", {
        class: "bigbtn alt", onclick: () => {
          const v = Math.ceil(d6() / 2); buzz(20);
          b.replaceWith(h("p", { class: "outcome bad" }, "The " + who + " retreat roll: 1D3 → " + v));
        }
      }, "Roll the " + who + " retreat (1D3)");
      res.append(b);
    }
    if (/Melee|Élan/.test(outcome)) {
      res.append(h("button", { class: "bigbtn", onclick: () => openMelee(CH, outcome) }, "Resolve melee now →"));
      res.append(h("button", {
        class: "bigbtn alt", onclick: ev => {
          MeleeQueue.add({
            id: "mq" + Date.now().toString(36),
            label: sideName(CH.charger) + " vs " + sideName(CH.defender) + " — " + outcome +
              " (won by " + Math.abs(diff) + ")",
            outcome,
            chargeState: JSON.parse(JSON.stringify({ charger: CH.charger, defender: CH.defender }))
          });
          ev.target.textContent = "✓ banked — set up the next charge";
          ev.target.disabled = true;
          refreshCharge();
        }
      }, "🕐 Bank for the Melee phase (fight it at end of turn)"));
    }
    if (!CHR.logged) {
      res.append(h("button", {
        class: "bigbtn alt", onclick: ev => {
          CHR.logged = true;
          SessionLog.add({
            kind: "duel",
            detail: sideName(CH.charger) + " " + CH.charger.dice.join("+") + fmtMod(cNet) + "=" + cTot +
              " vs " + sideName(CH.defender) + " " + CH.defender.dice.join("+") + fmtMod(dNet) + "=" + dTot +
              (CHR.rerolls.length ? " [" + CHR.rerolls.join("; ") + "]" : ""),
            winner: winnerSide ? sideName(winnerSide) : "tie",
            result: outcome
          });
          ev.target.textContent = "✓ logged";
          ev.target.disabled = true;
        }
      }, "Log this charge"));
    }
  }

  const holder = $("#charge-table-holder");
  holder.innerHTML = "";
  holder.append(renderChargeTable(band, colKey));

  // melee-phase queue card
  const mq = $("#melee-queue-card");
  if (mq) {
    const q = MeleeQueue.all();
    mq.style.display = q.length ? "block" : "none";
    mq.innerHTML = "";
    if (q.length) {
      mq.append(h("h2", {}, "Melee phase — " + q.length + " pending"),
        h("p", { class: "sub" }, "All melees fight at the end of the turn. Each carries its charge context (Élan, Unformed, supports, nations) — resolve them in any order."));
      q.forEach((e, i) => {
        mq.append(h("div", { class: "flagrow", style: "border-bottom:1px dashed var(--line);padding:6px 0;" },
          h("span", { class: "sub", style: "flex:1;" }, (i + 1) + ". " + e.label),
          h("button", { class: "chip on", onclick: () => openMeleeBanked(e) }, "Resolve →"),
          h("button", { class: "chip neg", onclick: () => { MeleeQueue.remove(e.id); refreshCharge(); } }, "✕")));
      });
    }
  }
}
