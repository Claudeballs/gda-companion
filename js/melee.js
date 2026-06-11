/* Melee round resolver (§9A) — opens from a Melee/Élan charge result.
   Round-1 participation, Élan scope, winner-by-casualties, the Pyrrhic
   Victory flip and round-2 reinforcement are VERIFIED rules. Melee CD
   values themselves are §10-unverified → CD tally is a helper only;
   the casualties each side actually causes are entered from the table. */
"use strict";

let MEL = null;

function meleeSideInit(name, supports) {
  return {
    name,
    units: [{ label: name + " lead", cd: 0, lead: true, inFight: true, unformed: false, garrison: false }]
      .concat((supports || []).map((s, i) => ({
        label: "Support " + (i + 1) + (s.degraded ? " (degraded)" : ""),
        cd: 0, lead: false, inFight: false, unformed: false, garrison: false
      }))),
    elan: false, cas: 0, curCas: 0, dispPt: 8
  };
}

function openMelee(chargeState, fromOutcome) {
  MEL = {
    round: 1, fromOutcome: fromOutcome || null,
    sides: [
      meleeSideInit("Charger", chargeState ? chargeState.charger.supports : []),
      meleeSideInit("Defender", chargeState ? chargeState.defender.supports : [])
    ]
  };
  renderMelee();
}

