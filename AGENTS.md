# crapser — street craps Three.js game + roguelite

## Stack
- Vite 6, Three.js 0.171.0, Cannon-es 0.20.0
- ESLint 10 + Prettier — `npm run lint` / `npm run format`
- `npm run build` for validation
- Deployed to Cloudflare Pages: https://crapser.pages.dev

## Commands
- `npm run dev` — dev server (hot reload)
- `npm run build` — verify build (37 modules, ~725KB bundle)
- `npm run lint` — ESLint check (0 errors, 0 warnings)
- `npm run lint:fix` — ESLint auto-fix
- `npm run format` — Prettier format all files
- `npm run format:check` — Prettier check (CI)
- `npx wrangler pages deploy dist --project-name=crapser --branch=main` — manual deploy
- CI/CD: `.github/workflows/deploy.yml` auto-deploys `master` via `cloudflare/wrangler-action@v3` with `accountId: 47aba4286a4f0a7f1117839b0326c2cf`

## Architecture (18 modules, ~10,300 lines)

| Module | Lines | Role | Depends on |
|--------|:-----:|------|------------|
| `src/main.js` | 732 | Entry: scene, renderer, EffectComposer, game loop, input, settle detection | all others |
| `src/game.js` | 164 | Pure pass-line craps state machine (come-out→point), money/bet, `deadThrow()` | none |
| `src/dice.js` | 1060 | 12 type-specific die geometries (cube/sphere/icosahedron/tetrahedron/skull/coin-stack/linked-pair), canvas textures, animation registry, `getTopFace()` | three/addons |
| `src/dice-types.js` | 381 | 12 DICE_TYPES (4 categories: safe/calc-risk/gambling/build-around), DiceHand class (4 slots, lockedSlots, durability, autoPickLocked) | none |
| `src/physics.js` | 166 | Cannon-es world, die bodies, `hoverDie()`, `launchDie()`, wall body, `V_THRESHOLD=0.08` | cannon-es |
| `src/ui.js` | 327 | Main HUD: triple-bar money (₡), result card animation, table progress, synergy badges, bet chips | none |
| `src/rogue-run.js` | 1525 | **Core state machine** — 6 states, central `resolve()` pipeline (12 dice hooks→charms→bets→talents→synergies→anti-synergies→legendary), map nav, vows, table traits | `game.js`, `dice-types.js`, `upgrades.js` |
| `src/rogue-ui.js` | 975 | 6 overlays: pick-3, table-start-lock, shop, map nav, vow select, bust/won. Reuses dice-pick DOM | `upgrades.js` |
| `src/upgrades.js` | 535 | 31 upgrades (4 categories), TABLE_TRAITS (5), SYNERGIES (8 set bonuses), ANTI_SYNERGIES (3 pairs), LEGENDARY (5% instant win) | none |
| `src/shop.js` | 835 | ShopSystem: 27 items across 6 NPCs, 5 trust tiers (Stranger→Family), weighted NPC selection, buy/sell | none |
| `src/map.js` | 292 | MAP_ACTS (3 acts × 3 floors × 27 nodes), NODE_TYPES (table/boss/shop/mystery/rest), helper functions | none |
| `src/meta-progress.js` | 262 | XP/levels (10 thresholds), 8 perks with tree, 4 VOW_DEFS, NPC trust persistence, localStorage | none |
| `src/pot.js` | 387 | Cosmetic physics money pile — bills (₡20/10/5/2/1) + coins, Cannon-es bodies | three, cannon-es |
| `src/announcer.js` | 134 | 24 dice-combo aliases + context phrases per result type | none |
| `src/npcs.js` | 16 | NPC_DEFS: 6 shopkeeper definitions (id, name, color, greeting) | none |
| `src/utils.js` | 14 | Fisher-Yates `shuffle()` utility | none |
| `src/audio.js` | 175 | Procedural Web Audio API: roll noise, bounce, settle clicks, win/lose melody | none |
| `src/style.css` | 2318 | Dark theme, money bar, result cards, 6 overlays (map/shop/vows/dice-pick/pick-3/perk), responsive | none |

