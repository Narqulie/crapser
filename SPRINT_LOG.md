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
```

**Total**: 6 sprints, ~5,900 insertions, ~440 deletions, 19 files changed.  
3 new files: `dice-types.js`, `map.js`, `shop.js`.  
Final state: **17 modules, ~9,600 lines**.

---

## File Inventory (17 modules)

| # | File | Lines | Role | New? |
|---|------|:-----:|------|:----:|
| 1 | `rogue-run.js` | 1,463 | RogueRun state machine: 7 states, resolve (dice→charms→mods→bets→talents→synergies→legendary), map navigation, vows, table traits, shop frequency | — |
| 2 | `rogue-ui.js` | 898 | 6 overlays: pick-3, dice pick, shop, map, bust/won, perk. Wired to all systems. | — |
| 3 | `shop.js` | 799 | ShopSystem class: 23 items, 5 trust tiers (Stranger→Family, $0→$5k), weighted NPC selection, buy/sell | ✅ |
| 4 | `main.js` | 770 | Scene (Three.js), physics (cannon-es), input (aim/drag/space), game loop, drama timing, MAP_NAV detection | — |
| 5 | `upgrades.js` | 570 | 31 upgrades (4 categories), TABLE_TRAITS (5), SYNERGIES (8 set bonuses), ANTI_SYNERGIES (4 pairs), LEGENDARY (5% instant win), getActiveSynergies() | — |
| 6 | `pot.js` | 387 | Cosmetic physics money pile (bills + coins, cannon-es bodies) | — |
| 7 | `style.css` | 2,394 | Complete CSS: money bar, result cards, overlays, map, shop, vows, dice pick, bonus panel, responsive | — |
| 8 | `ui.js` | 327 | Main HUD: triple-bar money, result card animation, table progress bar, bonus panel (synergy badges), screen flash | — |
| 9 | `dice-types.js` | 304 | 12 dice types + DiceHand class (4-slot inventory, pick 2, durability, cracked state, replace) | ✅ |
| 10 | `map.js` | 294 | MAP_ACTS (3 acts × 3 floors × 27 nodes), NODE_TYPES, helpers (getNode, getFloorNodes, isActComplete) | ✅ |
| 11 | `dice.js` | 286 | Three.js dice meshes (RoundedBoxGeometry), canvas pip textures, type tints, durability visuals, cracked wireframe | — |
| 12 | `meta-progress.js` | 262 | XP/levels (10 thresholds), 8 perks, 4 VOW_DEFS, NPC trust persistence, timing constants, localStorage | — |
| 13 | `audio.js` | 175 | Procedural Web Audio: roll noise, bounce, settle clicks, win/lose melodies | — |
| 14 | `game.js` | 164 | Pure craps state machine (COME_OUT→POINT), resolve(), deadThrow(), setBet() | — |
| 15 | `physics.js` | 166 | Cannon-es world: wall/ground, die bodies, settle detection (V_THRESHOLD=0.08, 50 frames, 3s timeout) | — |
| 16 | `announcer.js` | 134 | 24 dice-combo aliases (Snake Eyes, Boxcars, etc.) + context calls per result | — |
| 17 | `npcs.js` | 16 | NPC_DEFS: 6 shopkeeper definitions (id, name, color, greeting). Stripped from 145L cosmetic bettor system. | — |
| — | `index.html` | 173 | DOM: 8 overlays, money bar, progress, bonus panel, HUD elements | — |
| | **TOTAL** | **~9,600** | | |

---

## Architecture Decisions

### State Machine (rogue-run.js)
```
BETTING → DICE_PICK → ROLLING → RESOLVE → PICKING/MAP_NAV/BUST/RUN_WON
                                              ↓
                                          SHOPPING (map node or random)
                                              ↓
                                          MAP_NAV (node complete)
                                              ↓
                                          selectNode() → BETTING/SHOPPING/MAP_NAV
