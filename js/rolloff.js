/* Duel tab — rebuilt 13 Jun per Andy's feedback.
   The Charge tab now owns single-phone charges, so this tab does the
   two things it alone can do:
     1. PAIRED MODE (the showpiece): French player on his phone,
        Prussian on his. Phones link directly via QR-code WebRTC —
        no server, no internet account. Modifiers mirror live on the
        opponent's screen, Ready→Roll fires simultaneously, dice come
        from a commit-reveal seed exchange ("✓ verified fair"), and
        even support re-rolls derive from the committed seeds.
     2. A slim single-phone PLAIN roll-off (initiative, any opposed
        test) — winner and differential only. */
"use strict";

const RO_TYPES = [
  { k: "infVsInfArty", l: "Inf vs Inf/Arty" },
  { k: "cavVsCav", l: "Cav vs Cav" },
  { k: "cavVsInfArty", l: "Cav vs Inf/Arty" },
  { k: "plain", l: "Plain roll-off" }
];
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
const NATION_TINTS = { France: "#4a6fd4", Prussia: "#8d93a5", Russia: "#2e8b57", "—": "#6b6f80" };
const WIN_WORD = { France: "VICTOIRE!", Prussia: "SIEG!", Russia: "POBEDA!", "—": "VICTORY!" };

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

/* ---------- duel state ---------- */
let DU = null;

function duSideBlank() {
  return {
    name: "", nation: "—",
    chips: [], wheels: { Grade: 0, Formation: 0, Situation: 0, Other: 0 },
    supports: [], ready: false,
    commit: null, seed: null, dice: null, verified: null,
    rerollsUsed: 0, locked: false
  };
}
function duBlank() {
  return {
    mode: null,          // "host" | "join" | "solo"
    stage: "menu",       // menu | pairing | linked | dropped
    type: "plain",
    hostIsCharger: true,
    me: duSideBlank(), peer: duSideBlank(),
    scanners: []
  };
}
const duNet = s => Object.values(s.wheels).reduce((a, b) => a + b, 0) + s.chips.reduce((a, c) => a + c.v, 0);
const duTotal = s => (s.dice ? s.dice[0] + s.dice[1] : 0) + duNet(s);

function buildRolloff() {
  if (DU) { DU.scanners.forEach(s => s.stop && s.stop()); if (DU.mode !== null) Pair.close(); }
  DU = duBlank();
  DU.me.name = Store.get("duel_name", "");
  DU.me.nation = Store.get("duel_nation", "—");
  duMenu();
}

/* ---------- menu ---------- */
function duMenu() {
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  root.append(h("div", { class: "card", id: "duel-menu" },
    h("h2", {}, "Duel — two phones, one fight"),
    h("p", { class: "sub" }, "Charges on one phone live on the ⚔️ Charge tab. This tab links TWO phones for a face-to-face duel — each player sets his own modifiers, both see the other's claims before the dice, and the roll fires on both screens at once with a tamper-proof fairness check."),
    h("button", { class: "bigbtn", onclick: () => duHost() }, "📲 HOST a duel (this phone makes the code)"),
    h("button", { class: "bigbtn", onclick: () => duJoin() }, "📷 JOIN a duel (scan their code)"),
    h("button", { class: "bigbtn alt", onclick: () => duSolo() }, "🎲 Plain roll-off on this phone (initiative etc.)")));

  // identity
  const id = h("div", { class: "card" }, h("h2", {}, "Who am I?"));
  const natRow = h("div", { class: "chips" });
  for (const n of ["France", "Prussia", "Russia"]) {
    const c = h("button", { class: "chip" + (DU.me.nation === n ? " on" : "") }, n);
    c.addEventListener("click", () => {
      DU.me.nation = DU.me.nation === n ? "—" : n;
      Store.set("duel_nation", DU.me.nation);
      $$(".chip", natRow).forEach(x => x.classList.remove("on"));
      if (DU.me.nation !== "—") c.classList.add("on");
      duSendHello();
    });
    natRow.append(c);
  }
  id.append(natRow);
  root.append(id);

  const log = h("div", { class: "card", id: "ro-log" }, h("h2", {}, "Duel log"));
  duRenderLog(log);
  root.append(log);
  indexCard("rolloff", "duel-menu", "Duel two phones paired QR roll-off initiative",
    "host join scan QR webrtc verified fair plain roll-off opposed test");
}

