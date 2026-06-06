# crapser — Sprint Log & Architecture

> **Last updated**: 2026-06-06  
> **Live at**: https://crapser.pages.dev  
> **Repo**: github.com/Narqulie/crapser

---

## Sprint Summary

```
Sprint 1 (P1):     HUD overhaul — triple-bar money, result cards, drama beats
Sprint 2 (P2+P4):  Dice hand system + synergy/combo system
Sprint 3 (P3):     NPC shop system — 6 shopkeepers, trust tiers, dual-use economy
Sprint 4 (Map):    Player-chosen node navigation replaces linear table progression
Sprint 5 (Vows):   4 difficulty modifiers + balance overhaul
Sprint 6 (Polish): JSDoc, deduplication, vestigial code removal
Sprint 7 (Balance): Bug fixes + balance tuning — 9 tasks, 8 files
Sprint A-E (Refactor): Money compression (₡), pick-per-table, 12 wild dice, non-cube visuals
```

**Total**: 11 sprints, ~3,500 insertions, ~1,300 deletions, 13+ files changed.  
Final state: **17 modules, ~10,500 lines**.

---

## File Inventory (17 modules)

| # | File | Lines | Role | 
|---|------|:-----:|------|
| 1 | `rogue-run.js` | 1,525 | RogueRun state machine: 6 states, resolve pipeline (dice→charms→bets→talents→synergies→anti-synergies→legendary), map nav, vows, table traits |
| 2 | `dice.js` | 1,130 | 12 type-specific die geometries, canvas textures, animation registry, `getTopFace()` |
| 3 | `rogue-ui.js` | 975 | 6 overlays: pick-3, table-start-lock, shop, map, bust/won, perk. Reuses dice-pick DOM |
| 4 | `shop.js` | 835 | ShopSystem: 27 items, 5 trust tiers (Stranger→Family), weighted NPC selection, buy/sell |
| 5 | `main.js` | 732 | Scene (Three.js), physics (Cannon-es), input (aim/drag/space), game loop, drama timing |
| 6 | `upgrades.js` | 535 | 31 upgrades (4 categories), TABLE_TRAITS (5), SYNERGIES (8), ANTI_SYNERGIES (3), LEGENDARY |
| 7 | `pot.js` | 387 | Cosmetic physics money pile (bills + coins, ₡ denominations) |
| 8 | `dice-types.js` | 381 | 12 DICE_TYPES + DiceHand class (4 slots, lockedSlots, durability, autoPickLocked) |
| 9 | `ui.js` | 327 | Main HUD: triple-bar money (₡), result card animation, table progress, synergy badges |
| 10 | `map.js` | 292 | MAP_ACTS (3 acts × 3 floors × 27 nodes), NODE_TYPES, helpers |
| 11 | `meta-progress.js` | 262 | XP/levels (10 thresholds), 8 perks, 4 VOW_DEFS, NPC trust persistence, localStorage |
| 12 | `audio.js` | 175 | Procedural Web Audio: roll noise, bounce, settle clicks, win/lose melodies |
| 13 | `physics.js` | 166 | Cannon-es world: wall/ground, die bodies, settle detection (V_THRESHOLD=0.08) |
| 14 | `game.js` | 164 | Pure craps state machine (COME_OUT→POINT), resolve(), deadThrow(), setBet() |
| 15 | `announcer.js` | 134 | 24 dice-combo aliases + context calls per result |
| 16 | `npcs.js` | 16 | NPC_DEFS: 6 shopkeeper definitions (id, name, color, greeting) |
| 17 | `style.css` | 2,318 | Complete CSS: money bar, result cards, 6 overlays, responsive |
| — | `index.html` | 165 | DOM: overlays, money bar, progress, HUD elements |
| | **TOTAL** | **~10,500** | |

---

## Architecture Decisions

### State Machine (rogue-run.js)
```
MAP_NAV → TABLE_START_LOCK → BETTING → ROLLING → RESOLVE → PICKING/MAP_NAV/BUST/RUN_WON
```

6 states. `resolve()` is the central hook pipeline: auto-pick locked dice → dice type effects (safe→calc-risk→gambling→build-around) → charm hooks → bet mod hooks → talent hooks → synergy resolution → anti-synergy detection → legendary check → _postResolve (state transitions).

### Currency: ₡ (colón)
All money ÷5 from original design. Single economy — spending money at shops reduces your bust buffer. Trust discounts (0-30%) reward loyalty to specific NPCs.

### Dice Hand vs Active Upgrades
Two parallel systems:
- **DiceHand** (dice-types.js): 4-slot physical dice inventory, 2 locked per table (auto-picked each roll), durability per slot, cracked state, per-type Three.js geometry
- **activeUpgrades** (rogue-run.js): Map of upgrade objects, charges (-1 = permanent, >0 = consumable), applied during resolve hooks

### Pick-per-Table
Dice are locked at the start of each table via TABLE_START_LOCK state. Locked dice are auto-picked every roll (no per-roll dice pick overlay). Upgrades are awarded only on table/boss clear: 1 pick for table, 2 for boss.

---

## Dice System (12 types, 4 categories)

