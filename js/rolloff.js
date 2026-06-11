/* Roll-Off — head-to-head 2D6 duel (Mode 1: table mode, pass-and-roll).
   One 2D6 per side ALWAYS — extra units are supports = re-roll tokens.
   Mode 2 (WebRTC paired) is build-order step 10, not yet shipped. */
"use strict";

const RO_TYPES = [
  { k: "infVsInfArty", l: "Inf vs Inf/Arty" },
  { k: "cavVsCav", l: "Cav vs Cav" },
  { k: "cavVsInfArty", l: "Cav vs Inf/Arty" },
  { k: "plain", l: "Plain roll-off" }
];

/* quick-tick chips — the named modifiers from §3.2 */
const RO_CHIPS = [
  { l: "Elite", v: +2 }, { l: "Veteran", v: +1 }, { l: "Recruit", v: -1 },
  { l: "Charging On", v: +1 }, { l: "Heavy cavalry", v: +1 }, { l: "Lancers vs inf", v: +1 },
  { l: "Campaign cav vs Heavy", v: -1 },
  { l: "Unformed", v: -2 }, { l: "Inf col/sq vs cav", v: +2 }, { l: "Inf line vs cav", v: -2 },
  { l: "Square vs inf", v: -2 }, { l: "Narrower frontage", v: -1 },
  { l: "Flanked", v: -2 }, { l: "Flank/rear charged", v: -4 },
  { l: "Hesitant", v: -1 }, { l: "Faltering", v: -1 }, { l: "Demoralised", v: -1 },
  { l: "Charge cas 2", v: -1 }, { l: "Charge cas 3–4", v: -2 }, { l: "Charge cas 5+", v: -3 },
  { l: "Unit cas 4+", v: -1 }, { l: "Unit cas 8+", v: -2 }
];

const NATION_TINTS = { France: "#4a6fd4", Prussia: "#3a3f4d", Russia: "#2e8b57", "—": "#6b6f80" };
const WIN_WORD = { France: "VICTOIRE!", Prussia: "SIEG!", Russia: "POBEDA!", "—": "VICTORY!" };

/* original SVG silhouettes, drawn in-project (copyright-safe) */
const SVG_WINNER = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="#101218">
 <path d="M58 8l3 1-6 22 24-6 1 4-25 8v6l9 3 12 24-5 2-11-21-8-3-2 18 8 26-6 2-8-24-4-1-9 22-6-2 9-25 3-19-10 4-9 14-5-3 10-17 16-7 2-9c-3-1-5-4-5-8 0-5 4-9 9-9s9 4 9 9c0 2-1 4-2 5l16-16z"/>
 <rect x="80" y="6" width="3" height="34"/>
 <path d="M83 6h14v12l-7-2-7 2z" opacity=".9"/>
</svg>`;
const SVG_LOSER = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="#101218">
 <path d="M14 78l20-6 7-12-4-14 6-10c-2-2-3-4-3-7 0-5 4-9 9-9s9 4 9 9c0 4-3 8-7 9l-3 9 5 13-2 13 28 4v5l-32-3-9 3-24 4z"/>
 <path d="M8 92h84v3H8z" opacity=".5"/>
 <path d="M70 60l3-26 3 .3-2 26z" opacity=".85"/>
 <path d="M73 36l16 5-1 8-15-7z" opacity=".7"/>
 <ellipse cx="30" cy="89" rx="9" ry="3" opacity=".6"/>
 <path d="M24 84l12-2 1 4-13 2z"/>
</svg>`;

let RO = null;

function roBlankSide(name) {
  return {
    name, nation: "—",
    wheels: { Grade: 0, Formation: 0, Situation: 0, Other: 0 },
    chips: [],            // [{l, v}] ticked quick chips
    handoff: [],          // [{label, val}] carried from Charge tab (removable)
    supports: [],         // [{degraded, spent}]
    dice: [null, null], rolled: false, locked: false,
    rerolls: [],          // log of token spends
    dieApis: null
  };
}
function roNet(s) {
  return Object.values(s.wheels).reduce((a, b) => a + b, 0)
    + s.chips.reduce((a, c) => a + c.v, 0)
    + s.handoff.reduce((a, m) => a + m.val, 0);
}
const roTotal = s => (s.dice[0] || 0) + (s.dice[1] || 0) + roNet(s);