function duRenderLog(card) {
  $$(".logrow", card).forEach(e => e.remove());
  const entries = SessionLog.all();
  if (!entries.length) card.append(h("p", { class: "logrow sub" }, "No duels yet."));
  for (const e of entries.slice(0, 10)) {
    card.append(h("div", { class: "logrow" + (e.voided ? " voided" : "") },
      h("span", { class: "lr-dice" },
        e.kind === "melee" ? "Melee: " + e.detail + " — " + e.winner : (e.detail || "") + (e.result ? " → " + e.result : "")),
      h("div", { class: "sub" }, new Date(e.ts).toLocaleTimeString())));
  }
}

/* ---------- pairing screens ---------- */
function duPairCard(title) {
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  const card = h("div", { class: "card", style: "text-align:center;" },
    h("div", { class: "flagrow", style: "justify-content:space-between;" },
      h("h2", { style: "margin:0;" }, title),
      h("button", { class: "iconbtn", onclick: () => { Pair.close(); buildRolloff(); } }, "✕")));
  root.append(card);
  return card;
}

async function duHost() {
  DU.mode = "host"; DU.stage = "pairing";
  const card = duPairCard("Hosting — step 1 of 2");
  card.append(h("p", { class: "sub" }, "Making your code…"));
  duWirePair();
  try {
    const text = await Pair.hostStart();
    card.append(renderQR(text, 250));
    card.append(h("p", { class: "sub" }, "The other player taps JOIN on their phone and points the camera at this square. When a REPLY code appears on their screen:"));
    card.append(h("button", {
      class: "bigbtn", onclick: () => {
        const scanBox = h("div", {});
        card.append(scanBox);
        const sc = scanQR(async data => {
          try { await Pair.hostFinish(data); scanBox.innerHTML = "<p class='sub'>Reply accepted — linking…</p>"; }
          catch (e) { scanBox.append(h("p", { class: "walkerr" }, "That wasn't a reply code — try again.")); }
        }, err => duCameraFallback(scanBox, async t => { await Pair.hostFinish(t); }));
        DU.scanners.push(sc);
        scanBox.append(sc.el);
      }
    }, "📷 Step 2 — SCAN their reply"));
    card.append(h("details", {}, h("summary", {}, "camera trouble? swap codes by message instead"),
      duManualOut(text), duManualIn(async t => { await Pair.hostFinish(t); })));
  } catch (e) {
    card.append(h("p", { class: "walkerr" }, "Could not create the code: " + e.message));
  }
}

function duJoin() {
  DU.mode = "join"; DU.stage = "pairing";
  const card = duPairCard("Joining — scan the host's code");
  duWirePair();
  const scanBox = h("div", {});
  card.append(scanBox);
  const sc = scanQR(async data => {
    try {
      scanBox.innerHTML = "<p class='sub'>Code accepted — making your reply…</p>";
      const answer = await Pair.joinWithOffer(data);
      scanBox.innerHTML = "";
      scanBox.append(
        h("p", { class: "sub" }, "Now show THIS reply code to the host (they tap SCAN on their phone):"),
        renderQR(answer, 250),
        h("p", { class: "sub" }, "Waiting for the link…"),
        h("details", {}, h("summary", {}, "camera trouble on their side?"), duManualOut(answer)));
    } catch (e) {
      scanBox.append(h("p", { class: "walkerr" }, "That wasn't a host code — try again."));
    }
  }, err => duCameraFallback(scanBox, async t => {
    const answer = await Pair.joinWithOffer(t);
    scanBox.append(h("p", { class: "sub" }, "Send this reply code back to the host:"), duManualOut(answer));
  }));
  DU.scanners.push(sc);
  scanBox.append(sc.el);
}

