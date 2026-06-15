window.GDA_VERSION = "19";   // shown on the Duel tab; bump with sw VERSION

/* ============================================================
   GdA Companion — embedded rules data (SPEC v2, 2026-06-12).
   §10 content is VERIFIED against rulebook & FAQ by the umpire.
   Only the two §10.7 items remain open. DO NOT edit values
   without umpire sign-off. Flag inconsistencies, never "fix".
   ============================================================ */

const CHARGE_MODS = {
  grade: { Elite: +2, Veteran: +1, Line: 0, Recruit: -1 },
  gradeNote: "Recruit penalty is 0 (not −1) if the Recruit unit is in column or square. General attached: test as the next grade up.",
  formation: {
    unformed: -2,
    infColumnOrSquareVsCav: +2,
    infLineVsCav: -2,
    squareVsInfantry: -2,
    cavNarrowerFrontage: -1
  },
  charger: {
    chargingOn: +1, heavyCav: +1, lancersVsInf: +1,
    campaignCavVsHeavy: -1,
    chargeCasualties: { "2": -1, "3-4": -2, "5+": -3, eliteImmune2: true },
    unitCasualties: { "4+": -1, "8+": -2 },
    brigadeState: { hesitant: -1, faltering: -1, demoralised: -1 }
  },
  defender: { flanked: -2, flankRearCharged: -4 },
  supports: "Each Elite/Veteran/Line support grants one D6 re-roll. Recruit, massed-column, square, line-vs-cavalry or unformed supports grant a re-roll at −1. Artillery, skirmishers and garrisons NEVER provide a support re-roll (artillery contributes defensive fire only). Cavalry cannot support infantry; infantry cannot support cavalry; both can support artillery. Flank supports must be within 3\" when the charge is declared (level with, behind, or in front of the lead unit)."
};

/* §3.2b — interaction logic the calculator ENFORCES (not footnotes) */
const CHARGE_LOGIC = [
  "If the defender is charged in FLANK or REAR: suppress the infantry column/square-vs-cavalry +2 — a column charged in flank/rear gets NO column bonus (it still takes the −4).",
  "'Column of mob' (a retiring, retreating or routing unformed mass): NO column bonus ever, regardless of facing.",
  "Unformed Square vs cavalry: +2 (square) and −2 (unformed) BOTH apply — net 0. The app must show both lines, not silently cancel.",
  "Recruit grade penalty is 0 (not −1) while the Recruit unit is in column or square.",
  "Elite units ignore the first charge-casualty band (the −1 at 2 casualties); −2/−3 bands still apply.",
  "Skirmisher-screened target: the screen evades (fires first only vs infantry chargers); ALL casualties — screen plus close-order defensive fire — count toward the charger's charge-casualty modifier.",
  "Faltering brigade: cannot DECLARE charges; a charge declared before the falter continues at −1 (the brigade-state chip)."
];

const CHARGE_RESULTS = [
  { by: "6+",    min: 6,   max: 99,  infVsInfArty: "Victory! / Def Rout 1D6",           cavVsCav: "Victory! / Def Rout 1D6",         cavVsInfArty: "Victory! 1 cas / Ridden Down" },
  { by: "3–5",   min: 3,   max: 5,   infVsInfArty: "Take Ground / Def Retreat 1D3",     cavVsCav: "Élan / Def Melee Unformed",       cavVsInfArty: "Victory! 1 cas / Ridden Down" },
  { by: "1–2",   min: 1,   max: 2,   infVsInfArty: "Élan / Def Melee Unformed",         cavVsCav: "Melee / Counter-charge",          cavVsInfArty: "Melee" },
  { by: "0/−2",  min: -2,  max: 0,   infVsInfArty: "Volley! Line 4/3/2 CD, Col 1 CD",   cavVsCav: "Melee / Counter-charge",          cavVsInfArty: "Retire 1 cas / Stand" },
  { by: "−3/−5", min: -5,  max: -3,  infVsInfArty: "Retire 1 cas / Def Stand",          cavVsCav: "Melee Unformed / C-charge",       cavVsInfArty: "—" },
  { by: "−6−",   min: -99, max: -6,  infVsInfArty: "Retreat 1D3 / Def Stand",           cavVsCav: "Retreat 1D3 / Def Take Grnd",     cavVsInfArty: "Retreat 1D3 / Def Stand" }
];

const CHARGE_RESULT_NOTES = [
  "Volley! result: Large bn 4 CD, Standard 3, Small 2; firer unformed → treat as lost by −1/−2 instead.",
  "Victory! → winner must choose Charge On (inf +3D6\", cav +5D6\") or Take Ground.",
  "Charges are SIMULTANEOUS: all phasing chargers move to the 3\" point BEFORE any defensive fire or reactions (FAQ)."
];