```

7 states. `resolve()` is the central hook pipeline: dice effects → charm hooks → dice mod hooks → bet mod hooks → talent hooks → synergy resolution → anti-synergy detection → legendary check → table traits → _postResolve (state transitions).

### Money = HP + Currency
Single economy. Spending money at shops reduces your bust buffer. No separate currencies. Trust discounts (0-30%) reward loyalty to specific NPCs. Cost formula: `floor(nodeTarget × costPct × (1 − trustDiscount))`.

### Inner Loop Immutability
The per-hand flow (BETTING → DICE_PICK → ROLLING → RESOLVE → PICKING) never changed across all 6 sprints. Only the outer progression loop evolved: linear table indexing → player-chosen node map.

### Dice Hand vs Active Upgrades
Two parallel systems:
- **DiceHand** (dice-types.js): 4-slot physical dice inventory, pick 2 per roll, durability per slot, cracked state, visual tints on Three.js meshes
- **activeUpgrades** (rogue-run.js): Map of upgrade objects, charges (-1 = permanent, >0 = consumable), applied during resolve hooks

---

## Balance Model

### Upgrade Frequency
- Picks trigger on: win OR point-established (~70% of hands, was ~49%)
- ~10-14 upgrades per run (8-12 hands per act × 3 acts ÷ 2)
- 31 total upgrades in pool → player sees ~35-45% of pool
- Category weighting favors unfilled categories (makes Legendary achievable)

### Dice Durability
| Type | Durability | ~Hands | Effect |
|------|:----------:|:------:|--------|
| Standard | 12 | 6 | None |
| Weighted | 8 | 4 | 25% come-out → 7 |
| Volatile | 6 | 3 | ±50% payout |
| Seven Die | 6 | 3 | Sum=6→7 once/hand |
| Glass | 3 | 1-3 | 2.5x payout, shatters on loss |
| Precision | 10 | 5 | Re-roll 2/12 |
| Lucky 11 | 8 | 4 | 20% 3:2 odds |
| Cursed 13 | 10 | 5 | Win −$5 / Loss +$3 |
| Mirror | 8 | 4 | Copies other die at 25% |
| Snake Eyes | 6 | 3 | Sum=2 auto-wins |
| Hustler | 5 | 2-3 | 3 wins = free upgrade |
| Loaded Set | 12 | 6 | Paired: +2 sum |

Two dice consumed per roll from a 4-slot hand → ~16 total usable throws before all cracked.

### Difficulty Curve (fixed from inverted)
```
Act 1 (Alleys, $150-350):  Few upgrades, no synergies, low money  → HARD
Act 2 (Underground, $300-500):  4-6 upgrades, possible synergy    → MEDIUM
Act 3 (The House, $500-1000):   8-12 upgrades, synergies active   → HARD (boss traits)
```
Table traits escalate: Slippery (+$25 minBet) → Crooked (10% fudge) → High Stakes (dice before bet) → Boss (3% upgrade steal on loss).

### Shop Economy
- 23 items (14 functional + 5 dice + 4 charms/mystery)
- NPC-specific inventories, weighted selection
- Cost: 15-55% of node target, discounted 0-30% by trust
- Shops: every ~2 hands (random) + guaranteed on map shop nodes

### Vows (Optional Difficulty)
1. **Iron Man**: No shops. +2 starting upgrades.
2. **Glass Jaw**: Standard dice start cracked. +50% starting money.
3. **Speed Run**: 5 hands/table max. Double XP.
4. **Purist**: No dice type effects. +1 upgrade/table clear.

---

## Known Issues (Pre-Sprint 7)

### Bugs
1. **MAP_NAV shows before result card dismisses** — map overlay renders immediately on node clear, overlapping the 2.8s result card animation. Fix: delay MAP_NAV activation until after result card timeout.
2. **Vow → Map flow skips MAP_NAV** — after vow selection, goes straight to BETTING instead of showing the map.
3. **Dead DOM**: `#table-clear` overlay still in index.html (inert, never shown). Internal `TABLE_CONFIGS` still in upgrades.js (vestigial).
4. **Hustler die tracking**: Per-slot win counter resets when swapping dice. Should be per-die-ID, not per-slot.
5. **Loaded Set shop edge case**: Buying Loaded Set when hand already has 1 loaded_set — isPair requires 2 free slots, but one slot is occupied by an existing loaded_set. Current code may reject the purchase.