function duCameraFallback(box, onText) {
  box.innerHTML = "";
  box.append(h("p", { class: "walkerr" }, "Camera not available — swap the codes by message instead:"));
  box.append(duManualIn(onText));
}
function duManualOut(text) {
  const ta = h("textarea", { readonly: "", style: "width:100%;height:70px;font-size:11px;background:var(--card2);color:var(--ink);border-radius:8px;border:1px solid var(--line);" });
  ta.value = text;
  const btn = h("button", { class: "bigbtn alt", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(text); btn.textContent = "✓ copied — paste it to the other phone (WhatsApp etc.)"; } }, "Copy code");
  return h("div", {}, ta, btn);
}
function duManualIn(onText) {
  const ta = h("textarea", { placeholder: "paste the other phone's code here", style: "width:100%;height:70px;font-size:11px;background:var(--card2);color:var(--ink);border-radius:8px;border:1px solid var(--line);" });
  const btn = h("button", {
    class: "bigbtn alt", onclick: async () => {
      try { await onText(ta.value.trim()); btn.textContent = "accepted — linking…"; }
      catch (e) { btn.textContent = "that code didn't work — check and retry"; }
    }
  }, "Use pasted code");
  return h("div", {}, ta, btn);
}

/* ---------- the live duel ---------- */
function duWirePair() {
  Pair.onOpen = () => { DU.stage = "linked"; duSendHello(); duSendMods(); duelScreen(); buzz(60); };
  Pair.onClose = () => {
    if (DU.stage === "linked" || DU.stage === "pairing") {
      DU.stage = "dropped";
      duSolo("Connection lost — carried on in single-phone mode. Your modifiers are kept.");
    }
  };
  Pair.onMessage = duOnMessage;
}

function duSendHello() { Pair.send({ t: "hello", name: DU.me.name, nation: DU.me.nation }); }
function duSendMods() {
  Pair.send({ t: "mods", chips: DU.me.chips, wheels: DU.me.wheels, supports: DU.me.supports.map(s => ({ degraded: !!s.degraded })) });
}

async function duOnMessage(m) {
  const P = DU.peer;
  switch (m.t) {
    case "hello": P.name = m.name || ""; P.nation = m.nation || "—"; duelRefresh(); break;
    case "type": DU.type = m.k; duelRefresh(); break;
    case "role": DU.hostIsCharger = !!m.hostIsCharger; duelRefresh(); break;
    case "mods": P.chips = m.chips || []; P.wheels = m.wheels || P.wheels; P.supports = (m.supports || []).map(s => ({ degraded: !!s.degraded, spent: false })); duelRefresh(); break;
    case "ready": P.ready = !!m.on; duelRefresh(); await duMaybeCommit(); break;
    case "commit": P.commit = m.h; await duMaybeReveal(); break;
    case "reveal": {
      P.seed = m.seed;
      P.verified = (await sha256hex(m.seed)) === P.commit;
      P.dice = diceFromSeed(m.seed);
      duelRefresh(); duMaybeRolled();
      break;
    }
    case "reroll": {
      // peer re-rolled one of THEIR dice — value derives from their
      // already-revealed committed seed, so we compute it ourselves
      let v = rerollFromSeed(P.seed, P.rerollsUsed);
      if (m.degraded) v = Math.max(1, v - 1);
      P.rerollsUsed++;
      P.dice[m.die] = v;
      duelRefresh();
      break;
    }
    case "lock": P.locked = true; duelRefresh(); duMaybeTheatre(); break;
    case "rematch": duRematch(false); break;
  }
}

async function duMaybeCommit() {
  if (DU.me.ready && DU.peer.ready && !DU.me.commit) {
    DU.me.seed = randomSeed();
    DU.me.commit = await sha256hex(DU.me.seed);
    Pair.send({ t: "commit", h: DU.me.commit });
    await duMaybeReveal();
  }
}
async function duMaybeReveal() {
  if (DU.me.commit && DU.peer.commit && !DU.me.dice) {
    Pair.send({ t: "reveal", seed: DU.me.seed });
    DU.me.dice = diceFromSeed(DU.me.seed);
    DU.me.verified = true; // own dice are trivially honest to ourselves
    duelRefresh(); duMaybeRolled();
  }
}
function duMaybeRolled() {
  if (DU.me.dice && DU.peer.dice) { buzz(40); duelRefresh(); }
}