/* ---------- fire (§4 + §10.3 verified two-part model) ---------- */
const FIRE_RULES = {
  halving: "HALVE casualties (round down) if: (1) the FIRER is in Column or Square, or (2) the TARGET is a BUA/Strongpoint garrison. Both apply together: a column firing at a garrison halves twice (quarter effect).",
  skirmishScreens: "Skirmisher screens block line of sight for close-order musketry, but ARTILLERY ignores skirmisher screens for targeting — they give no protection to close-order troops behind them.",
  measurement: "Measure from the centre of the firer's front edge to the nearest point of the target. Players may pre-measure before declaring fire.",
  doubleSix: "Double 6 on CASUALTY dice does NOT trigger Destiny — only initial 2D6 rolls do.",
  assaultFire: "Artillery Assault Fire tasking: +2 CD; battery ignores counter-battery priority; an FC result then costs 2 casualties.",
  largeBattery: "Large (12-gun) battery: +1 CD firing canister; ignores its FIRST Fatigue Casualty result; −2 fire penalty only from 8+ casualties; disperses at 10+ (standard battery: 6+/8+).",
  grandBattery: "Grand Battery (1813, max 2 batteries, 2 caissons): spend a caisson → BOTH batteries Assault Fire under ONE tasking. Caissons spent → one battery per turn may Assault Fire."
};

/* §10.3 — VERIFIED firing model: 2D6 score (with NEGATIVE score
   modifiers) → results-line base casualties, PLUS bonus Casualty Dice
   (each hitting 4–6). Halving applies to the FINAL total, round down. */
const FIRING_TABLE = { // modified 2D6 score → result. — = no effect.
  scores:          ["≤3", "4", "5", "6", "7", "8", "9", "10-11", "12"],
  superiorVolley:  ["FD", "1", "1", "2", "3", "3/DT", "4/DT", "5/DT", "6/DT"],
  standardVolley:  ["FD", "FD", "1", "1", "2", "3", "3/DT", "4/DT", "5/DT"],
  inferiorVolley:  ["FD", "FD", "FD if Recruit", "1", "1", "2", "2/DT", "3/DT", "4/DT"],
  batteryClose:    ["FC", "½", "1", "2", "2/DT", "3/DT", "3/DT", "4/DT", "5/DT"],
  batteryEffective:["FC", "—", "1", "1", "1", "2", "2/DT", "3/DT", "4/DT"],
  batteryLong:     ["FC", "—", "½", "½", "½", "1", "1/DT", "2/DT", "3/DT"]
};
const FIRING_LINES = {
  superiorVolley:   { label: "Superior volley",  who: "Elite/Veteran/British (Large & Standard, not moved, FD intact)" },
  standardVolley:   { label: "Standard volley",  who: "Line (non-British), not moved, FD intact" },
  inferiorVolley:   { label: "Inferior volley",  who: "Recruit / Small / moved / Unformed / lost FD / rough terrain / column of companies" },
  batteryClose:     { label: "Battery — canister/close", who: "" },
  batteryEffective: { label: "Battery — effective",      who: "" },
  batteryLong:      { label: "Battery — long",           who: "" }
};
const FIRE_MODIFIERS = {
  infantryCD: { elite: "+1 CD", largeBattalionInLine: "+1 CD", columnAt3inFresh: "+1 CD vs infantry column at 3\" if firers Fresh", targetSquareOrMassedColumns: "+2 CD" },
  infantryScore: { casualties4: "−1", casualties8: "−2 (10+ for Elite/Large)", targetDeployedBatteryOrSkirmishers: "−2", targetInCover: "−1", unformed: "−2 and Inferior line" },
  artilleryCD: { eliteBattery: "+1 CD (also inflicts DT)", largeBatteryCanister: "+1 CD", assaultFire: "+2 CD", targetColumnAtEffectiveOrClose: "+1 CD", targetSquareOrMassedColumns: "+2 CD" },
  artilleryScore: { casualties4: "−1", casualties6: "−2 (8+ for Elite/Large)", movedOrUnlimbered: "−2", unformed: "−2", lowOnAmmunition: "−2 (each)", targetDeployedBatteryOrSkirmishers: "−2", targetInCover: "−1" },
  flags: "FD = firer loses Fire Discipline (fires Inferior; no move/formation change except into Square until stationary one Movement phase). DT = target takes Discipline Test. FC = battery loses 1 Fatigue Casualty (2 on Assault Fire; Elite & Large batteries ignore the FIRST FC). Double 6 = Destiny. Artillery double 1 = Low on Ammunition. Bounce-through: unit within 6\" directly behind the target suffers 1 CD."
};

/* ---------- §10.1 movement (VERIFIED, rulebook p56) ---------- */
const MOVEMENT = {
  infantry: { line: '6"', column: '9"', square: '4" (Discipline Test if enemy cavalry within 9")', skirmish: '12"', evadeRetire: 'up to 12"', retreatRout: 'up to 18" — fall back on supports' },
  cavalry: { line: '15"', skirmishEvadeRetire: 'up to 21"', retreatRout: 'up to 21"' },
  horseArtillery: '15" (otherwise as cavalry)',
  footArtillery: '9", evade/retire up to 12"',
  generals: '18" (incl. corps commanders); once attached, move with the unit',
  chargeBonus: { infantry: '+3"', cavalry: '+6"' },
  stepBack: { infantry: '3"', cavalry: '9"', manhandleOrWheelBattery: 'up to 3"' },
  moveToFlank: 'all units, max 3" side-step', oblique: 'up to 45°, normal speed',
  aboutFace: 'classed as a formation change; if charged, only Elite/Veteran may attempt (Discipline Test first)',
  minimumCloseDistance: 'no voluntary advance closer than 3" to enemy Close Order units outside the Charge/Melee phases',
  unformed: 'may only Reform on the spot OR Retire; voluntary Retire costs 1 Fatigue Casualty (skirmishers/Cossacks exempt)',
  roughTerrain: 'Close Order infantry HALF SPEED (and fire on Inferior line); squares may not enter; cavalry may not enter voluntarily (forced = 1 casualty); artillery limbered via road/track only, no deploying; formation changes take a FULL Movement phase; skirmishers & retiring/retreating/routing infantry unaffected',
  severeTerrain: 'skirmishers only, at half speed; retiring/retreating/routing non-skirmishers entering it DISPERSE',
  fallingBackThroughGaps: 'Unformed/Retiring units pass through any gap between formed friends without unforming them; Retreating/Routing units likewise AFTER their initial compulsory 6" straight back'
};

