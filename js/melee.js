/* Melee round resolver — §10.6 VERIFIED.
   CD per unit computed from base type (Inf/Cav 5, Cossack 4, Arty 3,
   hits on 4–6, min 1 after mods) + MELEE_MODS chips. Élan applies to
   lead AND all supports (one toggle). 'Attacked in flank/rear'
   auto-enforces ONLY-NEGATIVES. Winner = most casualties caused (one
   combined comparison) → MELEE_RESULTS band for the matchup. Pyrrhic
   Victory flip applied automatically. */
"use strict";

let MEL = null;

const MEL_TYPES = [["infantry", "Inf"], ["cavalry", "Cav"], ["cossacks", "Cossack"], ["artillery", "Arty"]];
const MEL_UNIT_CHIPS = [
  { id: "elite",   label: "Elite",                       cd: +1 },
  { id: "heavy",   label: "Heavy cavalry",               cd: +2 },
  { id: "lancerC", label: "Formed lancers vs cav",       cd: +1, note: "n/a vs Cuirassiers" },
  { id: "lancerF", label: "Formed lancers vs foot",      cd: +2 },
  { id: "large",   label: "Large unit",                  cd: +1, note: "n/a col-of-coys/square/battery" },
  { id: "small",   label: "Small unit",                  cd: -1 },
  { id: "glory",   label: "General + Glory!",            cd: +1 },
  { id: "unf",     label: "Unformed",                    cd: -1 },
  { id: "bua1",    label: "Attacking BUA (1st round)",   cd: -1 },
  { id: "strong",  label: "Attacking strongpoint",       cd: -1 },
  { id: "redoubt", label: "Redoubt / up steep slope",    cd: -1 },
  { id: "cas4",    label: "4+ casualties",               cd: -1 },
  { id: "cas8",    label: "8+ casualties (10+ El/Lg)",   cd: -2 }
];

function meleeUnitInit(label, lead) {
  return { label, lead, inFight: !!lead, type: "infantry", chips: [], gradeAbove: 0, flankRear: false };
}
function meleeSideInit(name, supports, preset) {
  const side = {
    name, elan: false, elanAttackCol: false, cas: 0, curCas: 0, dispPt: 12,
    units: [meleeUnitInit(name + " lead", true)]
      .concat((supports || []).map((s, i) => meleeUnitInit("Support " + (i + 1) + (s.degraded ? " (degraded)" : ""), false)))
  };
  if (preset) {
    if (preset.leadType) side.units[0].type = preset.leadType;
    if (preset.elan) side.elan = true;
    if (preset.leadUnformed) side.units[0].chips.push("unf");
  }
  return side;
}

/* what the charge RESULT means for melee round 1 — carried, not re-keyed */
function meleeCarryFromOutcome(outcome) {
  const carry = { chargerElan: false, chargerUnformed: false, defenderUnformed: false };
  if (!outcome) return carry;
  if (/^Élan/.test(outcome)) carry.chargerElan = true;            // "Élan / Def Melee Unformed"
  if (/Def Melee Unformed/.test(outcome)) carry.defenderUnformed = true;
  if (/^Melee Unformed/.test(outcome)) carry.chargerUnformed = true; // "Melee Unformed / C-charge"
  return carry;
}
const meleeTypeOf = t => t === "cav" ? "cavalry" : t === "arty" ? "artillery" : "infantry";

function unitCD(u, side) {
  if (!u.inFight) return 0;
  let pos = 0, neg = 0;
  const add = v => { if (v > 0) pos += v; else neg += v; };
  for (const id of u.chips) {
    const c = MEL_UNIT_CHIPS.find(x => x.id === id);
    if (c) add(c.cd);
  }
  add(u.gradeAbove);                       // +1 per grade above opponent
  if (side.elan) add(side.elanAttackCol && u.type === "infantry" ? 2 : 1);
  if (u.flankRear) { neg += -1; pos = 0; } // −1 AND only negatives apply
  const base = MELEE_CD[u.type] || 5;
  return Math.max(1, base + pos + neg);    // min 1 CD after modifiers
}

