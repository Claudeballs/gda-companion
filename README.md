# GdA Companion

**Live app: https://claudeballs.github.io/gda-companion/** — open it on a phone and Add to Home Screen. Works offline after the first visit.
**Install card (print for the club): https://claudeballs.github.io/gda-companion/install-card.html**

Table companion for **Général d'Armée (1st Edition)** at 28mm — phone-first,
offline-first, zero typing in the core flows. Built to be faster than the
rulebook for everything it covers.

## Run it

- **From a file:** open `index.html` in any browser (everything is local —
  no network calls at runtime).
- **On the club LAN:** `py -m http.server 8731` in this folder, then visit
  `http://<your-ip>:8731` from any phone on the Wi-Fi.
- **GitHub Pages:** push and enable Pages — it's all static files.

State (tracker, calculator inputs, duel log, theme) persists in
`localStorage`. **Reset game** lives at the bottom of the Tracker tab.

## Status vs the build spec

| Step | Feature | Status |
|---|---|---|
| 1 | Shell, tabs, theme, storage, scenario-as-data loader | ✅ |
| 2 | Charge calculator | ✅ test 1, 2 pass |
| 3 | Melee round resolver (incl. Pyrrhic flip) | ✅ test 9 logic passes |
| 4 | Roll-Off Mode 1 (table mode) | ✅ tests 6, 7 pass |
| 5 | Tracker (driven by `scenarios/hochberg.js`) | ✅ tests 4, 5, 10 pass |
| 6 | Fire calculator | ✅ test 3 passes |
| 7 | Procedures + ADC taskings + dispersal card | ✅ |
| 8 | Terrain + Nations + Tactics | ✅ |
| 9 | Search | ✅ |
| 10 | Duel paired mode (WebRTC + QR signalling, commit-reveal fair dice) | ✅ loopback-tested; needs a real two-phone shakedown |
| 11 | Phase 2 (summary PNG, photo log, setup wizard) | ⏳ after §11 sign-off |
| 12 | PWA wrapper (manifest + service worker) | ✅ |

Note: the Charge tab owns the full single-phone charge flow (setup →
defensive fire → animated roll → supports → highlighted result). The
Duel tab is for TWO phones (or plain single-phone roll-offs like
initiative). Vendored QR libs: qrcode-generator (MIT), jsQR (Apache-2.0).

## ⚠ Before club use — umpire sign-off (§10)

Cards carrying the **⚠ unverified** badge use data Andy has not yet
confirmed against the rulebook (movement rates, artillery range bands &
base CD, musketry base CD, dispersal-point sizes, melee CD table, falter
wording, tasking completeness). The full list is on the **Steps** tab.
Everything else is checked against the rulebook + official FAQ.

The Fire tab takes **base CD as an input wheel** until the firing tables
are signed off — the halving chain and modifiers it applies are verified.

## Scenarios

`scenarios/hochberg.js` ships as the default. A new scenario = a new file
in `scenarios/` pushing one object onto `window.GDA_SCENARIOS` (same
shape), plus one `<script>` line in `index.html`. The tracker contains no
scenario-specific code.

## Copyright

All figure artwork and nation icons are original in-project SVG
silhouettes. To use period plates instead, bundle public-domain images
(e.g. Knötel, d. 1914) into `img/` after verifying the PD tag on each
file — never hotlink, never use modern illustrations.