| Category | Types | Durability | Design intent |
|----------|-------|:----------:|---------------|
| **Safe** | House Bones, Witness | 15, 10 | Reliable, prediction |
| **Calculated Risk** | Glass, Volatile, Cursed 13, Loaded Set | 3, 6, 10, 12 | Math-driven risk/reward |
| **Gambling** | Snake Eyes, Doom d20 | 6, 8 | Push-your-luck |
| **Build-Around** | Debt, Vengeance, Pyre, Split | 8, 8, 6, 10 | Scale with run state |

**Visual designs**: Cube (House Bones, Loaded Set), sphere/eye (Witness), transparent icosahedron (Glass), glowing icosahedron (Volatile), obsidian octahedron (Cursed 13), tetrahedron (Snake Eyes), skull icosahedron (Doom), coin stack (Debt), scratched knucklebone (Vengeance), ember icosahedron (Pyre), linked cubes (Split).

---

## Upgrade Frequency
- Picks trigger on: table clear (1 pick) or boss clear (2 picks)
- Purist vow: +1/table. Iron Man: +2 at start. Mystery node: 25% free
- 31 total upgrades in pool → ~12-18 picks per run → sees 40-60% of pool
- No per-hand picking — upgrades are a scarce resource

---

## Balance Model

### Difficulty Curve
```
Act 1 (Alleys, ₡30-70):    Few upgrades, no synergies, low money  → HARD
Act 2 (Underground, ₡60-100):  4-6 upgrades, possible synergy    → MEDIUM
Act 3 (The House, ₡100-200):   8-12 upgrades, synergies active   → HARD (boss traits)
```

### Shop Economy
- 27 items across 6 NPCs
- 5 trust tiers: Stranger(0%)→Regular(5%)→Friend(10%)→Partner(20%)→Family(30%)
- Trust thresholds: ₡20/100/300/1000 spent per NPC
- Cost: `floor(nodeTarget × costPct × (1 − trustDiscount))`

### Vows (Optional Difficulty)
1. **Iron Man**: No shops. +2 starting upgrades.
2. **Glass Jaw**: House Bones dice start cracked. +50% starting money.
3. **Speed Run**: 7 hands/table max. Double XP.
4. **Purist**: No dice type effects. +1 upgrade/table clear.

---

## Sprint 7: Polish & Balance (COMPLETED)

### Bug Fixes
- [x] **MAP_NAV timing fix**: Map overlay gated behind result card completion
- [x] **Vow → Map flow**: Fixed double-reset causing skipped map
- [x] **Dead code removal**: `#table-clear` DOM + CSS, `TABLE_CONFIGS`, stale button listeners
- [x] **Hustler tracking**: Changed from per-slot → per-die-ID counter

### Balance Tuning
- [x] **Shop frequency**: Removed random shops. Only map shop nodes.
- [x] **Rest node**: +1 durability to 2 random dice (was +2 to all).
- [x] **Mystery node**: Scaled by act — Act 1 ±₡4, Act 2 ±₡8, Act 3 ±₡12.
- [x] **Speed Run vow**: 7 hands/table limit (was 5).
- [x] **Loaded Set shop**: Handled partial slot case.

---

## Sprint A-E: Refactor (COMPLETED)

### Sprint A: Money Compression (÷5, ₡ currency)
- 10 files, ~150 edits — all $→₡, values ÷5
- game.js: money 100→20, bet 10→2, minBet 5→1
- main.js: BET_CHIPS [5,10,25,50,100]→[1,2,5,10,20]
- map.js: 14 node targets ÷5
- pot.js: BILL_DENOMS [100,50,20,10,5]→[20,10,5,2,1]

### Sprint B: Pick-per-Table
- dice-types.js: lockedSlots Set, autoPickLocked(), lockSlot/unlockSlot
- rogue-ui.js: showTableStartLock() reusing dice-pick DOM
- rogue-run.js: TABLE_START_LOCK state, removed DICE_PICK

### Sprint E: Remove Per-Hand PICKING
- PICKING only on table/boss clear (not every win/point)
- _pendingTableClearPicks queue

### Sprint C: 12 Wild Dice
- dice-types.js: Replaced 6 old types with 12 across 4 categories
- rogue-run.js: New resolve hooks for all 12 types
- shop.js + upgrades.js: Updated dice entries, removed dead anti-synergy

### Sprint D: Visual Dice Geometry
- dice.js: Full rewrite — 12 type-specific geometry builders, canvas textures, animation registry
- main.js: Integrated animation registry, setupDieAnimations, updateAllDiceAnimations in game loop

---

## Deployment

- **Platform**: Cloudflare Pages
- **CI/CD**: `.github/workflows/deploy.yml` — auto-deploys `master` branch via `cloudflare/wrangler-action@v3`
- **Account ID**: `47aba4286a4f0a7f1117839b0326c2cf`
- **Live URL**: https://crapser.pages.dev

## Commands

```bash
npm run dev           # Dev server (hot reload)
npm run build         # Verify build (36 modules, ~725KB)
npx wrangler pages deploy dist --project-name=crapser --branch=main  # Manual deploy
```