function openMelee(chargeState, fromOutcome, bankId) {
  const carry = meleeCarryFromOutcome(fromOutcome);
  const cName = chargeState && chargeState.charger.nation && chargeState.charger.nation !== "—" ? chargeState.charger.nation : "Charger";
  const dName = chargeState && chargeState.defender.nation && chargeState.defender.nation !== "—" ? chargeState.defender.nation : "Defender";
  MEL = {
    round: 1, fromOutcome: fromOutcome || null, matchup: "cavCavInfInf", bankId: bankId || null,
    sides: [
      meleeSideInit(cName, chargeState ? chargeState.charger.supports : [],
        { leadType: chargeState ? meleeTypeOf(chargeState.charger.type) : null, elan: carry.chargerElan, leadUnformed: carry.chargerUnformed }),
      meleeSideInit(dName, chargeState ? chargeState.defender.supports : [],
        { leadType: chargeState ? meleeTypeOf(chargeState.defender.type) : null, leadUnformed: carry.defenderUnformed })
    ]
  };
  if (chargeState) {
    if (chargeState.charger.type === "cav" && chargeState.defender.type !== "cav") MEL.matchup = "cavVsInf";
    if (chargeState.defender.formation === "garrison") MEL.matchup = "infVsBUA";
  }
  renderMelee();
}

/* re-open a melee banked from an earlier charge this turn */
function openMeleeBanked(entry) {
  openMelee(entry.chargeState, entry.outcome, entry.id);
}

function meleePanel() {
  let p = $("#meleepanel");
  if (!p) {
    p = h("div", { id: "meleepanel" });
    Object.assign(p.style, { position: "fixed", inset: "0", zIndex: "55", background: "var(--bg)", overflowY: "auto", padding: "12px", display: "none" });
    document.body.append(p);
  }
  return p;
}

function renderMelee() {
  const p = meleePanel();
  p.style.display = "block";
  p.innerHTML = "";
  const wrap = h("div", { style: "max-width:760px;margin:0 auto;" });
  p.append(wrap);

  const head = h("div", { class: "card" },
    h("div", { class: "flagrow", style: "justify-content:space-between;" },
      h("h2", { style: "margin:0;" }, "Melee — round " + MEL.round),
      h("button", { class: "iconbtn", onclick: () => { p.style.display = "none"; } }, "✕")),
    MEL.fromOutcome ? h("p", { class: "sub" }, "From charge result: " + MEL.fromOutcome) : null,
    h("p", { class: "note" }, MEL.round === 1
      ? "Round 1: lead unit + flank supports that PHYSICALLY reached base-to-base. Rear supports never fight round 1."
      : "Round 2+: any FORMED, IN-COMMAND unit within support distance (cavalry 10\") may reinforce — even if it moved a full move this turn."));

  // matchup pick (drives the results bands)
  const seg = h("div", { class: "seg" });
  for (const [k, l] of Object.entries(MELEE_MATCHUPS)) {
    const b = h("button", { class: MEL.matchup === k ? "on" : "" }, l);
    b.addEventListener("click", () => { MEL.matchup = k; renderMelee(); });
    seg.append(b);
  }
  head.append(h("div", { class: "grouplabel" }, "Matchup (results column)"), seg);
  wrap.append(head);

  for (const side of MEL.sides) wrap.append(meleeSideCard(side));
  wrap.append(h("div", { class: "card resultpanel", id: "melee-result" }));
  meleeResult();
}

