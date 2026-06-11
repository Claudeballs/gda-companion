/* Turn tracker — driven ENTIRELY by the scenario definition object
   (scenarios/*.js). No Höchberg logic lives in this file: rename a
   trigger in the scenario file and the app changes with no code edit. */
"use strict";

let SC = null, TK = null;

function trackerDefaults(sc) {
  const t = { turn: 1, initiative: null, rolled: {}, arrived: {}, flags: {}, objectives: {}, tallies: {}, caissons: {}, optGroups: {} };
  for (const o of sc.objectives) t.objectives[o.id] = "Contested";
  for (const tr of sc.trackers) {
    if (tr.groups) for (const g of tr.groups) t.caissons[g] = tr.perGroup;
    else t.tallies[tr.id] = 0;
  }
  return t;
}

function buildTracker() {
  SC = (window.GDA_SCENARIOS && window.GDA_SCENARIOS[0]) || null;
  const root = $("#tab-tracker");
  root.innerHTML = "";
  if (!SC) { root.append(h("div", { class: "card" }, "No scenario file loaded.")); return; }
  TK = Store.get("tracker_state", null) || trackerDefaults(SC);
  renderTracker();
}

function tkSave() { Store.set("tracker_state", TK); }

function renderTracker() {
  const root = $("#tab-tracker");
  root.innerHTML = "";

  /* ---- turn card ---- */
  const turnCard = h("div", { class: "card", id: "tk-turn" });
  turnCard.append(h("h2", {}, SC.name));
  const tn = h("span", { class: "turnnum" }, "T" + TK.turn);
  turnCard.append(h("div", { class: "turnrow" },
    h("button", { class: "iconbtn", style: "font-size:26px;", onclick: () => { TK.turn = Math.max(1, TK.turn - 1); tkSave(); renderTracker(); } }, "−"),
    tn,
    h("button", { class: "iconbtn", style: "font-size:26px;", onclick: () => { TK.turn = Math.min(SC.turns, TK.turn + 1); tkSave(); renderTracker(); buzz(15); } }, "+")),
    h("div", { class: "sub", style: "text-align:center;" }, "of " + SC.turns));

  // triggers for the current turn
  for (const tr of SC.triggers) {
    const fires = tr.turn === TK.turn || (tr.turns && tr.turns.includes(TK.turn));
    if (!fires) continue;
    if (tr.type === "roll") {
      if (tr.onceOnly && TK.arrived[tr.id]) continue;  // suppressed once arrived
      const done = TK.rolled[tr.id + ":" + TK.turn];
      const ban = h("div", { class: "trigbanner" }, tr.text);
      turnCard.append(ban);
      if (!done) {
        turnCard.append(h("div", { class: "seg" },
          h("button", { onclick: () => { TK.rolled[tr.id + ":" + TK.turn] = true; TK.arrived[tr.id] = true; tkSave(); renderTracker(); buzz(25); } }, "Rolled — ARRIVED"),
          h("button", { onclick: () => { TK.rolled[tr.id + ":" + TK.turn] = true; tkSave(); renderTracker(); } }, "Rolled — not arrived")));
      } else {
        turnCard.append(h("p", { class: "sub" }, "Rolled this turn ✓" + (TK.arrived[tr.id] ? " — arrived (no further rolls)" : "")));
      }
    } else {
      turnCard.append(h("div", { class: "trigbanner" + (TK.turn === SC.turns ? " flash" : "") }, tr.text));
    }
  }

  // initiative
  turnCard.append(h("div", { class: "grouplabel" }, "Initiative this turn"));
  const initSeg = h("div", { class: "seg" });
  for (const s of SC.initiative.sides) {
    const b = h("button", { class: TK.initiative === s ? "on" : "" }, s);
    b.addEventListener("click", () => { TK.initiative = s; tkSave(); renderTracker(); buzz(12); });
    initSeg.append(b);
  }
  turnCard.append(initSeg, h("p", { class: "sub" }, SC.initiative.note));
  root.append(turnCard);

  /* ---- tallies & caissons ---- */
  for (const tr of SC.trackers) {
    if (tr.groups) {
      const card = h("div", { class: "card", id: "tk-" + tr.id }, h("h2", {}, tr.label));
      for (const g of tr.groups) {
        const optLabel = tr.optionalGroups && tr.optionalGroups[g];
        if (optLabel && !TK.optGroups[g]) {
          const row = h("div", { class: "flagrow" },
            h("button", { class: "toggle", onclick: ev => { TK.optGroups[g] = true; tkSave(); renderTracker(); } }),
            h("span", { class: "sub" }, optLabel + "?"));
          card.append(row);
          continue;
        }
        const row = h("div", { class: "flagrow" }, h("b", { style: "width:56px;" }, g));
        for (let i = 0; i < tr.perGroup; i++) {
          const spent = i >= TK.caissons[g];
          const pip = h("button", { class: "pip-cais" + (spent ? " spent" : "") });
          pip.addEventListener("click", () => {
            TK.caissons[g] = spent ? Math.min(tr.perGroup, TK.caissons[g] + 1) : Math.max(0, TK.caissons[g] - 1);
            tkSave(); renderTracker(); buzz(12);
          });
          row.append(pip);
        }
        row.append(h("span", { class: "sub" }, TK.caissons[g] + " left — tap to spend/restore"));
        card.append(row);
      }
      root.append(card);
    } else {
      const v = TK.tallies[tr.id];
      const cls = v >= tr.thresholds.trigger ? "danger" : v >= tr.thresholds.warn ? "warn" : "";
      const card = h("div", { class: "card", id: "tk-" + tr.id }, h("h2", {}, tr.label));
      card.append(h("div", { class: "tally" },
        h("button", { class: "iconbtn", style: "font-size:24px;", onclick: () => { TK.tallies[tr.id] = Math.max(0, v - 1); tkSave(); renderTracker(); } }, "−"),
        h("span", { class: "num " + cls }, String(v)),
        h("button", { class: "iconbtn", style: "font-size:24px;", onclick: () => { TK.tallies[tr.id] = Math.min(tr.max, v + 1); tkSave(); renderTracker(); buzz(15); } }, "+")));
      card.append(h("p", { class: "sub" }, tr.warnText + " · 11+ = " + tr.triggerText.toLowerCase()));
      if (v >= tr.thresholds.trigger) card.append(h("div", { class: "trigbanner flash" }, tr.triggerText));
      root.append(card);
    }
  }

  /* ---- objectives ---- */
  const objWrap = h("div", { class: "card", id: "tk-objectives" }, h("h2", {}, "Objectives"));
  for (const o of SC.objectives) {
    const holder = TK.objectives[o.id];
    const oc = h("div", { class: "card objcard " + holder, style: "margin:8px 0;" },
      h("div", { class: "flagrow", style: "justify-content:space-between;" },
        h("b", {}, o.label + " · " + o.pts + " pt" + (o.pts > 1 ? "s" : "")),
        h("span", { class: "sub" }, holder)),
      o.rule ? h("p", { class: "note" }, o.rule) : null);
    const seg = h("div", { class: "seg" });
    for (const s of ["French", "Allied", "Contested"]) {
      const b = h("button", { class: holder === s ? "on" : "" }, s);
      b.addEventListener("click", () => { TK.objectives[o.id] = s; tkSave(); renderTracker(); buzz(12); });
      seg.append(b);
    }
    oc.append(seg);
    objWrap.append(oc);
  }
  root.append(objWrap);

  /* ---- victory check ---- */
  const vc = h("div", { class: "card", id: "tk-victory" }, h("h2", {}, "Victory check"));
  for (const f of (SC.victory.manualFlags || [])) {
    const row = h("div", { class: "flagrow" },
      h("button", {
        class: "toggle" + (TK.flags[f.id] ? " on" : ""),
        onclick: ev => { TK.flags[f.id] = !TK.flags[f.id]; ev.target.classList.toggle("on"); tkSave(); }
      }),
      h("span", { class: "sub" }, f.label));
    vc.append(row);
  }
  const vOut = h("div", { class: "resultpanel" });
  vc.append(h("button", { class: "bigbtn", onclick: () => { vOut.innerHTML = ""; vOut.append(victoryVerdict()); buzz(30); } }, "CHECK VICTORY"), vOut,
    h("details", {}, h("summary", {}, "scenario ladder"), h("p", { class: "note" }, SC.victory.note)));
  root.append(vc);

  /* ---- reminders ---- */
  const rem = h("details", { class: "card", id: "tk-reminders" },
    h("summary", { style: "color:var(--accent);font-weight:700;min-height:44px;display:flex;align-items:center;" }, "Every-turn reminders"));
  for (const r of SC.reminders) rem.append(h("p", { class: "note" }, r));
  root.append(rem);

  /* ---- setup ---- */
  const setup = h("details", { class: "card", id: "tk-setup" },
    h("summary", { style: "color:var(--accent);font-weight:700;min-height:44px;display:flex;align-items:center;" }, "Setup checklist"));
  for (const s of SC.setup) setup.append(h("p", { class: "note" }, s));
  root.append(setup);

  root.append(h("button", { class: "bigbtn danger", onclick: resetGame }, "Reset game"));

  indexCard("tracker", "tk-objectives", "Objectives — " + SC.name, SC.objectives.map(o => o.label + " " + (o.rule || "")).join(" "));
  indexCard("tracker", "tk-reminders", "Every-turn reminders", SC.reminders.join(" "));
  indexCard("tracker", "tk-victory", "Victory ladder", SC.victory.note);
}

function victoryVerdict() {
  const pts = side => SC.objectives.reduce((s, o) => s + (TK.objectives[o.id] === side ? o.pts : 0), 0);
  const ctx = {
    frPts: pts("French"), alPts: pts("Allied"),
    disp: TK.tallies.dispersals || 0,
    sauve: !!TK.flags.sauve,
    frHasMullerberg: TK.objectives.mullerberg === "French",
    alHasMullerberg: TK.objectives.mullerberg === "Allied"
  };
  let label = "DRAW";
  for (const band of SC.victory.bands) {
    let ok = false;
    try { ok = Function(...Object.keys(ctx), "return (" + band.rule + ");")(...Object.values(ctx)); } catch (e) { ok = false; }
    if (ok) { label = band.label; break; }
  }
  return h("div", {},
    h("div", { class: "bigdiff " + (label.startsWith("ALLIED") ? "good" : label.startsWith("FRENCH") ? "bad" : "") }, label),
    h("p", { class: "sub" }, "French " + ctx.frPts + " pts · Allied " + ctx.alPts + " pts · dispersals " + ctx.disp +
      (ctx.sauve ? " · Sauve Qui Peut occurred" : "")));
}