function duRematch(broadcast) {
  if (broadcast) Pair.send({ t: "rematch" });
  for (const s of [DU.me, DU.peer]) {
    s.ready = false; s.commit = null; s.seed = null; s.dice = null;
    s.verified = null; s.rerollsUsed = 0; s.locked = false;
    s.supports.forEach(x => x.spent = false);
  }
  $("#theatre").classList.remove("on");
  duelScreen();
}

function duelScreen() {
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  root.append(h("div", { class: "card", id: "duel-head" }));
  root.append(h("div", { class: "card", id: "duel-mine" }));
  root.append(h("div", { class: "card sidecard def", id: "duel-theirs" }));
  duelRefresh(true);
}

function duelRefresh(full) {
  if (DU.stage !== "linked") return;
  const head = $("#duel-head");
  if (!head) return;

  /* header: link state, type, role */
  head.innerHTML = "";
  head.append(h("div", { class: "flagrow", style: "justify-content:space-between;" },
    h("h2", { style: "margin:0;" }, "🔗 Linked duel"),
    h("button", { class: "iconbtn", onclick: () => { Pair.close(); buildRolloff(); } }, "✕")));
  const seg = h("div", { class: "seg" });
  for (const t of RO_TYPES) {
    const b = h("button", { class: DU.type === t.k ? "on" : "" }, t.l);
    b.addEventListener("click", () => { DU.type = t.k; Pair.send({ t: "type", k: t.k }); duelRefresh(); });
    seg.append(b);
  }
  head.append(seg);
  const iAmCharger = DU.mode === "host" ? DU.hostIsCharger : !DU.hostIsCharger;
  if (DU.type !== "plain") {
    head.append(h("div", { class: "flagrow" },
      h("span", { class: "sub" }, "You are the " + (iAmCharger ? "CHARGER" : "DEFENDER")),
      DU.mode === "host" ? h("button", {
        class: "chip", onclick: () => { DU.hostIsCharger = !DU.hostIsCharger; Pair.send({ t: "role", hostIsCharger: DU.hostIsCharger }); duelRefresh(); }
      }, "swap sides") : null));
  }

  /* my editable panel */
  duSidePanel($("#duel-mine"), DU.me, true);
  /* their mirrored panel */
  duSidePanel($("#duel-theirs"), DU.peer, false);
}