function buildRolloff() {
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  RO = { type: null, sides: [roBlankSide("Side A"), roBlankSide("Side B")] };

  // handoff from Charge tab?
  const hand = Store.get("rolloff_handoff", null);
  if (hand) {
    RO.type = hand.type;
    RO.sides[0].name = hand.sides[0].name; RO.sides[1].name = hand.sides[1].name;
    RO.sides[0].handoff = hand.sides[0].mods.filter(m => m.val !== 0);
    RO.sides[1].handoff = hand.sides[1].mods.filter(m => m.val !== 0);
    RO.sides[0].supports = (hand.sides[0].supports || []).map(s => ({ degraded: !!s.degraded, spent: false }));
    RO.sides[1].supports = (hand.sides[1].supports || []).map(s => ({ degraded: !!s.degraded, spent: false }));
    Store.del("rolloff_handoff");
  }

  // type pick
  const typeCard = h("div", { class: "card", id: "ro-type-card" }, h("h2", {}, "What kind of charge?"));
  const seg = h("div", { class: "seg" });
  for (const t of RO_TYPES) {
    const b = h("button", { class: RO.type === t.k ? "on" : "" }, t.l);
    b.addEventListener("click", () => {
      RO.type = t.k;
      $$("button", seg).forEach(x => x.classList.remove("on"));
      b.classList.add("on"); buzz(12);
    });
    seg.append(b);
  }
  typeCard.append(seg,
    h("p", { class: "sub" }, "Plain roll-off skips the Charge Results table (initiative, any opposed test). The charge test is always ONE 2D6 per side — extra units are SUPPORTS (re-roll tokens), never extra dice."));
  root.append(typeCard);

  for (const s of RO.sides) root.append(roSideCard(s));

  root.append(h("div", { class: "card", id: "ro-verdict" }));

  // session log
  const logCard = h("div", { class: "card", id: "ro-log" }, h("h2", {}, "Duel log"));
  renderRoLog(logCard);
  root.append(logCard);
  indexCard("rolloff", "ro-type-card", "Roll-Off duel", "opposed 2D6 dice duel modifiers supports re-rolls initiative");
  roVerdict();
}

function renderRoLog(card) {
  $$(".logrow", card).forEach(e => e.remove());
  const entries = SessionLog.all();
  if (!entries.length) card.append(h("p", { class: "logrow sub" }, "No duels yet."));
  for (const e of entries.slice(0, 12)) {
    card.append(h("div", { class: "logrow" + (e.voided ? " voided" : "") },
      h("span", { class: "lr-dice" },
        e.kind === "melee" ? "Melee: " + e.detail + " — " + e.winner
          : (e.detail || "") + (e.result ? " → " + e.result : "")),
      h("div", { class: "sub" }, new Date(e.ts).toLocaleTimeString())));
  }
  const clr = h("button", { class: "bigbtn alt", onclick: () => { SessionLog.clear(); buildRolloff(); } }, "Clear log");
  card.append(clr);
}