function meleePanel() {
  let p = $("#meleepanel");
  if (!p) {
    p = h("div", { id: "meleepanel" });
    Object.assign(p.style, {
      position: "fixed", inset: "0", zIndex: "55", background: "var(--bg)",
      overflowY: "auto", padding: "12px", display: "none"
    });
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

  wrap.append(h("div", { class: "card" },
    h("div", { class: "flagrow", style: "justify-content:space-between;" },
      h("h2", { style: "margin:0;" }, "Melee — round " + MEL.round),
      h("button", { class: "iconbtn", onclick: () => { p.style.display = "none"; } }, "✕")),
    MEL.fromOutcome ? h("p", { class: "sub" }, "From charge result: " + MEL.fromOutcome) : null,
    h("p", { class: "note" },
      MEL.round === 1
        ? "Round 1: lead unit + flank supports that PHYSICALLY reached base-to-base. Rear supports never fight round 1."
        : "Round 2+: any FORMED, IN-COMMAND unit within support distance (cavalry 10\") may reinforce — even if it moved a full move this turn."),
    h("p", { class: "sub" }, "Melee CD values per unit", h("span", { class: "badge-verify" }, "⚠ unverified"),
      " — tally is a helper; the casualties entered below decide the melee.")));

  for (const side of MEL.sides) wrap.append(meleeSideCard(side));

  wrap.append(h("div", { class: "card resultpanel", id: "melee-result" }));
  meleeResult();
}

function meleeSideCard(side) {
  const card = h("div", { class: "card sidecard" + (side.name === "Defender" ? " def" : "") });
  card.append(h("h2", {}, side.name));

  for (const u of side.units) {
    const row = h("div", { class: "flagrow", style: "flex-wrap:wrap;border-bottom:1px dashed var(--line);padding:6px 0;" });
    const fight = h("button", {
      class: "chip" + (u.inFight ? " on" : ""),
      onclick: ev => {
        if (u.lead) return;
        u.inFight = !u.inFight; ev.target.closest(".chip").classList.toggle("on");
        meleeResult(); buzz(12);
      }
    }, u.lead ? "Lead (always fights)" : u.label,
      !u.lead ? h("small", {}, MEL.round === 1 ? "reached contact?" : "joins?") : null);
    const cdStep = makeStepper(0, 10, u.cd, v => { u.cd = v; meleeResult(); });
    const unf = makeChip("Unformed", null, on => { u.unformed = on; meleeResult(); }, { neg: true });
    if (u.unformed) unf.classList.add("on");
    const gar = makeChip("Garrison", null, on => { u.garrison = on; meleeResult(); });
    if (u.garrison) gar.classList.add("on");
    row.append(fight, h("span", { class: "sub" }, "CD"), cdStep.el, unf, gar);
    card.append(row);
  }

  const elan = makeChip("Melee with Élan", "lead + ALL supports", on => { side.elan = on; meleeResult(); });
  if (side.elan) elan.classList.add("on");
  card.append(h("div", { class: "chips" }, elan));

  card.append(h("div", { class: "grouplabel" }, "Casualties CAUSED by this side (round " + MEL.round + ")"));
  card.append(makeStepper(0, 20, side.cas, v => { side.cas = v; meleeResult(); }).el);

  card.append(h("div", { class: "grouplabel" }, "Pyrrhic check — this side's force"));
  const r1 = h("div", { class: "flagrow" },
    h("span", { class: "sub", style: "width:130px;" }, "casualties NOW"),
    makeStepper(0, 30, side.curCas, v => { side.curCas = v; meleeResult(); }).el);
  const r2 = h("div", { class: "flagrow" },
    h("span", { class: "sub", style: "width:130px;" }, "dispersal point"),
    makeStepper(1, 30, side.dispPt, v => { side.dispPt = v; meleeResult(); }).el);
  card.append(r1, r2);
  return card;
}

function meleeResult() {
  const res = $("#melee-result");
  if (!res) return;
  res.innerHTML = "";
  res.append(h("h2", {}, "Round " + MEL.round + " result"));

  const [a, b] = MEL.sides;
  for (const s of MEL.sides) {
    const inFight = s.units.filter(u => u.inFight);
    const cd = inFight.reduce((t, u) => t + u.cd, 0);
    res.append(h("p", { class: "sub" },
      s.name + ": " + inFight.length + " unit(s) fighting · CD tally " + cd +
      (s.elan ? " · Élan (lead + all supports)" : "")));
  }

  if (a.cas === 0 && b.cas === 0) {
    res.append(h("p", { class: "sub" }, "Enter casualties caused by each side — winner = most total casualties (ONE combined comparison, not per-pair duels)."));
    return;
  }

  let winner = a.cas > b.cas ? a : b.cas > a.cas ? b : null;
  if (!winner) {
    res.append(h("div", { class: "outcome" }, "DRAWN ROUND — fight on"));
  } else {
    let loser = winner === a ? b : a;
    const diff = winner.cas - loser.cas;
    let flipped = false;
    // Pyrrhic Victory: winner reaching its OWN dispersal point flips the result
    if (winner.curCas >= winner.dispPt) {
      flipped = true;
      const t = winner; winner = loser; loser = t;
    }
    res.append(h("div", { class: "bigdiff " + (flipped ? "bad" : "good") }, winner.name.toUpperCase() + " WINS"),
      h("div", { class: "sub" }, "by " + diff + " casualt" + (diff === 1 ? "y" : "ies")));
    if (flipped) res.append(h("p", { class: "note" },
      "PYRRHIC VICTORY: " + loser.name + " caused more casualties but reached its own dispersal point — the result FLIPS. " +
      winner.name + " wins, ignores retreat/rout results, and takes the ground UNFORMED."));
  }

  res.append(
    h("button", {
      class: "bigbtn alt", onclick: () => {
        MEL.round++;
        for (const s of MEL.sides) {
          s.cas = 0;
          for (const u of s.units) if (!u.lead) u.inFight = false;
          s.units.push({ label: "Reinforcement R" + MEL.round, cd: 0, lead: false, inFight: false, unformed: false, garrison: false });
        }
        renderMelee();
      }
    }, "Fight on → round " + (MEL.round + 1) + " (add reinforcements)"),
    h("p", { class: "note" },
      "Round-2 reinforcements must be FORMED and IN COMMAND within support distance (cavalry from up to 10\"). An Unformed unit may NOT join — if it's marked Unformed here, untick it from the fight."),
    h("button", {
      class: "bigbtn", onclick: () => {
        const w = a.cas === b.cas ? null : (a.cas > b.cas ? a : b);
        SessionLog.add({
          kind: "melee", round: MEL.round,
          detail: MEL.sides.map(s => s.name + " " + s.cas + " cas").join(" vs "),
          winner: w ? w.name : "drawn"
        });
        $("#meleepanel").style.display = "none";
        buzz(30);
      }
    }, "Lock melee & log it"));

  // enforcement of test-case 9: an unformed reinforcement cannot fight
  for (const s of MEL.sides) {
    for (const u of s.units) {
      if (u.inFight && !u.lead && u.unformed && MEL.round >= 2) {
        u.inFight = false;
        res.prepend(h("p", { class: "walkerr" }, h("b", {}, "Blocked: "), u.label + " is Unformed — Unformed units cannot reinforce a melee. It has been removed from the fight."));
      }
    }
  }
}