## Currency
**₡ (colón)** — all money is ÷5 from original design. Starting money: ₡20. Bet chips: ₡1/2/5/10/20. NPC trust thresholds: 20/100/300/1000. Pot bill denominations: ₡20/10/5/2/1.

## RogueRun state machine

6 states controlling input acceptance:
- **MAP_NAV** — player chooses next floor node (overlay shown)
- **TABLE_START_LOCK** — pick 2 dice to lock for entire table
- **BETTING** — can bet and roll (locked dice auto-picked)
- **ROLLING** — dice physics in progress (input blocked)
- **PICKING** — pick-1-of-3 upgrade overlay (only on table/boss clear: 1 pick normal, 2 picks boss)
- **BUST** / **RUN_WON** — end states

`RogueRun.resolve(values)` replaces `game.resolve()` in the game loop:
1. Auto-picks locked dice each cycle
2. Applies 12 dice type effects (safe→calc-risk→gambling→build-around)
3. Calls `game.resolve()` for base craps logic
4. Runs charm→bet→talent upgrade hooks
5. Handles synergies→anti-synergies→legendary check
6. Returns `'win' | 'loss' | 'point' | 'continue' | 'push'`

**Map progression**: 3 acts × 3 floors, 27 nodes. Player chooses path per floor. Table nodes advance the run; shop/mystery/rest are optional.

## Dice system (12 types, 4 categories)

| Category | Types | Design intent |
|----------|-------|---------------|
| **Safe** | House Bones (dur 15), Witness (dur 10) | Reliable, show prediction |
| **Calculated Risk** | Glass (2.5x/shatters), Volatile (±50%), Cursed 13 (reversed), Loaded Set (paired +2) | Math-driven risk/reward |
| **Gambling** | Snake Eyes (sum=2 auto-win), Doom d20 (1=bust, 20=clear) | Push-your-luck |
| **Build-Around** | Debt (₡1/roll), Vengeance (+1/cracked), Pyre (5% clear), Split (independent payout) | Scale with run state |

**DiceHand**: 4-slot inventory. `lockedSlots` Set marks 2 dice locked per table (auto-picked each roll). Durability per slot, cracked at 0 (20% lose ₡1 on loss). `autoPickLocked()` runs before every roll.

Starting hand: House Bones + Witness + 2 random non-safe dice.

## Upgrade system (31 upgrades, 4 categories, 3 rarities)

| Category | Effect | Examples |
|----------|--------|----------|
| **dice** | Modify roll outcomes | Loaded Sevens, Snake Charmer, Hot Dice |
| **bet** | Modify payout math | Double Down, Compound Streak, Fire Bet |
| **charm** | One-time use, trigger on events | Rabbit Foot, Lucky Coin |
| **talent** | Passive income / threshold mods | Bookie (₡1/roll), Iron Bank, Loan Shark |

Charms store charge count in `activeUpgrades Map`. Others store `-1` (permanent). `hasCharges()` checks >0; `consume()` decrements/deletes.

**Pick triggers**: Table clear = 1 pick. Boss clear = 2 picks. Purist vow: +1/table. Iron Man: +2 at start. Mystery node: 25% chance.

Meta-progression: XP = `money + tables*50 + upgrades*10 + win_bonus(200)`. 10 level thresholds (100→10,000). 8 perks with prerequisite tree. Persisted via `localStorage` key `crapser_meta`.