function roSideCard(s) {
  const card = h("div", { class: "card sidecard" + (s === RO.sides[1] ? " def" : "") });
  card.append(h("h2", {}, s.name));

  // nation (winner-theatre styling)
  const natRow = h("div", { class: "chips" });
  for (const n of ["France", "Prussia", "Russia"]) {
    const c = h("button", { class: "chip" + (s.nation === n ? " on" : "") }, n);
    c.addEventListener("click", () => {
      s.nation = s.nation === n ? "—" : n;
      $$(".chip", natRow).forEach(x => x.classList.remove("on"));
      if (s.nation !== "—") c.classList.add("on");
    });
    natRow.append(c);
  }
  card.append(h("div", { class: "grouplabel" }, "Nation (for the banner)"), natRow);

  // wheels
  card.append(h("div", { class: "grouplabel" }, "Modifier wheels"));
  const wheelRow = h("div", { class: "wheelrow" });
  const ranges = { Grade: [-1, 2], Formation: [-2, 2], Situation: [-4, 4], Other: [-3, 3] };
  for (const [name, [lo, hi]] of Object.entries(ranges)) {
    const vals = []; for (let i = lo; i <= hi; i++) vals.push(i);
    wheelRow.append(makeWheel(name, vals, vals.indexOf(s.wheels[name]), v => {
      if (s.rolled) return; // committed once rolled
      s.wheels[name] = v; roSideRefresh(s);
    }).el);
  }
  card.append(wheelRow);

  // quick chips
  card.append(h("div", { class: "grouplabel" }, "Named modifiers (tap to tick / untick)"));
  const chipWrap = h("div", { class: "chips" });
  for (const c of RO_CHIPS) {
    const on = s.chips.some(x => x.l === c.l);
    const chip = h("button", { class: "chip" + (on ? " on" : "") + (c.v < 0 ? " neg" : "") },
      c.l, h("small", {}, fmtMod(c.v)));
    chip.addEventListener("click", () => {
      if (s.rolled) return;
      const i = s.chips.findIndex(x => x.l === c.l);
      if (i >= 0) { s.chips.splice(i, 1); chip.classList.remove("on"); }
      else { s.chips.push({ l: c.l, v: c.v }); chip.classList.add("on"); }
      roSideRefresh(s); buzz(10);
    });
    chipWrap.append(chip);
  }
  card.append(chipWrap);

  // supports wheel + degraded toggles
  card.append(h("div", { class: "grouplabel" }, "Supports (re-roll tokens)"));
  const supWrap = h("div", { class: "chips", "data-ro-sup": s.name });
  const supStep = makeStepper(0, 3, s.supports.length, v => {
    if (s.rolled) { supStep.set(s.supports.length); return; }
    while (s.supports.length < v) s.supports.push({ degraded: false, spent: false });
    s.supports.length = v;
    drawSup();
  });
  const drawSup = () => {
    supWrap.innerHTML = "";
    s.supports.forEach((sp, i) => {
      const b = h("button", { class: "chip on" + (sp.degraded ? " neg" : "") },
        "S" + (i + 1), h("small", {}, sp.degraded ? "degraded −1" : "normal"));
      b.addEventListener("click", () => { if (!s.rolled) { sp.degraded = !sp.degraded; drawSup(); } });
      supWrap.append(b);
    });
  };
  drawSup();
  card.append(h("div", { class: "flagrow" }, supStep.el, h("span", { class: "sub" }, "each support = one D6 re-roll; degraded = −1 on the re-rolled die")), supWrap);

  // running modifier list
  card.append(h("div", { class: "grouplabel" }, "Declared modifiers"));
  card.append(h("ul", { class: "whylist", "data-ro-list": s.name }));
  card.append(h("div", { class: "netrow" },
    h("span", { class: "netmod", "data-ro-net": s.name }, "+0"),
    h("span", { class: "sub" }, "net modifier")));

  // dice area
  const diceWrap = h("div", { class: "dicepair", "data-ro-dice": s.name });
  card.append(diceWrap);
  card.append(h("div", { class: "totalbig", "data-ro-total": s.name }, ""));
  card.append(h("div", { class: "totalsub", "data-ro-sub": s.name }, ""));
  card.append(h("div", { class: "chips", "data-ro-tokens": s.name }));

  const rollBtn = h("button", { class: "bigbtn", "data-ro-roll": s.name }, "ROLL 2D6");
  rollBtn.addEventListener("click", () => roRoll(s));
  card.append(rollBtn);

  const redec = h("button", { class: "bigbtn alt", style: "display:none", "data-ro-redeclare": s.name },
    "Re-declare modifiers (voids this roll)");
  redec.addEventListener("click", () => {
    SessionLog.add({ kind: "duel", voided: true, detail: s.name + " voided a roll of " + s.dice.join("+") + " (net " + fmtMod(roNet(s)) + ")" });
    s.dice = [null, null]; s.rolled = false; s.locked = false; s.rerolls = [];
    s.supports.forEach(x => x.spent = false);
    buildRolloffPreserve();
  });
  card.append(redec);

  const lockBtn = h("button", { class: "bigbtn alt", style: "display:none", "data-ro-lock": s.name }, "LOCK RESULT");
  lockBtn.addEventListener("click", () => { s.locked = true; lockBtn.disabled = true; buzz(20); roVerdict(); });
  card.append(lockBtn);

  requestAnimationFrame(() => roSideRefresh(s));
  return card;
}