function duSidePanel(card, S, mine) {
  card.innerHTML = "";
  const who = (S.nation !== "—" ? S.nation : (mine ? "You" : "Opponent"));
  card.append(h("h2", {}, who + (mine ? " (this phone)" : "")));

  if (mine && !S.dice) {
    // chips
    const cw = h("div", { class: "chips" });
    for (const c of RO_CHIPS) {
      const on = S.chips.some(x => x.l === c.l);
      const chip = h("button", { class: "chip" + (on ? " on" : "") + (c.v < 0 ? " neg" : "") }, c.l, h("small", {}, fmtMod(c.v)));
      chip.addEventListener("click", () => {
        const i = S.chips.findIndex(x => x.l === c.l);
        if (i >= 0) S.chips.splice(i, 1); else S.chips.push({ l: c.l, v: c.v });
        duSendMods(); duelRefresh(); buzz(10);
      });
      cw.append(chip);
    }
    card.append(h("div", { class: "grouplabel" }, "Named modifiers"), cw);

    // wheels
    const wr = h("div", { class: "wheelrow" });
    const ranges = { Grade: [-1, 2], Formation: [-2, 2], Situation: [-4, 4], Other: [-3, 3] };
    for (const [name, [lo, hi]] of Object.entries(ranges)) {
      const vals = []; for (let i = lo; i <= hi; i++) vals.push(i);
      wr.append(makeWheel(name, vals, vals.indexOf(S.wheels[name]), v => {
        S.wheels[name] = v; duSendMods(); duNetRefresh();
      }).el);
    }
    card.append(h("div", { class: "grouplabel" }, "Wheels (freeform)"), wr);

    // supports
    const supWrap = h("div", { class: "chips" });
    const drawSup = () => {
      supWrap.innerHTML = "";
      S.supports.forEach((sp, i) => {
        const b = h("button", { class: "chip on" + (sp.degraded ? " neg" : "") }, "S" + (i + 1), h("small", {}, sp.degraded ? "degraded −1" : "normal"));
        b.addEventListener("click", () => { sp.degraded = !sp.degraded; duSendMods(); drawSup(); });
        supWrap.append(b);
      });
    };
    const st = makeStepper(0, 3, S.supports.length, v => {
      while (S.supports.length < v) S.supports.push({ degraded: false, spent: false });
      S.supports.length = v;
      duSendMods(); drawSup();
    });
    drawSup();
    card.append(h("div", { class: "grouplabel" }, "Supports (re-roll tokens)"),
      h("div", { class: "flagrow" }, st.el, h("span", { class: "sub" }, "tap to mark degraded")), supWrap);
  }

  // declared list (both panels — the at-the-table honesty mirror)
  const ul = h("ul", { class: "whylist" });
  for (const c of S.chips) ul.append(h("li", {}, c.l, h("b", {}, fmtMod(c.v))));
  for (const [k, v] of Object.entries(S.wheels)) if (v) ul.append(h("li", {}, k + " wheel", h("b", {}, fmtMod(v))));
  if (S.supports.length) ul.append(h("li", {}, "supports", h("b", {}, S.supports.length + (S.supports.some(s => s.degraded) ? " (some −1)" : ""))));
  if (!ul.children.length) ul.append(h("li", {}, "nothing declared", h("b", {}, "0")));
  card.append(h("div", { class: "grouplabel" }, "Declared"), ul);
  card.append(h("div", { class: "netrow" }, h("span", { class: "netmod", "data-du-net": mine ? "me" : "peer" }, fmtMod(duNet(S))), h("span", { class: "sub" }, "net")));

  // dice / status
  const diceWrap = h("div", { class: "dicepair", "data-du-dice": mine ? "me" : "peer" });
  card.append(diceWrap);
  if (S.dice) {
    const apis = [makeDie(!mine), makeDie(!mine)];
    diceWrap.append(apis[0].el, apis[1].el);
    setTimeout(() => { apis[0].roll(S.dice[0]); apis[1].roll(S.dice[1]); }, 60);
    card.append(h("div", { class: "totalbig" }, String(duTotal(S))),
      h("div", { class: "totalsub" }, S.dice[0] + " + " + S.dice[1] + " " + fmtMod(duNet(S)) + " mod  ·  " +
        (S.verified === null ? "" : S.verified ? "✓ verified fair" : "⚠ FAIRNESS CHECK FAILED")));
    // my tokens
    if (mine && !S.locked) {
      const tk = h("div", { class: "chips", style: "justify-content:center;" });
      S.supports.forEach(sp => {
        const tok = h("button", { class: "token" + (sp.spent ? " spent" : "") }, h("span", { class: "mini" }), "re-roll" + (sp.degraded ? " −1" : ""));
        tok.addEventListener("click", () => {
          if (sp.spent) return;
          const pick = h("div", { class: "chips" },
            h("button", { class: "chip" }, "Die 1 (" + S.dice[0] + ")"),
            h("button", { class: "chip" }, "Die 2 (" + S.dice[1] + ")"),
            h("button", { class: "chip neg" }, "cancel"));
          tok.after(pick);
          const doRe = idx => {
            pick.remove(); sp.spent = true;
            let v = rerollFromSeed(S.seed, S.rerollsUsed);
            if (sp.degraded) v = Math.max(1, v - 1);
            S.rerollsUsed++;
            S.dice[idx] = v;
            Pair.send({ t: "reroll", die: idx, degraded: !!sp.degraded });
            duelRefresh(); buzz(20);
          };
          $$("button.chip", pick)[0].addEventListener("click", () => doRe(0));
          $$("button.chip", pick)[1].addEventListener("click", () => doRe(1));
          $$("button.chip", pick)[2].addEventListener("click", () => pick.remove());
        });
        tk.append(tok);
      });
      card.append(tk);
      card.append(h("button", {
        class: "bigbtn", onclick: () => { S.locked = true; Pair.send({ t: "lock" }); duelRefresh(); duMaybeTheatre(); }
      }, "LOCK RESULT"));
    }
    if (S.locked) card.append(h("p", { class: "sub", style: "text-align:center;" }, "locked ✓"));
  } else if (mine) {
    const rb = h("button", {
      class: "bigbtn" + (S.ready ? " alt" : ""), onclick: async () => {
        S.ready = !S.ready;
        Pair.send({ t: "ready", on: S.ready });
        duelRefresh();
        await duMaybeCommit();
      }
    }, S.ready ? "✓ READY — waiting for opponent…" : "READY");
    card.append(rb);
    if (DU.peer.ready && !S.ready) card.append(h("p", { class: "note" }, "Opponent is ready — the roll fires the moment you are."));
  } else {
    card.append(h("p", { class: "sub", style: "text-align:center;" }, S.ready ? "READY ✓" : "setting modifiers…"));
  }
}

