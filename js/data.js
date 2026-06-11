/* ============================================================
   GdA Companion — embedded rules data.
   Content checked by Andy against rulebook + official FAQ.
   Items flagged VERIFY are §10 — show ⚠ unverified badge.
   DO NOT edit values without umpire sign-off.
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

const FIRE_RULES = {
  halving: "HALVE casualties (round down) if: (1) the FIRER is in Column or Square, or (2) the TARGET is a BUA/Strongpoint garrison. Both apply together: a column firing at a garrison halves twice (quarter effect).",
  skirmishScreens: "Skirmisher screens block line of sight for close-order musketry, but ARTILLERY ignores skirmisher screens for targeting — they give no protection to close-order troops behind them.",
  measurement: "Measure from the centre of the firer's front edge to the nearest point of the target. Players may pre-measure before declaring fire.",
  doubleSix: "Double 6 on CASUALTY dice does NOT trigger Destiny — only initial 2D6 rolls do.",
  assaultFire: "Artillery Assault Fire tasking: +2 CD; battery ignores counter-battery priority; an FC result then costs 2 casualties.",
  largeBattery: "Large (12-gun) battery: +1 CD firing canister; ignores its FIRST Fatigue Casualty result; −2 fire penalty only from 8+ casualties; disperses at 10+ (standard battery: 6+/8+).",
  grandBattery: "Grand Battery (1813, max 2 batteries, 2 caissons): spend a caisson → BOTH batteries Assault Fire under ONE tasking. Caissons spent → one battery per turn may Assault Fire."
};

/* §10 VERIFY: base CD by firer size/range is NOT in the spec — until
   Andy signs off the firing tables, the Fire tab takes base CD as an
   input wheel and applies the verified halving chain + modifiers. */
const FIRE_MODS = [
  { id: "unformed",   label: "Firer unformed",            cd: -1 },
  { id: "firstVolley",label: "First Volley",              cd: +1 },
  { id: "bnGun",      label: "Battalion gun",             cd: +1 },
  { id: "lbCanister", label: "Large battery, canister",   cd: +1 },
  { id: "assault",    label: "Assault Fire tasking",      cd: +2 }
];

const FALTER_TABLE = { // dice: 6–5 / 4 / 3 / 2 / 1
  Elite:       ["Obey", "Obey", "Obey", "Retire", "Retire"],
  VeteranLine: ["Obey", "Rally", "Retire", "Retire", "Sauve!"],
  Recruit:     ["Obey", "Rally", "Retire", "Sauve!", "Sauve!"]
};
const FALTER_DICE_LABELS = ["6–5", "4", "3", "2", "1"];
const FALTER_NOTES = [
  "Obey: retreating/routing units rally immediately but are UNFORMED — they stay Unformed until a full Movement phase reforms them.",
  "A brigade auto-disperses on faltering only if it was ALREADY Demoralised when the dispersals happened; becoming Demoralised and faltering simultaneously does NOT auto-disperse.",
  "Units within 9\" of formed friends when retiring matter — an Unformed unit that cannot reach friendly support within its 20\" Retire becomes ROUTED."
];

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
    "Full movement-rate table: SEE VERIFY LIST — populate from the rulebook before release."
  ]
};
const TERRAIN_VERIFY = { "Movement key figures": true };

const TASKINGS = [
  { n: "Forwards!", cost: 2, does: "+3D6\" to the brigade's move OR +1D6\" to its charge — ONE roll, all units use it.", limits: "Brigade cannot fire that turn (stationary deployed guns that didn't move may). Not usable by: Recruits in Line, Squares, Deployed Artillery, units with battalion guns. Current formation only — no formation change mid-move." },
  { n: "Artillery Assault Fire", cost: 2, does: "+2 CD; ignores counter-battery priority.", limits: "An FC result then costs 2 casualties. Grand Battery caisson: BOTH batteries fire under the one tasking." },
  { n: "Melee with Élan", cost: 2, does: "Élan bonus applies to the lead unit AND all supports in the melee.", limits: "Declare with the charge." },
  { n: "Rally that Brigade!", cost: 2, does: "Removes Faltering; retreating/routing units rally (UNFORMED until a full Movement phase reforms).", limits: "If the order fails it may be re-issued next turn at the 2-ADC cost (FAQ)." },
  { n: "Redeploy that Battery!", cost: 1, does: "Limber and redeploy a battery.", limits: "NOT available to French pure-artillery brigades, Prussian or Russian artillery." },
  { n: "Commit Reserve (1813)", cost: 2, does: "Releases the off-table reserve brigade; enters within its rear zone.", limits: "All ADCs revert to 3+ availability from the following Command Phase." },
  { n: "ADC Brigade Attachment", cost: 1, does: "Required for Austrian/Russian/Other brigadiers to attach to a unit.", limits: "Must be in place before the brigadier attaches." }
];

const DISPERSAL = [
  "Standard battalion/regiment: disperses per its size's dispersal point (populate exact size table per VERIFY list).",
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
  { t: "Check the trigger", r: "Artillery counts toward falter triggers (a battery that Retreats, Routs or Disperses counts like any other unit).", err: "Ignoring batteries when counting the brigade's losses." },
  { t: "Roll ONCE on the Faltering Brigade table", r: "There is NO separate command roll — one D6, read the row for the brigade's grade.", err: "Rolling a command test first — that's not in the procedure." },
  { t: "Apply the result by grade", r: "See the table below. Obey: retreating/routing units rally immediately but are UNFORMED until a full Movement phase reforms them.", err: "Auto-dispersing a brigade that became Demoralised and faltered simultaneously — it must have been ALREADY Demoralised when the dispersals happened." }
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

/* §10 — unverified items list (drives ⚠ badges) */
const VERIFY_LIST = [
  "Full movement-rate table (line/column/square/cavalry/artillery limbered, road bonus) — rulebook pp.59ff.",
  "Artillery range bands & base CD by range for the Fire tab.",
  "Faltering table exact cells — confirm Retire vs Retreat wording, rulebook p.88ff.",
  "Musketry base CD by unit size and range.",
  "Full ADC tasking list and costs — confirm none missing; check Élan/Forwards costs.",
  "Unit-size dispersal points table (Large/Standard/Small battalions & cavalry).",
  "Melee CD values and melee modifiers table — rulebook pp.88ff."
];