function buildRolloffPreserve() {
  // rebuild UI keeping RO state (used after void)
  const keep = RO;
  buildRolloff();
  RO.type = keep.type; RO.sides = keep.sides;
  // re-render by full rebuild: simplest is rebuilding cards from state
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  const typeCard = h("div", { class: "card" }, h("h2", {}, "What kind of charge?"));
  const seg = h("div", { class: "seg" });
  for (const t of RO_TYPES) {
    const b = h("button", { class: RO.type === t.k ? "on" : "" }, t.l);
    b.addEventListener("click", () => { RO.type = t.k; $$("button", seg).forEach(x => x.classList.remove("on")); b.classList.add("on"); });
    seg.append(b);
  }
  typeCard.append(seg);
  root.append(typeCard);
  for (const s of RO.sides) root.append(roSideCard(s));
  root.append(h("div", { class: "card", id: "ro-verdict" }));
  const logCard = h("div", { class: "card", id: "ro-log" }, h("h2", {}, "Duel log"));
  renderRoLog(logCard);
  root.append(logCard);
  roVerdict();
}

function roSideRefresh(s) {
  const list = $('[data-ro-list="' + s.name + '"]');
  if (!list) return;
  list.innerHTML = "";
  const add = (label, val, removeFn) => {
    const li = h("li", {}, label, h("b", {}, fmtMod(val) + " "),
      removeFn && !s.rolled ? h("button", { style: "color:var(--bad);font-weight:800;min-width:32px;", onclick: removeFn }, "✕") : null);
    list.append(li);
  };
  for (const m of s.handoff) add(m.label, m.val, () => { s.handoff = s.handoff.filter(x => x !== m); roSideRefresh(s); });
  for (const c of s.chips) add(c.l, c.v, () => { s.chips = s.chips.filter(x => x !== c); buildRolloffPreserve(); });
  for (const [k, v] of Object.entries(s.wheels)) if (v !== 0) add(k + " wheel", v, () => { s.wheels[k] = 0; buildRolloffPreserve(); });
  if (!list.children.length) list.append(h("li", {}, "none declared", h("b", {}, "0")));
  $('[data-ro-net="' + s.name + '"]').textContent = fmtMod(roNet(s));
}

function roRoll(s) {
  if (s.rolled) return;
  s.rolled = true;
  const wrap = $('[data-ro-dice="' + s.name + '"]');
  wrap.innerHTML = "";
  const red = s === RO.sides[1];
  s.dieApis = [makeDie(red), makeDie(red)];
  wrap.append(s.dieApis[0].el, s.dieApis[1].el);
  $('[data-ro-roll="' + s.name + '"]').style.display = "none";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    s.dice = [s.dieApis[0].roll(d6()), s.dieApis[1].roll(d6())];
    setTimeout(() => {
      roShowTotal(s);
      roTokens(s);
      $('[data-ro-redeclare="' + s.name + '"]').style.display = "block";
      $('[data-ro-lock="' + s.name + '"]').style.display = "block";
      roVerdict();
    }, 620);
  }));
}

function roShowTotal(s) {
  $('[data-ro-total="' + s.name + '"]').textContent = String(roTotal(s));
  $('[data-ro-sub="' + s.name + '"]').textContent =
    s.dice[0] + " + " + s.dice[1] + "  " + fmtMod(roNet(s)) + " mod";
}

function roTokens(s) {
  const wrap = $('[data-ro-tokens="' + s.name + '"]');
  wrap.innerHTML = "";
  s.supports.forEach((sp, i) => {
    const tok = h("button", { class: "token" + (sp.spent ? " spent" : "") },
      h("span", { class: "mini" }), "re-roll" + (sp.degraded ? " −1" : ""));
    tok.addEventListener("click", () => {
      if (sp.spent || s.locked) return;
      roSpendToken(s, sp, tok);
    });
    wrap.append(tok);
  });
}

function roSpendToken(s, sp, tok) {
  // choose which die to re-roll
  const pick = h("div", { class: "chips" },
    h("span", { class: "sub" }, "Re-roll which die?"),
    h("button", { class: "chip" }, "Die 1 (" + s.dice[0] + ")"),
    h("button", { class: "chip" }, "Die 2 (" + s.dice[1] + ")"),
    h("button", { class: "chip neg" }, "cancel"));
  tok.after(pick);
  const btns = $$("button.chip", pick);
  const doRe = idx => {
    pick.remove();
    sp.spent = true;
    let v = d6();
    if (sp.degraded) v = Math.max(1, v - 1); // −1 on the re-rolled die, floor 1
    s.dieApis[idx].roll(v);
    s.dieApis[idx].mark(sp.degraded);
    s.dice[idx] = v; // the new face STANDS
    s.rerolls.push({ die: idx + 1, result: v, degraded: sp.degraded });
    setTimeout(() => { roShowTotal(s); roTokens(s); roVerdict(); }, 620);
  };
  btns[0].addEventListener("click", () => doRe(0));
  btns[1].addEventListener("click", () => doRe(1));
  btns[2].addEventListener("click", () => pick.remove());
}