function duNetRefresh() {
  const e = $('[data-du-net="me"]');
  if (e) e.textContent = fmtMod(duNet(DU.me));
}

function duMaybeTheatre() {
  if (!(DU.me.locked && DU.peer.locked)) return;
  const my = duTotal(DU.me), their = duTotal(DU.peer);
  const iWin = my > their, tie = my === their;
  const diff = Math.abs(my - their);
  const iAmCharger = DU.mode === "host" ? DU.hostIsCharger : !DU.hostIsCharger;
  const chargerDiff = iAmCharger ? my - their : their - my;
  let resultLine = null, band = null;
  if (DU.type !== "plain" && !tie) {
    band = chargeBand(chargerDiff);
    resultLine = band[DU.type];
  }

  SessionLog.add({
    kind: "duel",
    detail: "You " + DU.me.dice.join("+") + fmtMod(duNet(DU.me)) + "=" + my + " vs " +
      (DU.peer.nation !== "—" ? DU.peer.nation : "opponent") + " " + DU.peer.dice.join("+") + fmtMod(duNet(DU.peer)) + "=" + their +
      (DU.me.verified && DU.peer.verified ? " ✓fair" : ""),
    winner: tie ? "tie" : iWin ? "you" : "them",
    result: resultLine || (tie ? "tie" : "by " + diff)
  });

  // each phone shows its OWN fate
  const t = $("#theatre");
  t.innerHTML = "";
  const cardEl = h("div", { class: "theatrecard" });
  if (tie) {
    cardEl.append(h("div", { class: "vbanner" }, "TIED"), h("div", { class: "sub" }, my + " apiece"));
  } else if (iWin) {
    cardEl.append(
      h("div", { class: "burst", style: "--burst:" + NATION_TINTS[DU.me.nation], html: SVG_WINNER }),
      h("div", { class: "vbanner win" }, WIN_WORD[DU.me.nation] || "VICTORY!"),
      h("div", { class: "sub" }, "You win by " + diff + (DU.peer.verified ? "  ·  ✓ verified fair" : "")));
  } else {
    cardEl.append(
      h("div", { class: "burst", style: "--burst:#3a3f4d", html: SVG_LOSER }),
      h("div", { class: "vbanner lose" }, "DEFEATED"),
      h("div", { class: "sub" }, "Lost by " + diff + (DU.peer.verified ? "  ·  ✓ verified fair" : "")));
  }
  if (resultLine) {
    cardEl.append(h("div", { class: "vresult" }, resultLine));
    if (/Volley!/.test(resultLine)) cardEl.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[0]));
    if (/Victory!/.test(resultLine)) cardEl.append(h("p", { class: "note" }, CHARGE_RESULT_NOTES[1]));
    const det = h("details", {}, h("summary", {}, "view full table"));
    det.append(renderChargeTable(band, DU.type));
    cardEl.append(det);
  }
  cardEl.append(
    h("button", { class: "bigbtn", onclick: () => duRematch(true) }, "Rematch (stay linked)"),
    h("button", { class: "bigbtn alt", onclick: () => { t.classList.remove("on"); } }, "Close"));
  t.append(cardEl);
  t.classList.add("on");
  buzz(80);
}

