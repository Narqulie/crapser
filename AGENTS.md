# crapser — street craps Three.js game

## Stack
- Vite 6, Three.js 0.171.0, Cannon-es 0.20.0
- No test, lint, or typecheck tooling. `vite build` is the only validation.
- Deployed to Cloudflare Pages: https://crapser.pages.dev

## Commands
- `npm run dev` — dev server (hot-reload)
- `npm run build` — verify build
- `npx wrangler pages deploy dist --project-name=crapser --branch=main` — deploy to production
- CI/CD: GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys `main` branch via `cloudflare/wrangler-action@v3` — needs `CLOUDFLARE_API_TOKEN` repo secret

## Architecture (9 JS modules + CSS, ~2055 lines)

| Module | Role | Depends on |
|--------|------|------------|
| `src/main.js` (618) | Entry: scene, renderer, EffectComposer, game loop, pointer/touch/wheel events, hitWall logic, settle detection | all others |
| `src/dice.js` (114) | Dice mesh (RoundedBoxGeometry), canvas pip textures, face detection via quaternion dot | three/addons/geometries/RoundedBoxGeometry.js |
| `src/physics.js` (75) | Cannon-es world, die bodies, `isSettled()`, `hoverDie()`, `launchDie()`, wall body | cannon-es |
| `src/game.js` (125) | Pass-line craps state machine (come-out → point), money, bet, rollHistory[12], deadThrow refund | none |
| `src/ui.js` (149) | DOM overlay: phase/point/rules, bet chips, history strip, announcer overlay, power bar, NPC cards | none |
| `src/announcer.js` (68) | 24 dice-combo aliases + context phrases, randomized selection | none |
| `src/npcs.js` (145) | 6 NPCs: Lucky Larry, Sal the Stat, Big Mike, Old Ruth, Nervous Nick, Deadeye Diane | none |
| `src/audio.js` (94) | Web Audio API procedural sounds: roll (noise), bounce, settle (clicks), win/lose (melody) | none |
| `src/pot.js` (237) | Physically-simulated bill/coin pile at x=-9 — Box bodies (bills) + Cylinder bodies (coins) | three, cannon-es |
| `src/style.css` (430) | Dark theme, bottom bar, power bar, NPC cards, game-over overlay, roll history tiles | none |

## Key gotchas
- **Settle detection**: `physics.js` `V_THRESHOLD = 0.08`. `main.js` `SETTLE_FRAMES = 50`, `SETTLE_TIMEOUT = 3000`ms — if 3s elapsed and both dice velocity < 0.3, velocities are zeroed and settle forced.
- **hitWall**: Inline in `main.js` (not physics.js) via `world.addEventListener('preStep')` + `body.id` check against `wallBody.id`
- **Post-processing**: EffectComposer chain: `RenderPass` → `FilmPass(0.8, 0.5, 200, false)` → `OutputPass`
- **Camera**: initial (16, 9, 22), minDist 6, maxDist 60, far plane 200. Fog (60, 200).
- **OrbitControls**: LEFT mouse = aim/drag (handled manually), RIGHT mouse = orbit, wheel = dolly, touch TWO = DOLLY_PAN
- **Dead throw**: if either die missed the wall, `game.deadThrow()` refunds the bet and dice return to hover
- **DOM IDs**: `#phase-display`, `#game-message`, `#game-info`, `#bottom-bar`, `#game-over`, `#npcs`, `#history-strip`, `#power-bar-bg`, `#power-bar-fill`, `#dice-result`, `#announcer-overlay`, `#new-game-btn`, `#bet-chips`
- **Three.js imports**: `import * as THREE from 'three'` or bare `three/addons/...` paths
- **Cannon-es**: `import * as CANNON from 'cannon-es'`
- **CSS** in `<link>` tag (`index.html`), not JS-imported
- No classes in `main.js` — module-scoped state with inline functions
- All game/UI state in normal JS variables, not reactive framework

## NPC conventions
- `NPCS` array + `NPC_NAMES` const lookup (6 NPCs)
- `npc.placeBet(outcome)` returns stake (0 if broke), `npc.settleBet(outcome, payout)` updates money
- `npc.getDialogue(eventType)` returns array of messages, 60% speak chance, 4.5s display
- UI: iterate `NPCS` to render avatar cards; speech bubble via absolute-positioned `<div>` in the NPC card

## How to add a feature
1. Create stateless module in `src/` (no THREE or CANNON imports unless rendering or physics needed)
2. Export pure functions / classes
3. Wire into `main.js` (events, game loop) and `ui.js` (DOM updates)