function roVerdict() {
  const card = $("#ro-verdict");
  if (!card) return;
  card.innerHTML = "";
  card.append(h("h2", {}, "Verdict"));
  const [a, b] = RO.sides;
  if (!(a.rolled && b.rolled)) {
    card.append(h("p", { class: "sub" }, "Both sides set modifiers, then ROLL. Spend re-roll tokens, then LOCK RESULT on each side."));
    return;
  }
  if (!(a.locked && b.locked)) {
    card.append(h("p", { class: "sub" }, "Totals: " + a.name + " " + roTotal(a) + " · " + b.name + " " + roTotal(b) + ". Spend any re-roll tokens, then both sides LOCK."));
    return;
  }
  const ta = roTotal(a), tb = roTotal(b);
  const winner = ta === tb ? null : (ta > tb ? a : b);
  const loser = winner === a ? b : a;
  const diff = Math.abs(ta - tb);

  let resultLine = null, band = null;
  if (RO.type && RO.type !== "plain" && winner) {
    // differential from the CHARGER's perspective: side A is the charger by convention
    const signedDiff = ta - tb;
    band = chargeBand(signedDiff);
    resultLine = band[RO.type];
  }

  SessionLog.add({
    kind: "duel",
    detail: a.name + " " + a.dice.join("+") + fmtMod(roNet(a)) + "=" + ta + " vs " +
      b.name + " " + b.dice.join("+") + fmtMod(roNet(b)) + "=" + tb +
      (a.rerolls.length + b.rerolls.length ? " (re-rolls spent: " + (a.rerolls.length + b.rerolls.length) + ")" : ""),
    winner: winner ? winner.name : "tie",
    result: resultLine || (winner ? winner.name + " by " + diff : "tie")
  });

  roTheatre(winner, loser, diff, resultLine, band);
  const lg = $("#ro-log"); if (lg) renderRoLog(lg);
  card.append(h("p", { class: "outcome " + (winner ? "good" : "") },
    winner ? winner.name + " wins by " + diff : "TIE — no effect"),
    resultLine ? h("p", { class: "outcome good" }, resultLine) : null,
    h("button", { class: "bigbtn alt", onclick: buildRolloff }, "New duel"));
}

function roTheatre(winner, loser, diff, resultLine, band) {
  const t = $("#theatre");
  t.innerHTML = "";
  if (!winner) { return; }
  const tint = NATION_TINTS[winner.nation] || NATION_TINTS["—"];
  const cardEl = h("div", { class: "theatrecard" });
  cardEl.append(
    h("div", { class: "burst", style: "--burst:" + tint, html: SVG_WINNER }),
    h("div", { class: "vbanner win" }, WIN_WORD[winner.nation] || "VICTORY!"),
    h("div", { class: "sub" }, winner.name + " wins by " + diff));
  if (resultLine) {
    cardEl.append(h("div", { class: "vresult" }, resultLine));
    if (/Volley!/.test(resultLine)) cardEl.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[0]));
    if (/Victory!/.test(resultLine)) cardEl.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[1]));
  }
  // loser strip
  cardEl.append(h("div", { class: "flagrow", style: "justify-content:center;opacity:.8;margin-top:8px;" },
    h("div", { style: "width:64px;height:64px;", html: SVG_LOSER }),
    h("div", {},
      h("div", { class: "vbanner lose", style: "font-size:20px;margin:0;" }, loser.name),
      h("div", { class: "sub" }, "Lost by " + diff))));
  if (band) {
    const det = h("details", {}, h("summary", {}, "view full table"));
    det.append(renderChargeTable(band, RO.type));
    cardEl.append(det);
  }
  cardEl.append(h("button", { class: "bigbtn", onclick: () => t.classList.remove("on") }, "Done"));
  t.append(cardEl);
  t.classList.add("on");
  buzz(60);
}
