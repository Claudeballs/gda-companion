/* Fire calculator — musketry & artillery. The halving chain, screen,
   measurement and battery rules are VERIFIED. Base CD by size/range is
   §10-unverified → entered on a wheel with the ⚠ badge until Andy
   signs off the firing tables; the chain math is exact either way. */
"use strict";

let FI = null;

function buildFire() {
  FI = Store.get("fire_state", null) || {
    firer: "Line infantry", size: "Standard", range: "effective",
    target: "formed", baseCD: 4, mods: []
  };
  const root = $("#tab-fire");
  root.innerHTML = "";

  const card = h("div", { class: "card", id: "fire-card" }, h("h2", {}, "Fire calculator"));

  const single = (label, opts, cur, onPick) => {
    card.append(h("div", { class: "grouplabel" }, label));
    const wrap = h("div", { class: "chips" });
    for (const o of opts) {
      const b = h("button", { class: "chip" + (cur === o ? " on" : "") }, o);
      b.addEventListener("click", () => {
        $$(".chip", wrap).forEach(c => c.classList.remove("on"));
        b.classList.add("on"); onPick(o); buzz(10);
      });
      wrap.append(b);
    }
    card.append(wrap);
  };

  single("Firer", ["Line infantry", "Column", "Square", "Skirmishers", "Artillery"], FI.firer, v => { FI.firer = v; fireOut(); });
  single("Firer size", ["Large", "Standard", "Small"], FI.size, v => { FI.size = v; fireOut(); });

  card.append(h("div", { class: "grouplabel" }, "Range band (artillery)",
    h("span", { class: "badge-verify" }, "⚠ inch breaks unverified")));
  const rWrap = h("div", { class: "chips" });
  for (const r of ["canister", "effective", "long"]) {
    const b = h("button", { class: "chip" + (FI.range === r ? " on" : "") }, r);
    b.addEventListener("click", () => { $$(".chip", rWrap).forEach(c => c.classList.remove("on")); b.classList.add("on"); FI.range = r; fireOut(); buzz(10); });
    rWrap.append(b);
  }
  card.append(rWrap);

  single("Target", ["formed", "skirmishers", "garrison (BUA/strongpoint)", "column"], FI.target, v => { FI.target = v; fireOut(); });

  card.append(h("div", { class: "grouplabel" }, "Base CD (from firing table)",
    h("span", { class: "badge-verify" }, "⚠ unverified — table pending sign-off")));
  const baseVals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  card.append(h("div", { class: "wheelrow" },
    makeWheel("Base CD", baseVals, Math.max(0, baseVals.indexOf(FI.baseCD)), v => { FI.baseCD = v; fireOut(); }).el));

  card.append(h("div", { class: "grouplabel" }, "Modifiers"));
  const mWrap = h("div", { class: "chips" });
  for (const m of FIRE_MODS) {
    const on = FI.mods.includes(m.id);
    const chip = h("button", { class: "chip" + (on ? " on" : "") + (m.cd < 0 ? " neg" : "") },
      m.label, h("small", {}, fmtMod(m.cd) + " CD"));
    chip.addEventListener("click", () => {
      const i = FI.mods.indexOf(m.id);
      if (i >= 0) { FI.mods.splice(i, 1); chip.classList.remove("on"); }
      else { FI.mods.push(m.id); chip.classList.add("on"); }
      fireOut(); buzz(10);
    });
    mWrap.append(chip);
  }
  card.append(mWrap);
  root.append(card);

  root.append(h("div", { class: "card resultpanel", id: "fire-out" }));

  // verified rules cards
  const rules = h("div", { class: "card", id: "fire-rules" }, h("h2", {}, "Fire rules (verified)"));
  const RULE_TITLES = {
    halving: "Halving chain", skirmishScreens: "Skirmisher screens", measurement: "Measurement",
    doubleSix: "Double 6 on casualty dice", assaultFire: "Assault Fire", largeBattery: "Large battery", grandBattery: "Grand Battery"
  };
  for (const [k, title] of Object.entries(RULE_TITLES)) {
    rules.append(h("details", { id: "fire-rule-" + k },
      h("summary", {}, title),
      h("p", { class: "note" }, FIRE_RULES[k])));
    indexCard("fire", "fire-rule-" + k, title, FIRE_RULES[k]);
  }
  root.append(rules);
  indexCard("fire", "fire-card", "Fire calculator", "musketry artillery casualty dice halve column square garrison canister");
  fireOut();
}

function fireOut() {
  Store.set("fire_state", FI);
  const out = $("#fire-out");
  if (!out) return;
  out.innerHTML = "";
  out.append(h("h2", {}, "Casualty dice"));

  let cd = FI.baseCD;
  const chain = ["base " + cd + " CD"];
  for (const m of FIRE_MODS) {
    if (FI.mods.includes(m.id)) { cd += m.cd; chain.push(fmtMod(m.cd) + " " + m.label); }
  }
  cd = Math.max(0, cd);
  let halvedNote = [];
  if (FI.firer === "Column" || FI.firer === "Square") {
    cd = Math.floor(cd / 2);
    halvedNote.push("halve (firer in " + FI.firer.toLowerCase() + ") → " + cd);
  }
  if (FI.target.startsWith("garrison")) {
    cd = Math.floor(cd / 2);
    halvedNote.push("halve again (garrison target) → " + cd);
  }

  out.append(h("div", { class: "bigdiff good" }, cd + " CD"));
  out.append(h("p", { class: "totalsub" }, chain.join(" · ")));
  if (halvedNote.length) out.append(h("p", { class: "note" }, halvedNote.join(" · ") + " — round down each time."));
  if (FI.firer === "Artillery" && FI.target === "skirmishers")
    out.append(h("p", { class: "note" }, FIRE_RULES.skirmishScreens));
  out.append(h("p", { class: "sub" }, FIRE_RULES.measurement));
  out.append(h("p", { class: "sub" }, "Reminder: " + FIRE_RULES.doubleSix));
}
