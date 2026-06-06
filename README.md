# crapser

A browser-based street craps roguelite built with Three.js and Cannon-es. Shoot dice against the house through three acts of escalating danger — lock your dice, manage durability, collect upgrades, and survive until The Penthouse.

![screenshot](ss_asset.png)

## game modes

### street craps (core loop)
- **Aim** by dragging on the table — a dashed line and target ring show where the dice go
- **Throw** with left click or spacebar for a straight shot
- **Power** scales with aim distance (the bar fills up)
- **Bet** using ₡1 / ₡2 / ₡5 / ₡10 / ₡20 chips, or cycle with arrow keys
- **Craps rules**: 7/11 wins on come-out, 2/3/12 loses. Hit your point to win, seven-out to lose

### roguelite mode
- **Map navigation**: Choose your path through 27 nodes across 3 acts and 3 floors
- **Dice hand**: 4-slot inventory — pick 2 dice to lock for the entire table
- **12 dice types**: House Bones, Witness, Glass, Volatile, Cursed 13, Loaded Set, Snake Eyes, Doom d20, Debt, Vengeance, Pyre, Split
- **31 upgrades**: 4 categories (dice, bet, charm, talent) with 3 rarities
- **8 synergies** and **4 anti-synergies** — set bonuses change how you play
- **NPC shops**: 6 shopkeepers, 5 trust tiers, 27 items
- **4 vows**: Optional difficulty modifiers (Iron Man, Glass Jaw, Speed Run, Purist)
- **Meta-progression**: XP, 10 levels, 8 perks, persistent progress

## the gimmicks

- **Dice that aren't dice**: skulls, coin stacks, pyramids, linked pairs, spheres, icosahedrons
- **Physical money pile** that builds up at the side of the table in ₡1/2/5/10/20 bills
- **Procedural audio** — all sounds generated on the fly, no audio files
- **Retro film grain + vignette + RGB shift** — 70s crime movie aesthetic
- **Dice combos** called out in proper craps slang — "Snake Eyes", "Little Joe", etc.

## running it locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## tech

- [Three.js](https://threejs.org/) — 3D rendering
- [Cannon-es](https://github.com/pmndrs/cannon-es) — physics
- [Vite](https://vitejs.dev/) — dev/build
- Web Audio API — sound
- Zero frameworks — all DOM UI is manual vanilla JS
- Deployed on [Cloudflare Pages](https://crapser.pages.dev)
