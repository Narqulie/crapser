# crapser — street craps Three.js game

## Stack
- Vite 6, Three.js 0.171.0, Cannon-es 0.20.0
- No test, lint, or typecheck tooling. `vite build` is the only validation.

## Commands
- `npm run dev` — dev server (hot-reload)
- `npm run build` — verify build (checks for import/syntax errors)

## Architecture (9 modules, ~1100 lines)

| Module | Role | Depends on |
|--------|------|------------|
| `src/main.js` | Entry: scene, renderer, composer, game loop, pointer/touch/wheel events | all others |
| `src/dice.js` | Three.js dice mesh (RoundedBoxGeometry), canvas pip textures, face detection via quaternion dot | three/addons/geometries/RoundedBoxGeometry |
| `src/physics.js` | Cannon-es world, die bodies, hoverDie/launchDie, settle detection (velocity<0.08 for 50 frames) | cannon-es |
| `src/game.js` | Pass-line craps state machine (come-out → point), money, bet, rollHistory[12], deadThrow refund | none |
| `src/ui.js` | DOM overlay: phase/point/rules display, bet slider, history strip, announcer overlay, power bar | none (manipulates index.html IDs) |
| `src/announcer.js` | 24 dice-combo aliases + context phrases (win/loss/point/seven-out), randomized selection | none |
| `src/npcs.js` | 4 NPC participants: Lucky Larry, Sal the Stat, Big Mike, Old Ruth — Pass-line bets, dialogue | none |
| `src/audio.js` | Web Audio API procedural sounds: roll (noise), bounce, settle (clicks), win/lose (melody) | none |
| `src/pot.js` | Physically-simulated bill/coin pile at x=-9 — Box bodies (bills) + Cylinder bodies (coins), mass 0.1/0.2, drops from above via physics, constructor `Pot(scene, world, groundBody)` | three, cannon-es |
| `src/style.css` | Dark theme, bottom bar, power bar, NPC cards, game-over overlay, roll history tiles | none |

## Conventions
- Three.js imports: `import * as THREE from 'three'` or bare `three/addons/...` paths
- Cannon-es: `import * as CANNON from 'cannon-es'`
- CSS in `<link>` tag (`index.html`), not JS-imported
- No classes in main.js — module-scoped state with inline functions
- All game/UI state is in normal JS variables, not reactive framework

## Key gotchas
- **Cannon-es v0.20**: `sleepSpeedLimit` is 0.04, `sleepTimeLimit` is 1.0 (default). Settle detection uses custom 50-frame window on velocity < 0.08. **Settle timeout**: 8000ms fallback — if 8s elapsed and both dice velocity < 0.3, velocities are zeroed and settle forced.
- **Three.js post-processing**: EffectComposer chain is RenderPass → FilmPass(0.25) → OutputPass. FilmPass adds animated grain.
- **Camera**: initial position (16, 9, 22), minDist 6, maxDist 60, far plane 200. Fog (60, 200).
- **DOM IDs**: `#phase-display`, `#game-message`, `#game-info`, `#bottom-bar`, `#game-over`, `#npcs`, `#history-strip`, `#power-bar-bg`, `#power-bar-fill`, `#dice-result`, `#announcer-overlay` — wire UI state through `document.getElementById()`
- **OrbitControls**: LEFT mouse = aim/drag (handled manually), RIGHT mouse = orbit, wheel = dolly, touch TWO = DOLLY_PAN
- **Dead throw**: each die has `hitWall` flag via Ccannon `collide` event. On settle, if either missed the wall, `game.deadThrow()` refunds the bet and dice return to hover.

## NPC module conventions
- NPCs are plain objects in an array, exported as `NPCS` and `NPC_NAMES` (const lookup)
- `npc.placeBet(outcome)` returns stake (0 if broke), `npc.settleBet(outcome, payout)` updates money
- Dialogue: `npc.getDialogue(eventType)` returns array of messages, pick one, 60% speak chance, 4.5s display
- UI: iterate `NPCS` to render avatar cards; speech bubble via absolute-positioned `<div>` in the NPC card

## How to add a feature
1. Create stateless module in `src/` (no THREE or CANNON imports unless rendering or physics needed)
2. Export pure functions / classes
3. Wire into `main.js` (events, game loop) and `ui.js` (DOM updates)