/* ---------- §10.2 ranges (VERIFIED, rulebook p76) ---------- */
const RANGES = {
  musketry: { square: '0–3"', volley: '0–9"', skirmish: '0–12"' },
  artillery: {
    '3-4pdr': { canister: '0–12"', effective: '12–21"', long: '21–50"' },
    '6-9pdr': { canister: '0–12"', effective: '12–24"', long: '24–55"' },
    '12pdr':  { canister: '0–15"', effective: '15–30"', long: '30–65"' }
  }
};

/* ---------- §10.4 faltering brigade (VERIFIED, QRS) ---------- */
const FALTER_TRIGGER = "Falter if: a brigade unit ROUTED, or 2+ brigade units RETREATING. A Demoralised brigade that Falters DISPERSES.";
const FALTER_TABLE = { // dice: 6–5 / 4 / 3 / 2 / 1
  Elite:       ["Obey Orders", "Obey Orders", "Rally", "Retire", "Retire"],
  VeteranLine: ["Obey Orders", "Rally", "Retire", "Retire", "Sauve Qui Peut!"],
  Recruit:     ["Obey Orders", "Rally", "Retire", "Sauve Qui Peut!", "Sauve Qui Peut!"]
};
const FALTER_DICE_LABELS = ["6–5", "4", "3", "2", "1"];
const FALTER_RESULTS = {
  "Rally": "Retreating units rally (Routed units Disperse). Remove Falter marker; brigade is Hesitant this turn. Units within 9\" of formed enemy Close Order must immediately Step Back (garrisons stay).",
  "Retire": "Retreating & Routed units Disperse. All remaining units immediately Retire (n/a in a Strongpoint); each Close Order unit loses 1 casualty; the Skirmish Line loses 1 full base. Artillery withdraws limbered; foot artillery goes Low on Ammo (ignore if deployed 18\"+ behind the brigade front line). Brigade remains Faltering.",
  "Sauve Qui Peut!": "Brigade loses its ADC permanently. Retreating/Routed units Disperse; Skirmish Line Disperses. All remaining units Retreat and lose 2 casualties each; artillery withdraws limbered, Low on Ammo (same 18\" exemption). Brigade remains Faltering."
};
const FALTER_NOTES = [
  "Obey: retreating/routing units rally immediately but are UNFORMED — they stay Unformed until a full Movement phase reforms them.",
  "A brigade auto-disperses on faltering only if it was ALREADY Demoralised when the dispersals happened; becoming Demoralised and faltering simultaneously does NOT auto-disperse.",
  "Units within 9\" of formed friends when retiring matter — an Unformed unit that cannot reach friendly support within its 20\" Retire becomes ROUTED."
];

/* ---------- §10.5 casualty levels & dispersal points (VERIFIED, p14) ---------- */
const CASUALTY_LEVELS = [ // Fresh / 1st (−1) / 2nd (−2) / Disperse
  { unit: "Elite infantry/cavalry",          fresh: "0–3", l1: "4+", l2: "10+", disperse: "15+" },
  { unit: "Large infantry/cavalry",          fresh: "0–3", l1: "4+", l2: "10+", disperse: "15+ (12+ if Recruits)" },
  { unit: "Standard infantry/cavalry",       fresh: "0–3", l1: "4+", l2: "8+",  disperse: "12+ (10+ if Recruits)" },
  { unit: "Small infantry/cavalry",          fresh: "0–3", l1: "4+", l2: "8+",  disperse: "10+" },
  { unit: "Elite or Large (12-gun) battery", fresh: "0–3", l1: "4+", l2: "8+",  disperse: "10+" },
  { unit: "Standard battery",                fresh: "0–3", l1: "4+", l2: "6+",  disperse: "8+" }
];
/* numeric dispersal defaults for the melee Pyrrhic check quick-set */
const DISPERSE_POINTS = [
  { label: "Elite", pt: 15 }, { label: "Large", pt: 15 }, { label: "Large Recruit", pt: 12 },
  { label: "Standard", pt: 12 }, { label: "Std Recruit", pt: 10 }, { label: "Small", pt: 10 },
  { label: "Elite/Large bty", pt: 10 }, { label: "Std battery", pt: 8 }
];