function meleeSideCard(side) {
  const card = h("div", { class: "card sidecard" + (side.name === "Defender" ? " def" : "") });
  card.append(h("h2", {}, side.name));

  for (const u of side.units) {
    const box = h("div", { style: "border-bottom:1px dashed var(--line);padding:8px 0;" });
    const fight = h("button", {
      class: "chip" + (u.inFight ? " on" : ""),
      onclick: ev => {
        if (u.lead) return;
        u.inFight = !u.inFight; ev.currentTarget.classList.toggle("on");
        meleeResult(); buzz(12);
      }
    }, u.lead ? "Lead (always fights)" : u.label,
      !u.lead ? h("small", {}, MEL.round === 1 ? "reached contact?" : "joins?") : null);
    const cdBadge = h("b", { style: "margin-left:auto;font-size:18px;", "data-cd": "1" }, "");
    box.append(h("div", { class: "flagrow" }, fight, cdBadge));

    // type
    const tseg = h("div", { class: "seg" });
    for (const [tk, tl] of MEL_TYPES) {
      const b = h("button", { class: u.type === tk ? "on" : "", style: "min-height:40px;" }, tl + " " + MELEE_CD[tk]);
      b.addEventListener("click", () => { u.type = tk; renderMelee(); });
      tseg.append(b);
    }
    box.append(tseg);

    // chips
    const cw = h("div", { class: "chips" });
    for (const c of MEL_UNIT_CHIPS) {
      const on = u.chips.includes(c.id);
      const chip = h("button", { class: "chip" + (on ? " on" : "") + (c.cd < 0 ? " neg" : "") },
        c.label, h("small", {}, (c.cd > 0 ? "+" : "") + c.cd + (c.note ? " · " + c.note : "")));
      chip.addEventListener("click", () => {
        const i = u.chips.indexOf(c.id);
        if (i >= 0) { u.chips.splice(i, 1); chip.classList.remove("on"); }
        else { u.chips.push(c.id); chip.classList.add("on"); }
        meleeResult(); buzz(10);
      });
      cw.append(chip);
    }
    // flank/rear (only-negatives) + grade-above stepper
    const fr = makeChip("Attacked in flank/rear", "−1, ONLY negatives count", on => { u.flankRear = on; meleeResult(); }, { neg: true });
    if (u.flankRear) fr.classList.add("on");
    cw.append(fr);
    box.append(cw);
    box.append(h("div", { class: "flagrow" },
      h("span", { class: "sub" }, "grades above opponent"),
      makeStepper(0, 3, u.gradeAbove, v => { u.gradeAbove = v; meleeResult(); }).el));
    u._cdBadge = cdBadge;
    card.append(box);
  }

  // Converging charges (e.g. a town assault from several brigades)
  // fight as ONE combined melee — extra leads join here in round 1.
  card.append(h("button", {
    class: "bigbtn alt", style: "min-height:44px;", onclick: () => {
      const u = meleeUnitInit(side.name + " unit " + (side.units.length + 1) + (MEL.round > 1 ? " (R" + MEL.round + ")" : ""), false);
      u.inFight = MEL.round === 1;   // round 1: joins now; later rounds: toggle like a reinforcement
      side.units.push(u);
      renderMelee();
    }
  }, "➕ add another unit (converging charge)"));

  const elan = makeChip("Élan", "+1 lead + ALL supports", on => { side.elan = on; meleeResult(); });
  if (side.elan) elan.classList.add("on");
  const eac = makeChip("…infantry in Attack Column", "+2 instead", on => { side.elanAttackCol = on; meleeResult(); });
  if (side.elanAttackCol) eac.classList.add("on");
  card.append(h("div", { class: "chips" }, elan, eac));

  // damage DEALT: roll this side's CD pool — in-app (auto-counted) or
  // from table dice via the stepper. Winner = most casualties caused.
  card.append(h("div", { class: "grouplabel" }, "Damage DEALT by " + side.name + " (round " + MEL.round + ")"));
  const facesRow = h("div", { class: "chips" });
  if (side._faces) {
    for (const f of side._faces)
      facesRow.append(h("span", { class: "token" + (f >= 4 ? "" : " spent"), style: "min-height:36px;" },
        h("span", { class: "mini" }), f + (f >= 4 ? " hit" : "")));
  }
  card.append(h("button", {
    class: "bigbtn", style: "min-height:46px;", onclick: () => {
      const cd = side.units.reduce((t, u) => t + unitCD(u, side), 0);
      side._faces = Array.from({ length: cd }, () => d6());
      side._rolledCD = cd;
      side.cas = side._faces.filter(f => f >= 4).length;
      buzz(25);
      renderMelee();
    }
  }, "🎲 Roll " + side.name + "'s CD — hits (4–6) counted for you"));
  card.append(facesRow);
  card.append(h("div", { class: "flagrow" },
    h("span", { class: "sub", style: "max-width:170px;" }, "casualties INFLICTED on the enemy (or enter from table dice)"),
    makeStepper(0, 20, side.cas, v => { side.cas = v; side._faces = null; meleeResult(); }).el));

  card.append(h("div", { class: "grouplabel" }, "Pyrrhic check — casualties ON " + side.name + "'s own force"));
  card.append(h("p", { class: "sub" }, "Their own accumulated total (including this round's losses) vs their dispersal point — reaching it while winning FLIPS the result."));
  card.append(h("div", { class: "flagrow" },
    h("span", { class: "sub", style: "width:130px;" }, "own casualties NOW"),
    makeStepper(0, 30, side.curCas, v => { side.curCas = v; meleeResult(); }).el));
  card.append(h("div", { class: "flagrow" },
    h("span", { class: "sub", style: "width:130px;" }, "dispersal point"),
    makeStepper(1, 30, side.dispPt, v => { side.dispPt = v; meleeResult(); }).el));
  const dpw = h("div", { class: "chips" });
  for (const d of DISPERSE_POINTS) {
    const b = h("button", { class: "chip" }, d.label, h("small", {}, String(d.pt)));
    b.addEventListener("click", () => { side.dispPt = d.pt; renderMelee(); });
    dpw.append(b);
  }
  card.append(h("details", {}, h("summary", {}, "set dispersal point from the verified table"), dpw));
  return card;
}

function meleeBand(diff) {
  if (diff >= 3) return "3+";
  if (diff === 2) return "2";
  if (diff === 1) return "1";
  return "DRAW";
}

