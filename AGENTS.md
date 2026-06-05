# crapser — street craps Three.js game + roguelite

## Stack
- Vite 6, Three.js 0.171.0, Cannon-es 0.20.0
- No test/lint/typecheck — `npm run build` is the only validation
- Deployed to Cloudflare Pages: https://crapser.pages.dev

## Commands
- `npm run dev` — dev server (hot reload)
- `npm run build` — verify build
- `npx wrangler pages deploy dist --project-name=crapser --branch=main` — manual deploy
- CI/CD: `.github/workflows/deploy.yml` auto-deploys `master` git branch via `cloudflare/wrangler-action@v3` with **explicit `accountId: 47aba4286a4f0a7f1117839b0326c2cf`**. `CLOUDFLARE_API_TOKEN` repo secret needs **Cloudflare Pages → Edit** scoped to account.

## Architecture (14 modules, ~3990 lines)

| Module | Role | Depends on |
|--------|------|------------|
| `src/main.js` (644) | Entry: scene, renderer, EffectComposer, game loop, input, settle detection, dead-throw handling | all others |
| `src/game.js` (126) | Pass-line craps state machine (come-out → point), money/bet, `deadThrow()` refund, `minBet` | none |
| `src/dice.js` (114) | Dice mesh (RoundedBoxGeometry), canvas pip textures, `getTopFace()` via quaternion dot | three/addons |
| `src/physics.js` (75) | Cannon-es world, die bodies, `hoverDie()`, `launchDie()`, wall body, `V_THRESHOLD=0.08` | cannon-es |
| `src/ui.js` (149) | DOM overlay: phase/message/rules, bet chips, history strip, NPC cards, power bar | none |
| `src/rogue-run.js` (489) | RogueRun wraps Game — 25 upgrade `resolve()` hooks, table advancement, pick-3 state machine | `game.js`, `upgrades.js` |
| `src/rogue-ui.js` (395) | Pick-3 overlay (cards + stagger + reroll), table display, progress bar, perk overlay, bust/win screens | `upgrades.js` |
| `src/upgrades.js` (266) | 25 upgrade definitions (4 categories, 3 rarities) + TABLE_CONFIGS (5 tables, one boss) | none |
| `src/meta-progress.js` (136) | XP/levels (10 thresholds), 8 perks with prerequisites, localStorage, `getBonuses()` | none |
| `src/announcer.js` (68) | 24 dice-combo aliases + context phrases | none |
| `src/npcs.js` (145) | 6 NPCs with `placeBet()`, `settleBet()`, `getDialogue()` | none |
| `src/audio.js` (94) | Web Audio API procedural: roll noise, bounce, settle clicks, win/lose melody | none |
| `src/pot.js` (237) | Physically-simulated bill/coin pile — Box (bills) + Cylinder (coins) | three, cannon-es |
| `src/style.css` (1052) | Dark theme, rogue UI (progress bar, perk overlay, boss glow), card-enter animation | none |

## RogueRun state machine

`RogueRun.runState` controls what input is accepted:
- **BETTING** — can bet and roll
- **ROLLING** — dice physics in progress (input blocked)
- **PICKING** — pick-1-of-3 upgrade overlay (only card clicks)
- **TABLE_CLEAR** — table cleared, overlay with continue button
- **BUST** — run lost (money ≤ 0, or -50 with Loan Shark)
- **RUN_WON** — beat final table (The House, $1K target)

`RogueRun.resolve(values)` replaces `game.resolve()` in the game loop:
1. Optionally applies Hot Dice auto-win on come-out
2. Calls `game.resolve()` for base craps logic
3. Runs active upgrade hooks (charms → dice → bet → talents)
4. Handles table progression — bust (Escape Plan check), table advance, final win
5. Returns `'win' | 'loss' | 'point' | 'continue' | 'push'`

Table progression: 5 tables (Back Alley $200 → The House $1,000). `tableIndex` increments on clear; `game.minBet` enforces minimums. Final table has boss badge + glow.