/* ---------- §10.6 melee (VERIFIED, QRS) ---------- */
const MELEE_CD = { infantry: 5, cavalry: 5, cossacks: 4, artillery: 3, hitOn: "4,5,6", minimum: "1 CD after modifiers" };
const MELEE_MODS = {
  unit: { eliteInfOrCav: "+1 CD", heavyCavalry: "+2 CD", formedLancersVsCavalry: "+1 CD (n/a vs Cuirassiers)", formedLancersVsFoot: "+2 CD", largeUnit: "+1 CD (n/a in column of companies, square, or a battery)", smallUnit: "−1 CD" },
  situation: { generalAttachedWithGlory: "+1 CD (no benefit without Glory; Risk to General if unit retires/retreats)", perGradeAboveOpponent: "+1 CD per grade above opponent/all opponents", elan: "+1 CD (+2 CD if infantry in Attack Column)", casualties: "4+/8+ (10+ Elite-Large) = −1/−2 CD", batteryCasualties: "4+/6+ (8+) = −1/−2 CD" },
  position: { unformed: "−1 CD", attackingBUAFirstRound: "−1 CD", attackingStrongpoint: "−1 CD", attackingRedoubtOrUpSteepSlope: "−1 CD", attackedInFlankOrRear: "−1 CD AND only negative CD modifiers apply (ignore ALL positives)", artilleryHitInFlankOrRear: "DISPERSES" }
};
const MELEE_RESULTS = { // casualty difference
  "3+":   { cavCavInfInf: "Winner Takes Ground / Losers ROUT*", cavVsInf: "Winner Takes Ground / losing infantry DISPERSE, losing cavalry Retreat", infVsBUA: "Winner Takes Ground / Losers Retreat" },
  "2":    { cavCavInfInf: "Winner: infantry Take Ground, cavalry Return to Own Lines / Losers Retreat*", cavVsInf: "(as band 1)", infVsBUA: "(as band 1)" },
  "1":    { cavCavInfInf: "Winner Takes Ground UNFORMED / Losers Retreat*", cavVsInf: "Winner Takes Ground Unformed / losing infantry Retreat*, losing cavalry Return to Own Lines", infVsBUA: "1st round Fight On! / 2nd round Loser Retreats" },
  "DRAW": { cavCavInfInf: "Infantry vs Infantry: FIREFIGHT! · Cavalry vs Cavalry: Fight On!", cavVsInf: "Infantry Stand* / Cavalry Return to Own Lines", infVsBUA: "1st round Fight On! / 2nd round Attackers Retire" }
};
const MELEE_MATCHUPS = { cavCavInfInf: "Cav v Cav · Inf v Inf", cavVsInf: "Cav vs Inf", infVsBUA: "Inf vs BUA" };
const MELEE_NOTES = [
  "Fight On! = fight a 2nd round or Retire; DEFENDER chooses first. If the opponent Retires, Take the Ground Unformed. If both Fight On, ALL units in the melee are now Unformed and may be reinforced by units within support distance. Maximum 2 melee rounds per Melee phase; a 2nd draw = Attacker Retires.",
  "Firefight! = Attacker retires 3\"; all units in the melee are Unformed; defending artillery limbers and retires.",
  "*Artillery uses the infantry results columns; Routing or Retreating artillery DISPERSES.",
  "Pyrrhic Victory: a winner reaching its OWN dispersal point flips the result — the loser becomes the winner, ignores retreat/rout, takes the ground Unformed.",
  "Round-1 participants: lead unit + flank supports that physically reached base-to-base. Rear supports and other reinforcements join from round 2 (formed, in-command, within support distance)."
];

/* ---------- nations / terrain / tactics (unchanged content) ---------- */
const NATIONS = {
  France: [
    "Command: French column (best). Flexible group — brigadiers attach freely.",
    "Skirmish: most flexible; light bns skirmish with NO −1 base penalty.",
    "Artillery: pure artillery brigades allowed; may NOT Redeploy that Battery!",
    "1813 flavour: 'Marie-Louises' — mostly conscripts (Recruit/Enthusiastic Recruit); cavalry arm weak after 1812 (Small cuirassier regiments; Small units cannot be Elite).",
    "First Volley (1813 option): +1 CD on a unit's first close-order volley of an engagement."
  ],
  Prussia: [
    "Command: British/Late-Prussian column (near-French). Brigadiers attach freely (post-1808).",
    "Brigades ARE divisions: permitted brigadiers (= ADC count) = total non-skirmish units ÷ 4, rounded up.",
    "Skirmish: light bns (Vet/Line) operate independently; line bns pay the −1 base penalty.",
    "Artillery: may NOT Redeploy that Battery!",
    "Landwehr: Enthusiastic Recruits or Reservists by grading."
  ],
  Russia: [
    "Command: Austrian/Russian/Other column (needs 12 for Incomparable). Brigadiers need an ADC Brigade Attachment in place to attach.",
    "Skirmish: non-light battalions LOSE a base when reinforcing the skirmish screen; Jägers do not.",
    "Artillery: may NOT Redeploy that Battery!; LARGE 12-gun position batteries: +1 CD canister, ignore first FC, −2 fire only at 8+ cas, disperse at 10+ — natural Grand Battery material.",
    "Troops: stubborn line; Opolchenie = Enthusiastic Recruits; Pavlov grenadiers may carry battalion guns (+1 CD line & column fire while fresh; lost at 4+ cas or on square/garrison/skirmish/rough/retire; no Forwards).",
    "Cossacks: raid pre-battle (campaign), evade freely, cannot frontally charge formed close-order infantry, artillery or heavy cavalry."
  ]
};