/* ---------- single-phone plain roll-off ---------- */
let SOLO = null;

function duSolo(notice) {
  DU.mode = "solo"; DU.stage = "solo";
  SOLO = {
    sides: [
      { name: "Side A", net: 0, wheels: { Mod: 0 }, dice: null, apis: null },
      { name: "Side B", net: 0, wheels: { Mod: 0 }, dice: null, apis: null }
    ]
  };
  const root = $("#tab-rolloff");
  root.innerHTML = "";
  if (notice) root.append(h("div", { class: "trigbanner" }, notice));
  const card = h("div", { class: "card" },
    h("div", { class: "flagrow", style: "justify-content:space-between;" },
      h("h2", { style: "margin:0;" }, "Plain roll-off"),
      h("button", { class: "iconbtn", onclick: buildRolloff }, "✕")),
    h("p", { class: "sub" }, "Opposed 2D6 + modifier, winner and difference only — initiative, any opposed test. For charges use the ⚔️ Charge tab."));
  root.append(card);
  const grid = h("div", { class: "duelgrid" });
  for (const s of SOLO.sides) {
    const sc = h("div", { class: "card" + (s === SOLO.sides[1] ? " sidecard def" : " sidecard") });
    sc.append(h("h2", {}, s.name));
    const vals = []; for (let i = -5; i <= 5; i++) vals.push(i);
    sc.append(h("div", { class: "wheelrow", style: "justify-content:center;" },
      makeWheel("Modifier", vals, 5, v => { s.net = v; soloShow(s); }).el));
    sc.append(h("div", { class: "dicepair", "data-solo": s.name }));
    sc.append(h("div", { class: "totalbig", "data-solo-t": s.name }, ""));
    const rb = h("button", {
      class: "bigbtn", onclick: () => {
        if (s.dice) return;
        const wrap = $('[data-solo="' + s.name + '"]');
        s.apis = [makeDie(s === SOLO.sides[1]), makeDie(s === SOLO.sides[1])];
        wrap.append(s.apis[0].el, s.apis[1].el);
        rb.style.display = "none";
        setTimeout(() => {
          s.dice = [s.apis[0].roll(d6()), s.apis[1].roll(d6())];
          setTimeout(() => { soloShow(s); soloVerdict(root); }, 650);
        }, 50);
      }
    }, "ROLL");
    sc.append(rb);
    grid.append(sc);
  }
  root.append(grid, h("div", { class: "card resultpanel", id: "solo-verdict" },
    h("p", { class: "sub" }, "Both sides set a modifier and ROLL.")));
}

function soloShow(s) {
  const t = $('[data-solo-t="' + s.name + '"]');
  if (t && s.dice) t.textContent = String(s.dice[0] + s.dice[1] + s.net);
}
function soloVerdict(root) {
  const [a, b] = SOLO.sides;
  if (!(a.dice && b.dice)) return;
  const ta = a.dice[0] + a.dice[1] + a.net, tb = b.dice[0] + b.dice[1] + b.net;
  const v = $("#solo-verdict");
  v.innerHTML = "";
  v.append(h("h2", {}, "Verdict"),
    h("div", { class: "bigdiff " + (ta === tb ? "" : "good") },
      ta === tb ? "TIED" : (ta > tb ? "SIDE A" : "SIDE B") + " WINS"),
    h("div", { class: "sub" }, ta + " vs " + tb + (ta === tb ? "" : " · by " + Math.abs(ta - tb))),
    h("button", { class: "bigbtn alt", onclick: () => duSolo() }, "Again"));
  SessionLog.add({
    kind: "duel",
    detail: "Plain: A " + a.dice.join("+") + fmtMod(a.net) + "=" + ta + " vs B " + b.dice.join("+") + fmtMod(b.net) + "=" + tb,
    winner: ta === tb ? "tie" : ta > tb ? "Side A" : "Side B",
    result: ta === tb ? "tie" : "by " + Math.abs(ta - tb)
  });
}