function meleeResult() {
  const res = $("#melee-result");
  if (!res) return;
  res.innerHTML = "";
  res.append(h("h2", {}, "Round " + MEL.round + " result"));

  const [a, b] = MEL.sides;
  for (const s of MEL.sides) {
    let cd = 0;
    for (const u of s.units) {
      const c = unitCD(u, s);
      if (u._cdBadge) u._cdBadge.textContent = u.inFight ? c + " CD" : "—";
      cd += c;
    }
    res.append(h("p", { class: "sub" },
      s.name + ": " + s.units.filter(u => u.inFight).length + " unit(s) · " + cd + " CD total (hits on 4–6, min 1/unit)" +
      (s.elan ? " · Élan" : "")));
    if (s._faces && s._rolledCD !== cd)
      res.append(h("p", { class: "walkerr" }, h("b", {}, s.name + ": "),
        "the CD pool changed after the roll (" + s._rolledCD + " rolled, now " + cd + ") — re-roll or adjust the casualties manually."));
    s._cd = cd;
  }

  if (a.cas === 0 && b.cas === 0) {
    res.append(h("p", { class: "sub" }, "Roll each side's CD (hits on 4–6), enter casualties caused — winner = most total casualties, ONE combined comparison."));
    return;
  }

  let winner = a.cas > b.cas ? a : b.cas > a.cas ? b : null;
  let flipped = false;
  const diff = winner ? Math.abs(a.cas - b.cas) : 0;
  if (winner) {
    let loser = winner === a ? b : a;
    if (winner.curCas >= winner.dispPt) {
      flipped = true;
      const t = winner; winner = loser; loser = t;
    }
    res.append(h("div", { class: "bigdiff " + (flipped ? "bad" : "good") }, winner.name.toUpperCase() + " WINS"),
      h("div", { class: "sub" }, "by " + diff + " casualt" + (diff === 1 ? "y" : "ies")));
    if (flipped) res.append(h("p", { class: "note" },
      "PYRRHIC VICTORY: " + (winner === a ? b.name : a.name) + " caused more casualties but reached its own dispersal point — the result FLIPS. " +
      winner.name + " wins, ignores retreat/rout results, and takes the ground UNFORMED."));
  } else {
    res.append(h("div", { class: "outcome" }, "DRAWN ROUND"));
  }

  // verified results band for the matchup
  const band = meleeBand(diff && !flipped ? diff : (winner ? diff : 0));
  const bandRow = MELEE_RESULTS[winner ? meleeBand(diff) : "DRAW"];
  res.append(h("div", { class: "outcome good" }, bandRow[MEL.matchup]));
  if (!winner || meleeBand(diff) === "1" || MEL.matchup === "infVsBUA")
    res.append(h("p", { class: "note" }, MELEE_NOTES[0]));
  if (!winner && MEL.matchup === "cavCavInfInf")
    res.append(h("p", { class: "note" }, MELEE_NOTES[1]));
  res.append(h("p", { class: "sub" }, MELEE_NOTES[2]));

  res.append(
    h("button", {
      class: "bigbtn alt", onclick: () => {
        MEL.round++;
        for (const s of MEL.sides) {
          s.cas = 0;
          for (const u of s.units) if (!u.lead) u.inFight = false;
          s.units.push(meleeUnitInit("Reinforcement R" + MEL.round, false));
        }
        renderMelee();
      }
    }, "Fight on → round " + (MEL.round + 1) + " (add reinforcements)"),
    h("p", { class: "note" },
      "Maximum 2 melee rounds per phase; a 2nd draw = Attacker Retires. Reinforcements must be FORMED and IN COMMAND within support distance (cavalry 10\"). An Unformed unit may NOT join."),
    h("button", {
      class: "bigbtn", onclick: () => {
        SessionLog.add({
          kind: "melee", round: MEL.round,
          detail: MEL.sides.map(s => s.name + " " + s.cas + " cas").join(" vs "),
          winner: winner ? winner.name + (flipped ? " (Pyrrhic flip)" : "") : "drawn"
        });
        if (MEL.bankId && typeof MeleeQueue !== "undefined") MeleeQueue.remove(MEL.bankId);
        $("#meleepanel").style.display = "none";
        if (typeof refreshCharge === "function") refreshCharge();
        buzz(30);
      }
    }, "Lock melee & log it"));

  // round-2+ rule: an Unformed reinforcement cannot join the fight
  for (const s of MEL.sides) {
    for (const u of s.units) {
      if (u.inFight && !u.lead && MEL.round >= 2 && u.chips.includes("unf")) {
        u.inFight = false;
        res.prepend(h("p", { class: "walkerr" }, h("b", {}, "Blocked: "),
          u.label + " is Unformed — Unformed units cannot reinforce a melee. Removed from the fight."));
      }
    }
  }
}