const TERRAIN = {
  "BUA / village": [
    "Garrison = ONE battalion per BUA section; Unformed while inside; fire at it is HALVED (columns firing at it halve again).",
    "Units must be in COLUMN to pass through a BUA (skirmishers exempt, pass at full 12\").",
    "Exit: a garrison needs a FULL Movement phase to leave, emerging as a formed column on any facing — no other move that turn, cannot also form square.",
    "Garrisons cannot charge out (except into an adjoining BUA/strongpoint), never give support re-rolls."
  ],
  "Hills & crests": [
    "Gentle plateaued rises: Good going to move over.",
    "Dead ground: troops behind and within 9\" of a crest cannot be targeted by direct fire.",
    "Crest plateaus: prime artillery and overwatch positions commanding the approaches."
  ],
  "Woods": [
    "Rough terrain; cavalry may NOT charge into woods/severe terrain.",
    "Block line of sight; break up formed bodies — skirmishers' home ground."
  ],
  "Streams & fords": [
    "Rough terrain; close-order infantry cross at half speed; cavalry/artillery cross at fords; skirmishers cross anywhere at half speed.",
    "1813 bridges/fords (where in force): cross in Column (artillery Limbered); infantry ON a bridge/ford counts as IN SQUARE if charged by cavalry."
  ],
  "Movement key figures": [
    "Skirmishers 12\" (incl. through BUAs); artillery manhandle/step-back 3\"; Retire distance 20\" — failing to reach friendly support within it = Rout.",
    "Forwards tasking: +3D6\" to a move, or +1D6\" to a charge (one roll for the brigade).",
    "Charge On: infantry +3D6\", cavalry +5D6\".",
    "Out-of-command unit choosing to Retire = voluntary retire — costs 1 fatigue casualty.",
    "Full movement-rate table: see the verified Movement card below."
  ]
};
const TERRAIN_VERIFY = {};   // all terrain content now verified (§10.1)

/* ---------- §9A ADC taskings (VERIFIED against rulebook QRS — complete) ---------- */
const TASKINGS = [
  { n: "Divisional Morale", cost: "1 per Faltering brigade", does: "MANDATORY: each Faltering brigade requires 1 ADC posted at the start of the Command phase.", limits: "No ADC posted = that brigade takes Sauve qui Peut! (lowest-graded brigade first if short)." },
  { n: "Scouts", cost: 1, does: "Reveal a Fog of War card.", limits: "Maximum 1 Scouts posting per turn." },
  { n: "Brigade Attachment", cost: 1, does: "Re-roll a Brigade Command Roll. Austrian/Russian/Other: may redeploy foot artillery if the brigade Obeys Orders; optionally required for their brigadier to attach.", limits: "Maximum 1 per brigade." },
  { n: "Glory!", cost: 1, does: "Attached brigadier leads the Charge: +1 CD in Melee; infantry recover 1 casualty on a 4–6.", limits: "Brigadier must be attached; Risk to General applies on retire/retreat results." },
  { n: "Skirmishers!", cost: 1, does: "Skirmishers add +1 CD to fire; brigade units may Reinforce the Skirmish Line.", limits: "Russian non-light battalions LOSE a base when reinforcing the screen." },
  { n: "Forwards!", cost: 2, does: "+3D6\" to the brigade's normal Movement OR +1D6\" to its Charge — ONE roll, all units use the same dice; cannot mix the two.", limits: "Brigade may not fire that turn (exception: deployed guns that did not move). Squares and Recruits in Line may not use Forwards rates; deployed artillery may not manhandle at Forwards rates; units with battalion guns (1813) may not use it." },
  { n: "Infantry Assault!", cost: 2, does: "Infantry may declare multiple/supported charges; advance to volley range.", limits: "" },
  { n: "Artillery Assault Fire!", cost: 2, does: "+2 CD to battery fire; ignores counter-battery priority; FC result then costs 2 casualties.", limits: "NOT available if the battery has 4+ casualties, is Low on Ammunition, Recruit, or Unformed. Grand Battery caisson (1813): BOTH batteries fire under the one tasking." },
  { n: "Reserve", cost: "1 (2 if off-table)", does: "Commit the Reserve into the battle line if the brigade Obeys Orders; +1 ADC adds an Assault or Forwards order to it.", limits: "Off-table reserve (1813): its release is the 2-ADC version; one of the C-in-C's ADCs rolls on 5+ while it stays hidden." },
  { n: "Ammunition!", cost: 2, does: "Replenish the brigade's artillery ammunition if the brigade Obeys Orders.", limits: "" },
  { n: "Redeploy", cost: 2, does: "Order a brigade to take up a new position in the battle line or into Reserve.", limits: "If the order fails it may be re-issued in a following turn at the 2-ADC cost (FAQ). National artillery-redeployment limits apply (Prussian/Russian guns: no Redeploy that Battery; A/R/O foot guns redeploy via Brigade Attachment instead)." },
  { n: "Command!", cost: 3, does: "Command re-roll; units recover 2 casualties; win Charge Initiative; Glory +1 CD in melee.", limits: "" }
];
const TASKING_NOTES = [
  "Élan is NOT a tasking — it is a CHARGE RESULT (e.g. infantry winning by 3–5) granting +1 CD in the melee (+2 CD if infantry in Attack Column).",
  "Rallying is NOT a tasking — Retreating/Routed units rally when their brigade Obeys Orders (Steady, 3–6 on the Command die), emerging UNFORMED until a full Movement phase reforms them. Faltering brigades rally via the Divisional Morale posting + Falter table.",
  "ADC availability: 1D6 per ADC, available on 3–6. Off-table Reserve & Reinforcement brigade ADCs: available on 5–6.",
  "Initiative: 2D6 minus the number of Hesitant + Faltering brigades; highest wins; draw = last turn's holder. Optional: French may spend ADCs for +1/+2."
];