## Upgrade system (25 upgrades, 4 categories, 3 rarities)

| Category | Effect | Examples |
|----------|--------|----------|
| **dice** | Modify roll outcomes | Loaded Sevens, Snake Charmer, Hot Dice |
| **bet** | Modify payout math | Double Down, Compound Streak, Fire Bet |
| **charm** | One-time use, trigger on events | Rabbit Foot, Lucky Coin |
| **talent** | Passive income / threshold mods | Bookie ($1/roll), Iron Bank, Loan Shark |

Charms store charge count in `activeUpgrades Map` (from `upgrade.maxCharges`). Others store `-1` (permanent). `hasCharges()` checks > 0; `consume()` decrements/deletes.

Meta-progression: XP = `floor(money/5) + tables*50 + upgrades*10 + win_bonus(200)`. 10 level thresholds (100 → 10,000). 8 perks with prerequisite tree. Persisted via `localStorage` key `crapser_meta`. `getBonuses()` returns startingMoney, rerollTokens, extraPick, interestPerHand, firstFree.

## Key gotchas
- **Settle detection**: `V_THRESHOLD=0.08`. `SETTLE_FRAMES=50`, `SETTLE_TIMEOUT=3000ms` — if 3s and both < 0.3, velocities zeroed and settle forced
- **Dead throw + rogue state**: `game.deadThrow()` doesn't reset `rogueRun.runState` from `'ROLLING'` — must set `rogueRun.runState = 'BETTING'` manually (main.js:547)
- **hitWall**: tracked via `body.addEventListener('collide')` + `wallBody.id` check inline in `main.js`
- **Post-processing**: `RenderPass → FilmPass(0.8,0.5,200,false) → RGBShiftShader(0.003) → VignetteShader(offset:0.6,darkness:1.2) → OutputPass`
- **Camera**: initial (16, 9, 22), minDist 6, maxDist 60, far plane 200. Fog (60, 200)
- **OrbitControls**: LEFT mouse = aim/drag (custom), RIGHT = orbit, wheel = dolly, touch TWO = DOLLY_PAN
- **CSS** in `<link>` (`index.html`), not JS-imported
- **No classes in `main.js`** — module-scoped state + inline functions
- **Rogue UI elements** live inside `#rogue-info` in `#bottom-area` (footer). `#meta-foot` replaces old `#meta-top` — JS uses child IDs only
- **Power bar** at `bottom: 190px` (clears the taller footer)

## DOM IDs
Core: `#phase-display`, `#game-message`, `#game-info`, `#point-display`, `#rules-hint`, `#money-display`, `#bottom-bar`, `#dice-result`, `#bet-chips`, `#roll-count`, `#win-count`, `#history-strip`, `#power-bar-bg`, `#power-bar-fill`, `#new-game-btn`, `#npcs`
Roguelite: `#rogue-info` → `#table-display` + `#run-status` + `#meta-foot` (contains `#meta-display`, `#reroll-display`, `#perk-toggle`), `#pick-overlay` → `#pick-cards` + `#pick-header` + `#pick-actions` (`#pick-reroll`, `#pick-skip`), `#table-clear` → `#table-clear-content` + `#table-clear-btn`, `#game-over` → `#game-over-content`, `#perk-overlay` → `#perk-list`

## NPC conventions
- `NPCS` array + `NPC_NAMES` const (6 NPCs)
- `npc.placeBet(outcome)` → stake (0 if broke); `npc.settleBet(outcome, payout)` updates money
- `npc.getDialogue(eventType)` → array, 60% speak chance, 4.5s display
- UI: `NPCS` iterated for avatar cards; bubble via absolute `<div>` in card

## How to add
1. Create stateless module in `src/` (no THREE/CANNON unless rendering/physics needed)
2. Export pure functions / classes
3. Wire into `main.js` (events, game loop) and `ui.js` / `rogue-ui.js` (DOM updates)
4. For a new upgrade: add entry to `upgrades.js` `UPGRADES` array, then add `has('id')` logic in `rogue-run.js` `resolve()`