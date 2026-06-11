/* Scenario definition — PURE DATA. The tracker renders whatever this
   object says; future scenarios are new files like this one, zero code
   change. Registered on a global list because file:// blocks fetch()
   of .json in several mobile browsers — same data, .js wrapper. */
window.GDA_SCENARIOS = window.GDA_SCENARIOS || [];
window.GDA_SCENARIOS.push({
  "id": "hochberg",
  "name": "The Action at Höchberg",
  "turns": 16,
  "objectives": [
    { "id": "mullerberg", "pts": 3, "label": "Müllerberg heights",
      "rule": "Allies own it only with a formed unit on the MAIN plateau and no French unit on that plateau. The smaller hill never decides it." },
    { "id": "hochberg",   "pts": 2, "label": "Höchberg village" },
    { "id": "kleinreuth", "pts": 1, "label": "Klein-Reuth" }
  ],
  "triggers": [
    { "turn": 1, "text": "Sacken arrives — full northern edge" },
    { "turn": 4, "text": "Yorck arrives — NE corner within 24\"" },
    { "turns": [6, 8, 10, 12, 14, 16], "type": "roll", "id": "lancers",
      "text": "French lancer roll — 1D6: on a 6, two lancer regiments enter from the southern rear edge (1 ADC to release; they JOIN the French cavalry brigade — part of it for command, taskings, support and falter purposes).",
      "onceOnly": true },
    { "turn": 16, "text": "LAST TURN — score objectives & dispersals." }
  ],
  "trackers": [
    { "id": "dispersals", "label": "French battalions dispersed", "max": 20,
      "thresholds": { "warn": 6, "trigger": 11 },
      "warnText": "6 = French-marginal ceiling",
      "triggerText": "Allied dispersal victory trigger met" },
    { "id": "caissons", "label": "Caissons", "perGroup": 2,
      "groups": ["GB1", "GB2", "FrGB"],
      "optionalGroups": { "FrGB": "French Grand Battery declared" } }
  ],
  "initiative": {
    "sides": ["French", "Allied"],
    "note": "Draw → last turn's holder keeps it. French may spend ADCs at +1 each."
  },
  "victory": {
    /* Ladder encoded as ordered rules over objectives + trackers.
       First matching band (top down) wins. frPts/alPts = objective
       points held; disp = dispersals tracker; sauve = manual toggle. */
    "bands": [
      { "label": "ALLIED DECISIVE",  "rule": "alPts>=5 || (alPts>=4 && disp>=11)" },
      { "label": "FRENCH DECISIVE",  "rule": "frPts>=5 && !sauve" },
      { "label": "ALLIED MARGINAL",  "rule": "(alPts>=4 && alHasMullerberg) || disp>=11" },
      { "label": "FRENCH MARGINAL",  "rule": "frPts>=4 && frHasMullerberg && disp<=6" },
      { "label": "DRAW",             "rule": "true" }
    ],
    "manualFlags": [
      { "id": "sauve", "label": "Any French Sauve Qui Peut occurred?" }
    ],
    "note": "Per the scenario ladder: Fr Decisive 5–6 pts & no Sauve Qui Peut · Fr Marginal 4 pts incl. Müllerberg & ≤6 dispersed · Draw bands at 7–10 · Allied Marginal 4+ pts incl. Müllerberg OR 11+ dispersals · Allied Decisive 5–6 pts OR 4+ pts AND 11+."
  },
  "reminders": [
    "ADC availability 3+ (reserve side: one ADC on 5+ while a reserve is hidden; Yorck's 6th ADC automatic — no roll; Blücher: 3 ADCs rolled, ALL to ONE division).",
    "Charge targets cannot counter-declare.",
    "Faltering brigades cannot declare charges.",
    "Pavlov battalion-gun check at 4+ casualties."
  ],
  "setup": [
    "Wathiez forward: 1 bn garrisons Klein-Reuth, 5 within 6\" east",
    "French Grand Battery declared? (optional, foot batteries only — excludes the cavalry horse battery)",
    "Off-table reserve: Sacken OR Yorck OR French brigade (one per side)",
    "Blücher: 3 ADCs to ONE division per turn"
  ]
});