const DISPERSAL = [
  "Standard battalion/regiment: see the verified casualty-levels table below (§10.5).",
  "Standard battery: −2 fire at 6+ casualties, disperses at 8+.",
  "Large (12-gun) battery: −2 fire at 8+, disperses at 10+ (and ignores its first FC).",
  "Battery that Retreats, Routs or Disperses COUNTS toward brigade Falter triggers like any other unit (FAQ).",
  "Pyrrhic Victory: a melee winner reaching its own dispersal point flips the result (see Melee resolver)."
];

const CHARGE_WALKER = [
  { t: "Declare all charges", r: "Targets cannot counter-declare. Faltering brigades cannot declare. Charges declared before a falter continue at −1.", err: "Letting a charge target declare its own charge — it can't." },
  { t: "Move ALL chargers to the 3\" point", r: "Charges are SIMULTANEOUS: every phasing charger moves to the 3\" point BEFORE any defensive fire or reactions (FAQ).", err: "Resolving one charge fully before moving the next charger." },
  { t: "Defender reactions", r: "Form square: Discipline Test — FAIL on 4–6 = stays in its ORIGINAL formation AND becomes Unformed. Opportunity Charge by defending cavalry supports: Discipline Test; pass = the original charge is cancelled, the supports become the chargers, and NO supports are allowed on the opportunity charge.", err: "Failed square test ≠ a half-formed square — it's original formation, Unformed." },
  { t: "Defensive fire", r: "Screened target: the WHOLE skirmish screen evades — it fires first only vs infantry. ALL casualties (screen + close-order) count in the charge procedure.", err: "Forgetting screen casualties count toward charge-casualty modifiers." },
  { t: "Resolve the charge test", r: "One 2D6 per side, net modifiers, supports give re-rolls. Use the Charge tab.", err: "Rolling once per charging unit — it's ONE roll per side; extra units are supports." },
  { t: "Outcomes & melee", r: "Flank supports fight round 1 only if they physically reached base-to-base. Rear support reinforces from round 2 within distance. Multi-unit melee = ONE combined roll per side; winner = most total casualties. Pyrrhic Victory: a winner reaching its OWN dispersal point flips the result — the loser wins, ignores retreat/rout, takes ground Unformed.", err: "Missing the Pyrrhic flip — the most-missed rule in the game." }
];

const FALTER_WALKER = [
  { t: "Check the trigger", r: FALTER_TRIGGER + " Artillery counts toward falter triggers (a battery that Retreats, Routs or Disperses counts like any other unit).", err: "Ignoring batteries when counting the brigade's losses." },
  { t: "Roll ONCE on the Faltering Brigade table", r: "There is NO separate command roll — one D6, read the row for the brigade's grade.", err: "Rolling a command test first — that's not in the procedure." },
  { t: "Apply the result by grade", r: "See the table and result definitions below. Obey: retreating/routing units rally immediately but are UNFORMED until a full Movement phase reforms them.", err: "Auto-dispersing a brigade that became Demoralised and faltered simultaneously — it must have been ALREADY Demoralised when the dispersals happened." }
];

const TACTICS_ATTACK = [
  ["Guns before bayonets.", "Garrisons halve all fire against them — and a column firing at a garrison quarters its effect. Musketry will never clear a held village; massed Assault Fire (+2 CD, Grand Battery caissons doubling it) is the only efficient crowbar. Strip the garrison, then assault."],
  ["Screen the approach.", "A skirmish screen blocks enemy close-order musketry at your advancing columns and must be dealt with by any charge. But remember the limit: artillery ignores screens — don't walk a screened column down a gun line."],
  ["Engineer the supports.", "Every formed support within 3\" at declaration is a re-roll on the charge test, and flank supports that physically reach base-to-base fight in melee round 1. Line up charges so the flanks reach — a lead unit with two arriving flankers is three units fighting on one winning differential."],
  ["Élan is a brigade buff.", "Melee with Élan applies to the lead unit AND all supports. Spend it on the assault brigade the turn it goes in, not on a probing attack."],
  ["Forwards crosses the killing ground.", "+3D6\" movement, rolled once for the whole brigade — but no firing that turn, and Recruits-in-line, squares and deployed guns can't use it. Time it for the turn you'd be marching under fire without effective reply anyway. Units with battalion guns cannot use it at all."],
  ["Flank or fix — never just front.", "A defender charged in flank/rear is −2/−4, loses any column bonus, and charge targets cannot counter-declare. Pin with one brigade's threat, swing the second onto the flank."],
  ["Cavalry wins by existing.", "Formed cavalry within charge reach forces infantry into square or column — and squares are −2 against your infantry's charge and a feast for your guns. The threat is worth more than the charge; deliver the charge only when they've failed the square test (fail = original formation AND Unformed)."],
  ["Attack in echelon.", "A faltering brigade cannot declare charges — if your only assault brigade falters at the wrong moment the whole attack dies in place. Two waves keep the pressure on while the first rallies."],
  ["Break brigades, not armies.", "Falter tests are per-brigade and dispersals cascade through them. Concentrating dispersals on one brigade until it fails is worth more than spreading the same casualties thinly across three."],
  ["Columns move, lines shoot.", "Column fire is halved — a column that stops to firefight is doing half-damage while taking full. If the plan is a firefight, deploy into line; if it's contact, keep moving."],
  ["Mind the approach casualties.", "Charge casualties of 2 / 3–4 / 5+ cost −1/−2/−3 on the charge test (Elites shrug the first band). Defensive fire can break the charge before contact — which is one more reason for tip 1."],
  ["Carry the brigadier.", "General attached = the unit tests one grade up. Put him with the lead assault unit on the decisive charge — and accept the risk that comes with it."]
];