### Balance Concerns
6. **Shop frequency too high**: Every 2-3 hands + map shop nodes = ~15-20 potential shop visits. Reduce random shops or remove them entirely (keep only map nodes).
7. **Rest node too generous**: +2 durability to ALL dice + $25. Nerf to +1 to 2 random dice.
8. **Mystery node too swingy**: ±$50 flat regardless of act. Scale by act: Act 1 ±$20, Act 2 ±$40, Act 3 ±$60.
9. **Speed Run hand limit**: 5 hands/table may be too punishing. Test at 7-8.
10. **Glass Jaw money multiplier**: Stacks multiplicatively with meta perk starting money. Check if this is intended.

### Polish
11. **No interstitial narrative** — between acts, player sees MAP_NAV with no ceremony. Add brief scene/transition.
12. **Run variety** — 27 nodes, ~12-18 visited per run. Shuffle node pool per floor for replayability.
13. **No elite nodes** — between table and boss difficulty. Higher target, guaranteed rare+ reward.
14. **Dice durability shop** — can only buy full replacements. No repair/fuse/upgrade options.
15. **Zero tests** — 9,600 lines untested. Start with game.js (pure craps math), dice-types.js (DiceHand), upgrades.js (synergies).

---

## Next Sprint — Sprint 7: Polish & Balance

### Priority 1: Bug Fixes (1-2 hours)
- [ ] **MAP_NAV timing fix**: Gate map overlay behind result card completion (2.8s delay after node clear)
- [ ] **Vow → Map flow**: `showMap()` after vow selection instead of `BETTING`
- [ ] **Dead code removal**: `#table-clear` DOM, internal `TABLE_CONFIGS`, vestigial button listeners
- [ ] **Hustler tracking**: Change from per-slot counter → per-die-ID counter on diceHand

### Priority 2: Balance Tuning (1-2 hours)
- [ ] **Shop frequency**: Remove random shops. Keep only map shop nodes (~4-6 per run).
- [ ] **Rest node**: +1 durability to 2 random dice (was +2 to all).
- [ ] **Mystery node**: Scale by act — Act 1 ±$20, Act 2 ±$40, Act 3 ±$60.
- [ ] **Speed Run vow**: 7 hands/table limit (was 5).
- [ ] **Loaded Set shop**: Handle partial slot case (1 existing + 1 bought = complete set).

### Priority 3: Content Expansion (3-4 hours)
- [ ] **Elite nodes**: Between table and boss. Higher target, guaranteed rare+ pick. 2 per act.
- [ ] **Interstitial act transitions**: Brief scene between acts (NPC cameo, setting change). ~30 lines.
- [ ] **Run variety**: Shuffle maps — on second run, alternate node pool per floor.
- [ ] **Narrative flourishes**: Act transition text, boss entrance text, mystery flavor text.

### Priority 4: Technical Debt (2-3 hours)
- [ ] **Test harness**: game.js tests (resolve math), dice-types.js tests (DiceHand), upgrades.js tests (synergy calc).
- [ ] **Error boundaries**: Graceful handling if selectNode receives invalid nodeId.
- [ ] **Performance**: Check frame drops with new overlays (6 overlays now, up from 3).

### Estimated: 8-11 hours total

---

## Deployment

- **Platform**: Cloudflare Pages
- **CI/CD**: `.github/workflows/deploy.yml` — auto-deploys `master` branch via `cloudflare/wrangler-action@v3`
- **Account ID**: `47aba4286a4f0a7f1117839b0326c2cf`
- **Live URL**: https://crapser.pages.dev
- **Last deploy**: `bfb1895` — `feat: full roguelike overhaul` — succeeded

## Commands

```bash
npm run dev           # Dev server (hot reload)
npm run build         # Verify build (36 modules)
npx wrangler pages deploy dist --project-name=crapser --branch=main  # Manual deploy
```