## Key gotchas
- **Settle detection**: `V_THRESHOLD=0.08`. `SETTLE_FRAMES=50`, `SETTLE_TIMEOUT=3000ms` — if 3s and both < 0.3, velocities zeroed and settle forced
- **Dead throw + rogue state**: `game.deadThrow()` doesn't reset `rogueRun.runState` from `'ROLLING'` — must set `rogueRun.runState = 'BETTING'` manually
- **hitWall**: tracked via `body.addEventListener('collide')` + `wallBody.id` check inline in `main.js`
- **Post-processing**: `RenderPass → FilmPass(0.8,0.5,200,false) → RGBShiftShader(0.003) → VignetteShader(offset:0.6,darkness:1.2) → OutputPass`
- **Camera**: initial (16, 9, 22), minDist 6, maxDist 60, far plane 200. Fog (60, 200)
- **OrbitControls**: LEFT mouse = aim/drag, RIGHT = orbit, wheel = dolly, touch TWO = DOLLY_PAN
- **CSS** in `<link>` (`index.html`), not JS-imported
- **No classes in `main.js`** — module-scoped state + inline functions
- **Rogue UI** elements inside `#rogue-info` in `#bottom-area` (footer). `#meta-foot` uses child IDs only
- **Power bar** at `bottom: 190px` (clears footer)
- **Dice thrown directly** on aim/space — no per-roll dice pick overlay (removed in refactor). Dice auto-picked from locked slots via `diceHand.autoPickLocked()`
- **DIFFERENCES FROM OLD AGENTS.md**: Currency is ₡ not $. State machine has 6 states (not 7), no DICE_PICK or TABLE_CLEAR. Tables are map nodes, not linear progression. 12 dice types (not 6). dice.js is 1060 lines with custom geometry builders. npcs.js is 16 lines (shopkeepers only, no betting NPCs).
- **ESLint**: Flat config (`eslint.config.js`). Uses `@eslint/js` recommended + `eslint-config-prettier`. Run `npm run lint` before commits.
- **`src/utils.js`**: Provides `shuffle()` (Fisher-Yates). Importable by any module.

## DOM IDs
Core: `#phase-display`, `#game-message`, `#game-info`, `#point-display`, `#rules-hint`, `#money-display`, `#bottom-bar`, `#dice-result`, `#bet-chips`, `#roll-count`, `#win-count`, `#history-strip`, `#power-bar-bg`, `#power-bar-fill`, `#new-game-btn`
Roguelite: `#rogue-info` → `#table-display` + `#run-status` + `#meta-foot`, `#pick-overlay`, `#dice-pick-overlay` (reused for table-start-lock), `#map-overlay`, `#shop-overlay`, `#vow-select-overlay`, `#game-over`, `#perk-overlay`, `#result-card`

## Shop system
- 27 items across 6 NPCs (Larry, Sal, Mike, Ruth, Nick, Diane)
- 5 trust tiers: Stranger(0%)→Regular(5%)→Friend(10%)→Partner(20%)→Family(30%)
- Trust thresholds: ₡20/100/300/1000 spent per NPC
- Cost: `floor(nodeTarget × costPct × (1 - trustDiscount))`
- Dice items use new type IDs (house_bones, witness, glass, volatile, cursed_13, loaded_set, snake_eyes, doom, debt, vengeance, pyre, split)
- Replacement preference: `house_bones` (was `standard`)

## Vows (Optional Difficulty)
1. **Iron Man**: No shops. +2 starting upgrades.
2. **Glass Jaw**: House Bones dice start cracked. +50% starting money.
3. **Speed Run**: 7 hands/table max. Double XP.
4. **Purist**: No dice type effects. +1 upgrade/table clear.

## How to add
1. Create stateless module in `src/` (no THREE/CANNON unless rendering/physics needed)
2. Export pure functions / classes
3. Wire into `main.js` (events, game loop) and `ui.js`/`rogue-ui.js` (DOM updates)
4. For a new upgrade: add entry to `upgrades.js` `UPGRADES` array, then add `has('id')` logic in `rogue-run.js` `resolve()`
5. For a new dice type: add to `DICE_TYPES` in `dice-types.js`, add resolve hook in `rogue-run.js`, add geometry builder in `dice.js`, add shop entry in `shop.js`