const TACTICS_DEFEND = [
  ["Own the dead ground.", "Troops behind and within 9\" of a crest cannot be seen by direct fire. Hold the firing line BEHIND the crest, step up to volley, step back from bombardment — the attacker has to come to the crest blind."],
  ["A battalion in a building is a brigade's work.", "Fire at a garrison is halved (quartered from columns). One battalion in a BUA, accepted as Unformed, can absorb an afternoon of attention. Plan its exit a full turn early: leaving costs the whole Movement phase and it emerges as a column — cavalry bait if you've left it too late."],
  ["Weave the support web.", "Keep every front-line unit within 3\" flank support of a neighbour: re-rolls on every defensive charge test, and round-2 melee reinforcement (cavalry from up to 10\") for any fight that goes long. An isolated unit is a dead unit."],
  ["Guns forward, with lanes.", "Artillery dominates from slightly ahead of the infantry line — and a deployed battery can step back 3\" (manhandle) when threatened. Leave deliberate gaps in the gun line: friends retiring THROUGH a battery make it Unformed, friends retiring through the gaps cost nothing."],
  ["Plan the withdrawal lanes.", "An Unformed unit Retiring through a friendly COLUMN does not disorder it — a controlled withdrawal can pass straight through your second line. But a ROUTING unit does disorder what it passes through, and a retiring unit that can't reach friendly support within its 20\" becomes a rout. Keep formed columns 12–18\" behind the line, never directly behind a unit likely to break."],
  ["The Opportunity Charge is your counter-punch.", "Defending cavalry supports can convert an enemy charge into their own: Discipline Test, pass = the enemy charge is cancelled and your supports become the chargers (no supports allowed on it). Position cavalry AS supports behind the line, not as front-line targets — they're more dangerous as a coiled spring."],
  ["Don't get pinned for free.", "Charge targets cannot declare their own charges. A cheap enemy charge declaration can freeze your best unit at the moment you needed it elsewhere — keep counter-attack reserves out of easy charge reach until you commit them."],
  ["Refuse the flank with the brigadier.", "Infantry cannot charge when flanked unless the brigadier is attached. On a refused flank, the brigadier's presence is the difference between a static crust and one that can hit back."],
  ["No reserve, no recovery.", "Rallied units are Unformed until a full Movement phase reforms them — they need somewhere safe to do it. A second line 12\"+ back is what turns a falter from a collapse into a hiccup."],
  ["Spend the First Volley on the assault.", "The +1 CD chit comes once per engagement. Hold it for the volley that meets the charge at 3\", not a long-range exchange."],
  ["Channel them into column.", "Fords, woods, walls and BUAs force the attacker into columns — whose fire is halved while your line fires full. Anchor flanks on terrain that makes every approach a column approach."],
  ["Shoot the infantry, not the guns.", "Counter-battery duels rarely decide anything. Your batteries' best work is putting charge-casualty modifiers (−1/−2/−3) on the assault brigades before contact — break the charge in the approach, not the gun line behind it."]
];

/* ---------- plain-language result glossary (VERIFIED, rulebook pp49–50) ----------
   Every charge/melee result token expanded into "what it means + what
   to do now", so a conclusion is reached without opening the book.
   cas: casualties the result costs the LOSING unit (null = none).      */
const RESULT_GLOSSARY = {
  "Victory!":        { who: "winner", cas: null, text: "Decisive win. You MUST now choose: Charge On (infantry +3D6\", cavalry +5D6\") into a fresh target, or Take the Ground." },
  "Charge On":       { who: "winner", cas: null, text: "Continue the charge — roll the bonus move (inf +3D6\", cav +5D6\") and charge another target in reach, or Take the Ground." },
  "Take Ground":     { who: "winner", cas: null, text: "Move up and occupy any part of the position the beaten enemy held. Keep your current facing — no wheel or manoeuvre." },
  "Élan":            { who: "winner", cas: null, text: "Close to Melee with the Élan bonus: +1 Casualty Die (+2 if infantry in Attack Column) for the lead unit AND all supports." },
  "Melee Unformed":  { who: "either",  cas: null, text: "Close to Melee, but this side fights Unformed (−1 CD) — it lost formation before contact. Supports not in the melee stay Formed." },
  "Melee":           { who: "either",  cas: null, text: "Close to Melee. Units that can't reach base-to-base hold position. Resolve it on the melee resolver." },
  "Counter-charge":  { who: "loser",   cas: null, text: "The defender closes to melee (cavalry counter-charge). A formed, in-command British line may instead counter-charge an Unformed attacker (no supports allowed)." },
  "Stand":           { who: "loser",   cas: null, text: "The unit holds its position — no other effect." },
  "Volley!":         { who: "either",  cas: null, text: "Chargers halt at 3\" and fire a volley: Large Line 4CD · Standard 3CD · Small 2CD · column 1CD (ignore all normal fire modifiers). Draw = lead stays Formed; lost by −1/−2 = lead Unformed. Supports still fire and stay Formed." },
  "Retire":          { who: "loser",   cas: 1,    text: "Fall back the full Retire move (or behind a support) — now automatically Unformed. Lose 1 casualty. Supports Retire. (Massed-column attacker: this becomes a Retreat instead.)" },
  "Retreat":         { who: "loser",   cas: "1D3", text: "Full Retreat move to the rear or behind a support. Lose 1D3 casualties. Supports Retire. Retreating artillery Disperses." },
  "Rout":            { who: "loser",   cas: "1D6", text: "Immediately Rout — full Rout move. Lose 1D6 casualties. If you can't end within 3\" of a friendly formed unit you Disperse. Supports Retire. Brigade gets a Falter marker; routed artillery is removed." },
  "Ridden Down":     { who: "loser",   cas: "disperse", text: "Dispersed and removed from play. Supports Retire. Brigade gets a Falter marker. The winning lead cavalry takes 1 casualty." }
};
/* 1D3 casualty mapping (rulebook p50): 1–2 → 1, 3–4 → 2, 5–6 → 3 */
function oneD3(roll) { return roll <= 2 ? 1 : roll <= 4 ? 2 : 3; }

/* melee MOVEMENT outcomes (no extra casualty roll — the CD hits already
   were the casualties). Plain meanings for the result strings. */
const MELEE_MOVE_GLOSSARY = [
  // [display label, [lowercase match fragments], meaning]
  ["Takes Ground",        ["takes ground", "take the ground"], "Winner moves up and occupies the enemy's position, keeping its facing."],
  ["Rout",                ["rout"],                 "Loser routs to the rear; if it can't end within 3\" of a friendly formed unit it Disperses. Its brigade gets a Falter marker."],
  ["Retreat",             ["retreat"],              "Loser falls back a full Retreat move; its supports Retire; retreating artillery Disperses."],
  ["Return to Own Lines", ["return to own lines"],  "Beaten cavalry pulls back to its own lines and reforms — it is NOT routed and takes no falter."],
  ["Disperse",            ["disperse"],             "Unit is destroyed and removed from play; its brigade gets a Falter marker."],
  ["Stand",               ["stand"],                "The unit holds — the attack failed to break it."],
  ["Unformed",            ["unformed"],             "The unit taking the ground is now Unformed until a full Movement phase reforms it."]
];

/* ---------- Destiny (VERIFIED, rulebook pp93–94) ----------
   Replaces every "double 6 — ask the umpire" with the real result. */
const DESTINY_TABLE = [
  { lo: 2,  hi: 2,  title: "DISHONOUR!",              text: "The opposing brigadier is thrown from his horse and flees on foot — the OPPOSING brigade Falters. (Risk to General: instead YOUR general surrenders and YOUR brigade Falters.)" },
  { lo: 3,  hi: 6,  title: "STEADY THE BUFFS!",       text: "Recover one casualty, OR Melee with Élan." },
  { lo: 7,  hi: 8,  title: "DISCIPLINE!",             text: "Recover one casualty, OR reform / change formation / wheel (NOT in the Charge phase), OR Melee with Élan." },
  { lo: 9,  hi: 9,  title: "DREADFUL LOOKING FELLOWS!", text: "Recover TWO casualties, OR reform / change formation / wheel (NOT in the Charge phase), OR Melee with Élan." },
  { lo: 10, hi: 12, title: "UNSIGHTLY DEMISE!",       text: "A howitzer shell ends the opposing brigadier — the OPPOSING brigade Falters. (Risk to General: instead YOUR general is killed and YOUR brigade Falters.)" }
];
const DESTINY_NOTES = [
  "Destiny triggers on any UNMODIFIED double 6 in a Charge, an Infantry Volley, or Artillery Fire. Roll 2D6 and read the table — the benefit always goes to the unit that rolled the double 6.",
  "A double 6 in a Discipline Test simply recovers one casualty — there is no Destiny roll.",
  "Risk to General: an attached general who LOST a charge or melee with a Retire/Retreat result rolls here — only a 2 or a 10–12 affects him."
];
function destinyResult(score) {
  return DESTINY_TABLE.find(r => score >= r.lo && score <= r.hi) || DESTINY_TABLE[0];
}

/* §10.7 — the only items still open with the umpire */
const VERIFY_LIST = [
  "Charge Results table & charge modifiers (§3.2–3.3) were transcribed from the umpire's verified cheat sheet — embedded as given; any internal inconsistency found during play should be flagged to the umpire, not 'fixed' in the app.",
  "Per-nation command tables (C-in-C grade ranges) — only needed if a future feature uses them; not required for v1."
];
