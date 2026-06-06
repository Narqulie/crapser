import { Game } from './game.js';
import { UPGRADES, getAvailableUpgrades, getActiveSynergies, TABLE_TRAITS } from './upgrades.js';
import { DiceHand, getStartingHand, getDieType, isCracked, crackedEffect } from './dice-types.js';
import { RESULT_CARD_DELAY, RESULT_CARD_DISPLAY } from './meta-progress.js';
import { MAP_ACTS, getNode, getFloorNodes, getNextFloors, isActComplete } from './map.js';
import { shuffle } from './utils.js';

/**
 * RogueRun wraps a Game instance with roguelite progression.
 *
 * States:
 *   MAP_NAV          — choosing a node on the map overlay
 *   TABLE_START_LOCK — pick 2 dice to lock for entire table
 *   BETTING          — player can set bet and roll
 *   ROLLING          — dice physics in progress
 *   SHOPPING         — visiting a shop (overlay shown)
 *   BUST             — run lost (money <= threshold)
 *   RUN_WON          — run won (money >= target on final boss)
 */
export class RogueRun {
  /**
   * @param {import('./meta-progress.js').MetaProgress|null} metaProgress — shared meta-progression instance
   */
  constructor(metaProgress = null) {
    this.meta = metaProgress;
    this.game = new Game();
    this.resetRun();
  }

  /**
   * Reset all run state for a fresh roguelite run.
   *
   * @param {object} [bonuses={}] — meta-progression bonuses
   * @param {number} [bonuses.startingMoney] — extra starting cash
   * @param {number} [bonuses.rerollTokens] — reroll tokens for pick phase
   * @param {number} [bonuses.extraPick] — extra card shown per pick
   * @param {number} [bonuses.firstFree] — number of free upgrades per run
   * @param {number} [bonuses.interestPerHand] — passive interest earned each hand
   */
  resetRun(bonuses = {}) {
    this.game.reset();
    // Apply meta bonuses
    if (bonuses.startingMoney) this.game.money += bonuses.startingMoney;
    this._metaBonuses = bonuses;

    this.activeUpgrades = new Map();
    this.handCount = 0;
    this.streak = 0;
    this.sidePot = 0;
    this.bonusPot = 0;
    this.currentActIndex = 0;
    this.currentFloorIndex = 0;
    this.currentNode = null;
    this.visitedNodes = new Set();
    this.runState = 'MAP_NAV';
    this.diceHand = new DiceHand(getStartingHand());
    this.diceHand.lockedSlots.clear();
    this._debtCounter = 0;
    this._witnessPrediction = null;
    this._lastResult = null;
    this._lastSum = null;
    this._lastPreviousPoint = null;
    this._pickShown = false;
    this._handEarnings = 0;
    this._hotDiceReady = false;
    this._firePoints = new Set();
    this._ironBankCounter = 0;
    this._perksUsedFree = 0;
    this._mapNavBlockedUntil = 0;
    this._synergyRerolls = 0;
    this._synergies = null;
    this._unluckyBonus = false; // unlucky streak flag: next roll gets +15% re-roll
    this._mapNavBlockedUntil = 0; // block MAP_NAV until result card anim finishes
    this._hustlerFreePick = false; // flag: Hustler just earned a free pick
    this._pendingTableClearPicks = 0; // upgrades remaining from table/boss clear pick
    this.pendingShops = []; // NPC IDs queued for shop visits
    this.currentShopNpc = null; // currently visiting NPC (null if none)

    // Reroll tokens from meta
    this.rerollTokens = bonuses.rerollTokens || 0;
    this.extraPick = bonuses.extraPick || 0;
    this.firstFree = bonuses.firstFree || 0;
    this.interestPerHand = bonuses.interestPerHand || 0;

    // Apply starting-money upgrades
    if (this.activeUpgrades.has('high_roller')) {
      this.game.money += 5;
    }

    // Min bet set to default until player selects a node
    this.game.minBet = 5;
    if (this.game.bet < this.game.minBet) {
      this.game.setBet(this.game.minBet);
    }

    // ─── VOW (DIFFICULTY MODIFIER) ──────────────────────
    /**
     * Currently active vow definition (from VOW_DEFS), or null.
     * Read once at run start from meta-progression; persists for the entire run.
     * @type {object|null}
     */
    this.vow = this.meta ? this.meta.getVow() : null;

    /** Hands played within the current node (reset on node clear). Used by speed_run vow. */
    this._tableHandCount = 0;

    // ─── VOW BONUSES ────────────────────────────────────
    if (this.vow) {
      switch (this.vow.effect) {
        case 'no_shops': {
          // Iron Man: +2 free upgrades at start
          const pool = getAvailableUpgrades(new Set());
          const shuffled = shuffle(pool);
          for (let i = 0; i < Math.min(shuffled.length, this.vow.bonus.extraUpgrades || 0); i++) {
            const upg = shuffled[i];
            if (upg.maxCharges) {
              this.activeUpgrades.set(upg.id, upg.maxCharges);
            } else {
              this.activeUpgrades.set(upg.id, -1);
            }
          }
          if (shuffled.length > 0) {
            this.game.message = `Iron Man: ${this.vow.bonus.extraUpgrades} free upgrades granted`;
          }
          break;
        }
        case 'cracked_standards': {
          // Glass Jaw: all house bones dice start cracked (durability 0)
          for (const slot of this.diceHand.slots) {
            if (slot.typeId === 'house_bones') {
              slot.durability = 0;
            }
          }
          // Glass Jaw: +50% starting money (bank + additional on top of meta bonuses)
          this.game.money = Math.floor(this.game.money * this.vow.bonus.startingMoneyMult);
          this.game.message = 'Glass Jaw: house bones cracked, +50% money';
          break;
        }
        default:
          break;
      }
    }
  }

  /**
   * Get the current map node's table-equivalent config for backward compat.
   * External callers (rogue-ui, shop) expect { id, name, target, minBet, boss } shape.
   * @returns {{ id: string, name: string, target: number, minBet: number, boss: boolean }}
   */
  getCurrentTable() {
    const n = this.currentNode;
    return {
      id: n?.id || '',
      name: n?.name || '???',
      target: n?.target || 0,
      minBet: n?.minBet || 5,
      boss: n?.type === 'boss',
    };
  }

  /**
   * Money target required to clear the current node (table/boss nodes only).
   * @returns {number}
   */
  getCurrentTarget() {
    return this.currentNode?.target || 0;
  }

  /**
   * Whether the current node is a boss node.
   * @type {boolean}
   */
  get isBossTable() {
    return this.currentNode?.type === 'boss';
  }

  /**
   * Whether the current node requires dice pick before bet (high-stakes trait).
   * @type {boolean}
   */
  get isHighStakes() {
    return this.currentNode?.trait === 'high_stakes';
  }

  /**
   * Whether the player can initiate a roll in the current run state.
   * @type {boolean}
   */
  get canRoll() {
    return this.runState === 'BETTING' && this.game.canRoll && this.game.money > 0;
  }

  /**
   * Money threshold below which the run is considered bust.
   * Loan Shark upgrade lowers this to -50.
   * @type {number}
   */
  get bustThreshold() {
    if (this.activeUpgrades.has('loan_shark')) return -10;
    return 0;
  }

  /**
   * Whether the current run is bust (money ≤ threshold on come-out).
   * @type {boolean}
   */
  get isBust() {
    return (
      this.game.money <= this.bustThreshold && this.game.phase === 'COME_OUT' && this.handCount > 0
    );
  }

  /**
   * Whether the current node's target has been met (for table/boss nodes).
   * Only meaningful when currentNode is a table or boss node.
   * @type {boolean}
   */
  get isRunWon() {
    if (
      !this.currentNode ||
      (this.currentNode.type !== 'table' && this.currentNode.type !== 'boss')
    )
      return false;
    return (
      this.game.money >= this.currentNode.target &&
      this.game.phase === 'COME_OUT' &&
      this.handCount > 0
    );
  }

  /**
   * Start the map navigation phase. Called from main.js on run start
   * or after a node is cleared to present the current floor's nodes.
   *
   * If the current floor has no unvisited nodes, auto-advances to the
   * next available floor/act.
   *
   * @returns {{ actIndex: number, floorIndex: number, actName: string, floorName: string, nodes: Array<object> }}
   */
  startMap() {
    // Auto-advance if all nodes on current floor are visited
    let actIdx = this.currentActIndex;
    let floorIdx = this.currentFloorIndex;
    let act = MAP_ACTS[actIdx];

    while (act && floorIdx < act.floors.length) {
      const floorNodes = getFloorNodes(MAP_ACTS, actIdx, floorIdx);
      const unvisited = floorNodes.filter((n) => !this.visitedNodes.has(n.id));
      if (unvisited.length > 0) break;

      // Advance to next floor/act
      const next = getNextFloors(MAP_ACTS, actIdx, floorIdx);
      if (!next) break;
      actIdx = next.actIndex;
      floorIdx = next.floorIndex;
      act = MAP_ACTS[actIdx];
    }

    this.currentActIndex = actIdx;
    this.currentFloorIndex = floorIdx;

    const currentAct = MAP_ACTS[actIdx];
    const currentFloor = currentAct?.floors[floorIdx];

    this.runState = 'MAP_NAV';
    return {
      actIndex: actIdx,
      floorIndex: floorIdx,
      actName: currentAct?.name || '???',
      floorName: currentFloor?.name || '???',
      nodes: currentFloor ? getFloorNodes(MAP_ACTS, actIdx, floorIdx) : [],
    };
  }

  /**
   * Select a node on the current floor by its ID.
   * Routes to the appropriate state based on node type:
   * table/boss → BETTING, shop → SHOPPING, mystery/rest → instant resolve → MAP_NAV.
   *
   * @param {string} nodeId — unique node identifier from MAP_ACTS
   * @returns {string|null} the new runState, or null if the node was invalid/visited
   */
  selectNode(nodeId) {
    const node = getNode(MAP_ACTS, nodeId);
    if (!node || this.visitedNodes.has(nodeId)) return null;

    this.currentNode = node;
    this.visitedNodes.add(nodeId);

    // Mark the node as visited in the map data (for isActComplete checks)
    node.visited = true;

    switch (node.type) {
      case 'table':
      case 'boss': {
        // Apply node's minBet (default 5 if not specified)
        this.game.minBet = node.minBet || 5;
        // Ensure player can afford the min bet
        this.game.money = Math.max(this.game.money, this.game.minBet);
        if (this.game.bet < this.game.minBet) {
          this.game.setBet(this.game.minBet);
        }
        // Apply trait-specific minBetAdd
        if (node.trait) {
          const traitDef = TABLE_TRAITS.find((t) => t.trait === node.trait);
          if (traitDef?.minBetAdd) {
            this.game.minBet += traitDef.minBetAdd;
            if (this.game.bet < this.game.minBet) {
              this.game.setBet(this.game.minBet);
            }
          }
        }
        // Purist vow: +1 free upgrade when entering a table/boss node
        if (this.vow && this.vow.effect === 'no_dice_effects') {
          const puristPool = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
          if (puristPool.length > 0) {
            const pick = puristPool[Math.floor(Math.random() * puristPool.length)];
            if (pick.maxCharges) {
              this.activeUpgrades.set(pick.id, pick.maxCharges);
            } else {
              this.activeUpgrades.set(pick.id, -1);
            }
            this.game.message = `Purist: free ${pick.name}!`;
          }
        }
        this.runState = 'TABLE_START_LOCK';
        return 'TABLE_START_LOCK';
      }

      case 'shop': {
        this.pendingShops = [node.npc];
        // Boss nodes get 2 shop NPCs after clearing — but for shop-type nodes, just 1
        return this.advanceShop(); // returns 'SHOPPING'
      }

      case 'mystery': {
        // Random event: 25% +$X, 25% -$Y, 25% free upgrade, 25% crack a die
        // Amounts scale by act: Act 1 ±$20, Act 2 ±$40, Act 3 ±$60
        const actScale = [4, 8, 12][this.currentActIndex] || 4;
        const graceAmount = Math.max(2, actScale - 2);
        const roll = Math.random();
        if (roll < 0.25) {
          this.game.money += actScale;
          this.game.message = `Mystery: found ₡${actScale}!`;
        } else if (roll < 0.5) {
          this.game.money = Math.max(0, this.game.money - graceAmount);
          this.game.message = `Mystery: lost ₡${graceAmount}...`;
        } else if (roll < 0.75 && this.activeUpgrades.size < UPGRADES.length) {
          // Apply a free random upgrade from the available pool
          const pool = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            if (pick.maxCharges) {
              this.activeUpgrades.set(pick.id, pick.maxCharges);
            } else {
              this.activeUpgrades.set(pick.id, -1);
            }
            this.game.message = `Mystery: free ${pick.name}!`;
          } else {
            this.game.message = 'Mystery: nothing happened...';
          }
        } else {
          // Crack a random die in hand
          const aliveSlots = this.diceHand.slots
            .map((s, i) => ({ slot: s, index: i }))
            .filter(({ slot }) => slot.durability > 0);
          if (aliveSlots.length > 0) {
            const target = aliveSlots[Math.floor(Math.random() * aliveSlots.length)];
            target.slot.durability = 0;
            this.game.message = 'Mystery: a die cracked!';
          } else {
            this.game.message = 'Mystery: nothing happened...';
          }
        }
        this.runState = 'MAP_NAV';
        return 'MAP_NAV';
      }

      case 'rest': {
        // Restore +1 durability to 2 random non-cracked dice, +$25
        const aliveIndices = [];
        this.diceHand.slots.forEach((slot, i) => {
          if (slot && slot.durability > 0 && slot.durability < 12) aliveIndices.push(i);
        });
        if (aliveIndices.length > 0) {
          // Shuffle and pick up to 2
          for (let i = aliveIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [aliveIndices[i], aliveIndices[j]] = [aliveIndices[j], aliveIndices[i]];
          }
          const count = Math.min(2, aliveIndices.length);
          for (let i = 0; i < count; i++) {
            this.diceHand.slots[aliveIndices[i]].durability = Math.min(
              12,
              this.diceHand.slots[aliveIndices[i]].durability + 1,
            );
          }
          this.game.message = `Rest: +1 dur to ${count} die(s) + ₡5 bonus`;
        } else {
          this.game.message = 'Rest: ₡5 bonus (all dice fresh/cracked)';
        }
        this.game.money += 5;
        this.runState = 'MAP_NAV';
        return 'MAP_NAV';
      }

      default:
        return null;
    }
  }

  /**
   * Start a roll — transitions state from BETTING to ROLLING.
   * Auto-picks locked dice before delegating to the Game instance.
   * @returns {boolean} true if roll was initiated
   */
  roll() {
    if (this.runState !== 'BETTING') return false;
    // Auto-pick locked dice before rolling
    this.diceHand.autoPickLocked();
    if (!this.game.roll()) return false;
    this.runState = 'ROLLING';
    return true;
  }

  /**
   * Lock 2 dice slots for the entire table duration.
   * Called from the TABLE_START_LOCK overlay on confirm.
   * @param {number[]} slotIndices — exactly 2 slot indices to lock
   * @returns {boolean} true if dice were locked successfully
   */
  lockTableDice(slotIndices) {
    if (this.runState !== 'TABLE_START_LOCK') return false;
    if (!slotIndices || slotIndices.length !== 2) return false;

    const success = this.diceHand.lockSlotsForTable(slotIndices);
    if (!success) return false;

    this.runState = 'BETTING';
    return true;
  }

  /**
   * All 4 hand slots with type metadata for the dice-pick UI.
   * @type {Array<{ index: number, typeId: string, durability: number, picked: boolean, type: object }>}
   */
  get diceHandSlots() {
    return this.diceHand.slots.map((s, i) => ({
      index: i,
      typeId: s.typeId,
      durability: s.durability,
      picked: s.picked,
      type: getDieType(s.typeId),
    }));
  }

  /**
   * The 2 currently picked die objects (used for physics launches).
   * @type {object[]}
   */
  get pickedDice() {
    return this.diceHand.pickedDice;
  }

  /**
   * Called after dice settle. Runs the full resolution pipeline:
   * dice effects → charms → dice mods → bet mods → talents → synergies → table progression.
   *
   * @param {number[]} values — [die1Value, die2Value] from physics
   * @returns {'win'|'loss'|'point'|'continue'|'push'} final result after all modifiers
   */
  resolve(values) {
    const sum = values[0] + values[1];
    const previousPhase = this.game.phase;
    const previousPoint = this.game.point;

    // Auto-pick locked dice (they persist across hands within a table)
    this.diceHand.autoPickLocked();

    // ─── HOT DICE: force auto-win on come-out ──────────
    if (this._hotDiceReady && previousPhase === 'COME_OUT') {
      // Override: treat as natural win
      this.game.rolling = false;
      this.game.lastRoll = values;
      this.game.lastSum = sum;
      this.game.money -= this.game.bet; // undo the bet deduction from roll()
      // Forced win
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.phase = 'COME_OUT';
      this.game.message = 'hot dice! auto-win!';
      this._hotDiceReady = false;
      // skip normal game.resolve entirely
      return this._postResolve('win', values, sum, previousPhase, previousPoint);
    }

    // Step 1: pure craps resolution
    const result = this.game.resolve(values);

    // ─── ANTI-SYNERGY DETECTION ───────────────────────
    // Compute early so flags are available during dice effects + upgrade hooks
    const _synergyState = getActiveSynergies(this.activeUpgrades);

    const _antiFlag = {
      doubleDownNerf: false, // double_down + loan_shark → -10% payout
      insuranceVolatile: false, // insurance + volatile die → refund -1
      noStreakOnLoss: false, // compound_streak + all_weather → streak frozen on loss
    };

    for (const anti of _synergyState.antiSynergies) {
      const [a, b] = anti.pair;
      if (
        (a === 'double_down' && b === 'loan_shark') ||
        (a === 'loan_shark' && b === 'double_down')
      )
        _antiFlag.doubleDownNerf = true;
      if (
        (a === 'compound_streak' && b === 'all_weather') ||
        (a === 'all_weather' && b === 'compound_streak')
      )
        _antiFlag.noStreakOnLoss = true;
    }

    // ========== DICE EFFECTS ============================
    const pickedDice = this.diceHand ? this.diceHand.pickedDice : [];
    let diceResult = result;
    let diceSum = sum;

    // Purist vow: all dice type effects are suppressed (treat dice as Standard)
    const isPurist = this.vow && this.vow.effect === 'no_dice_effects';

    // Dice-type anti-synergies — checked against picked dice (not in activeUpgrades)
    if (this.activeUpgrades.has('insurance') && pickedDice.some((d) => d.id === 'volatile'))
      _antiFlag.insuranceVolatile = true;

    // Reset per-hand tracker on new come-out roll
    if (previousPhase === 'COME_OUT') {
      this._synergyRerolls = 0;
      this._synergies = null;
    }

    // ---- CRACKED PENALTY (house_bones immune) ----
    for (const die of pickedDice) {
      if (isCracked(die) && die.id !== 'house_bones') {
        if (Math.random() < crackedEffect.loseChance) {
          this.game.money = Math.max(0, this.game.money - crackedEffect.loseAmount);
          this.game.message += ' (cracked -₡1)';
        }
      }
    }

    // ---- DICE TYPE EFFECTS ----
    for (const die of pickedDice) {
      // Cracked dice have no special effect (except House Bones immunity to penalty)
      if (isCracked(die)) continue;

      // Purist: skip all type-specific effects
      if (isPurist) continue;

      switch (die.id) {
        // SAFE
        case 'house_bones':
          // Passive: immune to cracked money penalty (handled in cracked check above)
          // No active effect needed here
          break;

        case 'witness':
          // Reveal predicted top face before settle
          this._witnessPrediction = values[0] + values[1];
          if (!this.game.message.includes('Witness')) {
            this.game.message = `Witness foresees ~${this._witnessPrediction}...`;
          }
          break;

        // CALCULATED RISK
        case 'glass':
          if (diceResult === 'win') {
            const glassBonus = Math.floor(this.game.bet * 0.5);
            this.game.money += glassBonus;
            this.game.message += ` (glass +₡${glassBonus})`;
          } else if (diceResult === 'loss') {
            // Shatters: set durability to 0
            const glassSlot = this.diceHand.slots.find((s) => s.typeId === 'glass' && s.picked);
            if (glassSlot) glassSlot.durability = 0;
            this.game.message += ' (glass shattered!)';
          }
          break;

        case 'volatile':
          if (diceResult === 'win') {
            const volBonus = Math.floor(this.game.bet * 0.5);
            this.game.money += volBonus;
            this.game.message += ` (volatile +₡${volBonus})`;
          } else if (diceResult === 'loss') {
            const volPenalty = Math.floor(this.game.bet * 0.25);
            this.game.money = Math.max(0, this.game.money - volPenalty);
            this.game.message += ` (volatile -₡${volPenalty})`;
          }
          break;

        case 'cursed_13':
          if (diceResult === 'win') {
            this.game.money = Math.max(0, this.game.money - 1);
            this.game.message += ' (cursed -₡1)';
          } else if (diceResult === 'loss') {
            this.game.money += 1;
            this.game.message += ' (cursed +₡1)';
          }
          break;

        case 'loaded_set':
          // Paired: handled by post-loop check below — no single-die effect
          break;

        // GAMBLING
        case 'snake_eyes':
          if (diceSum === 2) {
            // Auto-win on ANY phase (not just come-out)
            if (diceResult === 'loss') this.game.lossCount--;
            this.game.money += this.game.bet * 2;
            this.game.winCount++;
            this.game.phase = 'COME_OUT';
            this.game.point = null;
            diceResult = 'win';
            this.game.message = 'Snake Eyes! instant win!';
          }
          break;

        case 'doom':
          {
            const d20 = Math.floor(Math.random() * 20) + 1;
            if (d20 === 1) {
              // Bust: money = 0
              this.game.money = 0;
              diceResult = 'loss';
              this.game.message = 'DOOM: d20 = 1 — BUST!';
            } else if (d20 === 20) {
              // Instant table clear
              if (this.currentNode && this.currentNode.target) {
                this.game.money = this.currentNode.target;
              }
              this.game.message = 'DOOM: d20 = 20 — TABLE CLEAR!';
            } else if (d20 >= 2 && d20 <= 10) {
              diceSum = Math.max(2, diceSum - d20);
              diceResult = this._resolveDiceSum(diceSum, previousPhase, previousPoint, diceResult);
              this.game.message = `Doom d20: ${d20} — sum reduced to ${diceSum}`;
            } else {
              diceSum = Math.min(12, diceSum + (d20 - 10));
              diceResult = this._resolveDiceSum(diceSum, previousPhase, previousPoint, diceResult);
              this.game.message = `Doom d20: ${d20} — sum boosted to ${diceSum}`;
            }
          }
          break;

        // BUILD-AROUND
        case 'debt':
          // Accumulate debt each roll
          if (!this._debtCounter) this._debtCounter = 0;
          this._debtCounter += 1;
          this.game.money = Math.max(0, this.game.money - 1);
          this.game.message += ` (debt -₡1, owe ₡${this._debtCounter})`;
          break;

        case 'vengeance':
          // +1 per cracked die in hand
          {
            const crackedCount = this.diceHand.slots.filter((s) => s.durability <= 0).length;
            if (crackedCount > 0) {
              diceSum += crackedCount;
              diceResult = this._resolveDiceSum(diceSum, previousPhase, previousPoint, diceResult);
              this.game.message += ` (vengeance +${crackedCount})`;
            }
          }
          break;

        case 'pyre':
          {
            const pyreRoll = Math.random();
            if (pyreRoll < 0.05) {
              // 5% instant table clear
              if (this.currentNode && this.currentNode.target) {
                this.game.money = this.currentNode.target;
              }
              diceResult = 'win';
              this.game.message = 'PYRE: table cleared in flames!';
            } else {
              this.game.money = Math.max(0, this.game.money - 2);
              this.game.message += ' (pyre -₡2)';
            }
          }
          break;

        case 'split':
          // Treat each die value as a separate bet
          {
            const [d1, d2] = values;
            let splitPayout = 0;
            // Die 1: d1 is the "sum" for a 1-die roll
            if (d1 === 7 || d1 === 11) splitPayout += this.game.bet;
            else if (d1 === 2 || d1 === 3 || d1 === 12) splitPayout -= this.game.bet;
            // Die 2: same
            if (d2 === 7 || d2 === 11) splitPayout += this.game.bet;
            else if (d2 === 2 || d2 === 3 || d2 === 12) splitPayout -= this.game.bet;
            if (splitPayout !== 0) {
              this.game.money += splitPayout;
              this.game.message += ` (split ${splitPayout > 0 ? '+' : ''}₡${splitPayout})`;
            }
          }
          break;
      }
    }

    // ─── LOADED SET PAIR: both dice loaded_set → +2 sum (clamped to 6 per face) ──
    // Purist vow: no dice type effects, skip pair bonus
    if (pickedDice.length === 2 && !isPurist) {
      const bothLoadedSet = pickedDice.every((d) => d.id === 'loaded_set' && !isCracked(d));
      if (bothLoadedSet) {
        const v1 = Math.min(values[0] + 1, 6);
        const v2 = Math.min(values[1] + 1, 6);
        const newSum = v1 + v2;
        diceSum = newSum;
        diceResult = this._resolveDiceSum(newSum, previousPhase, previousPoint, diceResult);
        this.game.message += ' (loaded set: +2 skew)';
      }
    }

    // ─── UNLUCKY STREAK: 15% re-roll on losing next roll ──
    if (this._unluckyBonus && diceResult === 'loss') {
      if (Math.random() < 0.15) {
        const newSum = Math.floor(Math.random() * 11) + 2;
        diceSum = newSum;
        diceResult = this._resolveDiceSum(newSum, previousPhase, previousPoint, diceResult);
        this.game.message += ' (unlucky streak! re-roll)';
      }
    }
    // Clear flag after the roll that follows a loss (re-roll or not)
    if (this._unluckyBonus) {
      this._unluckyBonus = false;
    }

    // Consume durability for each picked die after effects
    for (let i = 0; i < pickedDice.length; i++) {
      this.diceHand.consumeDurability(i);
    }

    // Step 2: apply upgrade effects
    let finalResult = diceResult;
    const has = (id) => this.activeUpgrades.has(id);
    const hasCharges = (id) => {
      const c = this.activeUpgrades.get(id);
      return c !== undefined && c !== 0;
    };
    const consume = (id) => {
      const c = this.activeUpgrades.get(id);
      if (c === 1) this.activeUpgrades.delete(id);
      else if (c > 1) this.activeUpgrades.set(id, c - 1);
    };

    // ========== CHARM HOOKS =============================

    // Lucky Rabbit Foot: turn a loss into a refund (once)
    if (result === 'loss' && hasCharges('rabbit_foot')) {
      this.game.money += this.game.bet;
      this.game.message = 'rabbit foot saves you \u2014 refund!';
      this.game.lossCount--;
      consume('rabbit_foot');
      finalResult = 'push';
    }

    // Four-Leaf Clover: turn a loss into a win (once)
    if (result === 'loss' && hasCharges('four_leaf_clover')) {
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.lossCount--;
      this.game.message = 'four-leaf clover! win!';
      consume('four_leaf_clover');
      finalResult = 'win';
    }

    // Cut the Deck: on seven-out, refund and continue (once)
    if (result === 'loss' && sum === 7 && previousPhase === 'POINT' && hasCharges('cut_the_deck')) {
      this.game.money += this.game.bet;
      this.game.phase = 'POINT';
      this.game.point = previousPoint;
      this.game.message = 'cut the deck! reroll!';
      this.game.lossCount--;
      consume('cut_the_deck');
      finalResult = 'continue';
    }

    // Lucky Coin: double money on win (once)
    if (finalResult === 'win' && hasCharges('lucky_coin')) {
      const doubled = this.game.money;
      this.game.money += doubled;
      this.game.message += ` (lucky coin! +₡${doubled})`;
      consume('lucky_coin');
    }

    // Unlucky Streak: on loss, consume charge and flag next roll for +15% re-roll
    if (result === 'loss' && hasCharges('unlucky_streak')) {
      consume('unlucky_streak');
      this._unluckyBonus = true;
      this.game.message += ' (unlucky streak — next roll boosted)';
    }

    // ========== DICE MOD HOOKS ==========================

    // Loaded Dice: on come-out, 6 or 10 win
    if (
      result !== 'win' &&
      previousPhase === 'COME_OUT' &&
      has('loaded_dice') &&
      (sum === 6 || sum === 10)
    ) {
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.lossCount--;
      this.game.message = `loaded dice! ${sum} wins!`;
      finalResult = 'win';
    }

    // Snake Charmer: 2 and 12 win on come-out
    if (
      result === 'loss' &&
      previousPhase === 'COME_OUT' &&
      (sum === 2 || sum === 12) &&
      has('snake_charmer')
    ) {
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.lossCount--;
      this.game.message = `snake charmer! ${sum} wins!`;
      finalResult = 'win';
    }

    // Bouncy Dice: 25% to save on seven-out
    if (
      result === 'loss' &&
      sum === 7 &&
      previousPhase === 'POINT' &&
      has('bouncy_dice') &&
      Math.random() < 0.25
    ) {
      this.game.money += this.game.bet;
      this.game.phase = 'POINT';
      this.game.point = previousPoint;
      this.game.message = 'bouncy dice! saved!';
      this.game.lossCount--;
      finalResult = 'continue';
    }

    // All-Weather Dice: during point, 7 is safe (continue)
    if (result === 'loss' && sum === 7 && previousPhase === 'POINT' && has('all_weather')) {
      this.game.money += this.game.bet;
      this.game.phase = 'POINT';
      this.game.point = previousPoint;
      this.game.message = 'all-weather! 7 is safe!';
      this.game.lossCount--;
      finalResult = 'continue';
    }

    // Loaded Sevens: come-out 7 pays 3x
    if (
      finalResult === 'win' &&
      sum === 7 &&
      previousPhase === 'COME_OUT' &&
      has('loaded_sevens')
    ) {
      this.game.money += this.game.bet;
      if (this.game.message.includes('natural')) {
        this.game.message += ' (loaded 7s!)';
      } else {
        this.game.message = 'loaded 7s!';
      }
    }

    // Lucky 7s: rolling 7 on come-out pays +$2
    if (finalResult === 'win' && sum === 7 && previousPhase === 'COME_OUT' && has('lucky_7s')) {
      this.game.money += 1;
    }

    // Magnetic Point: point wins pay +50%
    if (finalResult === 'win' && previousPhase === 'POINT' && has('magnetic_point')) {
      const bonus = Math.floor(this.game.bet * 0.5);
      this.game.money += bonus;
      this.game.message += ` (magnetic: +₡${bonus})`;
    }

    // Hot Dice: set ready flag when point is made
    if (finalResult === 'win' && previousPhase === 'POINT' && has('hot_dice')) {
      this._hotDiceReady = true;
    }
    // Hot Dice resets on seven-out
    if (result === 'loss' && sum === 7 && previousPhase === 'POINT') {
      this._hotDiceReady = false;
    }

    // Rigged Roll: on losing 7, re-roll one die (1 charge)
    if (finalResult === 'loss' && sum === 7 && hasCharges('rigged_roll')) {
      const keepIdx = Math.floor(Math.random() * 2);
      const newDie = Math.floor(Math.random() * 6) + 1;
      const newSum = keepIdx === 0 ? values[1] + newDie : values[0] + newDie;
      finalResult = this._resolveDiceSum(newSum, previousPhase, previousPoint, diceResult);
      diceSum = newSum;
      consume('rigged_roll');
      this.game.message += ' (rigged roll!)';
    }

    // Face-Off: doubles (both dice same face) pay +$10 bonus
    if (finalResult === 'win' && values[0] === values[1] && has('face_off')) {
      this.game.money += 2;
      this.game.message += ' (face-off +₡2)';
    }

    // ========== BET MOD HOOKS ===========================

    // Double Down: all wins pay 3x instead of 2x
    if (finalResult === 'win' && has('double_down')) {
      const extra = _antiFlag.doubleDownNerf ? Math.floor(this.game.bet * 0.9) : this.game.bet;
      this.game.money += extra;
    }

    // Pocket Change: each win pays +$2 extra
    if (finalResult === 'win' && has('pocket_change')) {
      this.game.money += 1;
    }

    // Lucky 11: natural 11 on come-out pays +$3
    if (finalResult === 'win' && sum === 11 && previousPhase === 'COME_OUT' && has('lucky_11')) {
      this.game.money += 1;
    }

    // Cascade: on point win, get bet back
    if (finalResult === 'win' && previousPhase === 'POINT' && has('cascade')) {
      this.game.money += this.game.bet;
      this.game.message += ' (cascade!)';
    }

    // Fire Bet: each different point made adds 0.5x to point win
    if (finalResult === 'win' && previousPhase === 'POINT' && has('fire_bet')) {
      this._firePoints.add(previousPoint);
      const mult = this._firePoints.size * 0.5;
      const bonus = Math.floor(this.game.bet * mult);
      this.game.money += bonus;
      this.game.message += ` (fire x${this._firePoints.size})`;
    }

    // Insurance: refund half on come-out loss
    if (
      result === 'loss' &&
      previousPhase === 'COME_OUT' &&
      has('insurance') &&
      sum !== 2 &&
      sum !== 12
    ) {
      let refund = Math.floor(this.game.bet / 2);
      if (_antiFlag.insuranceVolatile) refund = Math.max(0, refund - 1);
      this.game.money += refund;
      this.game.message += ` (insurance: -₡${refund})`;
    }
    if (
      result === 'loss' &&
      previousPhase === 'COME_OUT' &&
      has('insurance') &&
      (sum === 2 || sum === 12) &&
      !has('snake_charmer')
    ) {
      let refund = Math.floor(this.game.bet / 2);
      if (_antiFlag.insuranceVolatile) refund = Math.max(0, refund - 1);
      this.game.money += refund;
      this.game.message += ` (insurance: -₡${refund})`;
    }

    // Sucker Bet: 15% chance loss → push
    if (result === 'loss' && has('sucker_bet') && Math.random() < 0.15) {
      this.game.money += this.game.bet;
      this.game.lossCount--;
      this.game.message += ' (sucker!)';
      finalResult = 'push';
    }

    // Compound Streak: consecutive wins multiply
    if (has('compound_streak')) {
      if (finalResult === 'win') {
        this.streak++;
        const mult = Math.min(this.streak, 5) * 0.5 + 0.5;
        if (mult > 1) {
          const extra = Math.floor(this.game.bet * (mult - 1));
          this.game.money += extra;
          this.game.message += ` (x${mult} streak!)`;
        }
      } else if (!_antiFlag.noStreakOnLoss) {
        this.streak = 0;
      }
    } else {
      this.streak = 0;
    }

    // Side Pot: 15% of each win banked
    if (finalResult === 'win' && has('side_pot')) {
      const deposit = Math.floor(this.game.bet * 0.15);
      this.sidePot += deposit;
    }

    // Parlay: double net change — win adds extra bet, loss subtracts extra bet
    if (has('parlay')) {
      if (finalResult === 'win') {
        this.game.money += this.game.bet;
        this.game.message += ' (parlay doubled!)';
      } else if (finalResult === 'loss') {
        this.game.money = Math.max(this.game.money - this.game.bet, this.bustThreshold);
        this.game.message += ` (parlay -₡${this.game.bet})`;
      }
    }

    // ========== TALENT HOOKS ============================

    // Bookie: $1 per roll
    if (has('bookie')) {
      this.game.money += 1;
    }

    // Sharp: on any loss, get $1 back
    if (result === 'loss' && has('sharp')) {
      this.game.money += 1;
    }

    // Iron Bank: every 3 hands, +$5
    if (has('iron_bank')) {
      this._ironBankCounter++;
      if (this._ironBankCounter % 3 === 0) {
        this.game.money += 1;
        this.game.message += ' (iron bank +₡1)';
      }
    }

    // ========== SYNERGY RESOLUTION ======================
    // Recompute synergy state — charm consumption may have changed category counts
    const _finalSynergy = getActiveSynergies(this.activeUpgrades);
    this._synergies = _finalSynergy;

    // dice 2-set: +1 free re-roll per hand
    if (_finalSynergy.synergies.some((s) => s.category === 'dice' && s.tier === 'set2')) {
      this._synergyRerolls++;
    }

    // dice 3-set: auto-reroll on 2/3/12
    if (_finalSynergy.synergies.some((s) => s.category === 'dice' && s.tier === 'set3')) {
      if (diceSum === 2 || diceSum === 3 || diceSum === 12) {
        let newSum;
        do {
          newSum = Math.floor(Math.random() * 11) + 2;
        } while (newSum > 12 || newSum < 2);
        finalResult = this._resolveDiceSum(newSum, previousPhase, previousPoint, diceResult);
        diceSum = newSum;
        this.game.message += ` (synergy: dice re-roll \u2192 ${newSum})`;
      }
    }

    // bet 2-set: +15% payout on wins
    if (
      finalResult === 'win' &&
      _finalSynergy.synergies.some((s) => s.category === 'bet' && s.tier === 'set2')
    ) {
      const bonus = Math.floor(this.game.bet * 0.15);
      this.game.money += bonus;
      this.game.message += ` (synergy: +₡${bonus})`;
    }

    // bet 3-set: 1% interest per hand
    if (_finalSynergy.synergies.some((s) => s.category === 'bet' && s.tier === 'set3')) {
      const interest = Math.floor(this.game.money * 0.01);
      if (interest > 0) {
        this.game.money += interest;
        this.game.message += ` (synergy: interest +₡${interest})`;
      }
    }

    // charm 2-set: +1 charge to all active charms
    if (_finalSynergy.synergies.some((s) => s.category === 'charm' && s.tier === 'set2')) {
      for (const [id, charge] of this.activeUpgrades) {
        const def = UPGRADES.find((u) => u.id === id);
        if (def && def.category === 'charm') {
          this.activeUpgrades.set(id, Math.min(charge + 1, def.maxCharges));
        }
      }
    }

    // charm 3-set: charms don't consume on 7/11 natural
    if (_finalSynergy.synergies.some((s) => s.category === 'charm' && s.tier === 'set3')) {
      if ((diceSum === 7 || diceSum === 11) && previousPhase === 'COME_OUT') {
        for (const [id, charge] of this.activeUpgrades) {
          const def = UPGRADES.find((u) => u.id === id);
          if (def && def.category === 'charm') {
            this.activeUpgrades.set(id, Math.min(charge + 1, def.maxCharges));
          }
        }
      }
    }

    // talent 2-set: +$2 passive income per roll
    if (_finalSynergy.synergies.some((s) => s.category === 'talent' && s.tier === 'set2')) {
      this.game.money += 1;
    }

    // talent 3-set: double all passive income
    if (_finalSynergy.synergies.some((s) => s.category === 'talent' && s.tier === 'set3')) {
      // Bookie already gave $1 — add another $1
      if (has('bookie')) {
        this.game.money += 1;
      }
      // Iron Bank: if triggered this hand, add another $5
      if (has('iron_bank') && this._ironBankCounter > 0 && this._ironBankCounter % 3 === 0) {
        this.game.money += 1;
      }
      // talent 2-set synergy: already added $2, double it → add another $2
      if (_finalSynergy.synergies.some((s) => s.category === 'talent' && s.tier === 'set2')) {
        this.game.money += 1;
      }
    }

    // Legendary bonus: 5% chance per hand of instant win
    if (_finalSynergy.legendary && Math.random() < 0.05) {
      this.game.money += this.game.bet * 2;
      this.game.message = 'LEGENDARY! instant win!';
      finalResult = 'win';
    }

    return this._postResolve(finalResult, values, diceSum, previousPhase, previousPoint);
  }

  /**
   * Undo the current craps result and apply a new sum.
   * Only modifies money/counts — phase/point are recomputed.
   *
   * @param {number} newSum — the replacement dice sum (2–12)
   * @param {'COME_OUT'|'POINT'} previousPhase — phase before re-resolution
   * @param {number|null} previousPoint — active point value, or null
   * @param {'win'|'loss'|'point'|'continue'|'push'} oldResult — result being undone
   * @returns {'win'|'loss'|'point'|'continue'|'push'} the new result
   */
  _resolveDiceSum(newSum, previousPhase, previousPoint, oldResult) {
    // Undo old result's money and stat changes
    if (oldResult === 'win') {
      this.game.money -= this.game.bet * 2;
      this.game.winCount--;
    } else if (oldResult === 'loss') {
      this.game.lossCount--;
    }
    // 'point' and 'continue': no money/stat changes to undo

    // Apply new sum resolution
    let newResult;
    if (previousPhase === 'COME_OUT') {
      if (newSum === 7 || newSum === 11) {
        this.game.money += this.game.bet * 2;
        this.game.winCount++;
        this.game.phase = 'COME_OUT';
        this.game.point = null;
        newResult = 'win';
      } else if (newSum === 2 || newSum === 3 || newSum === 12) {
        this.game.lossCount++;
        this.game.phase = 'COME_OUT';
        this.game.point = null;
        newResult = 'loss';
      } else {
        this.game.point = newSum;
        this.game.phase = 'POINT';
        newResult = 'point';
      }
    } else {
      // POINT
      if (newSum === 7) {
        this.game.lossCount++;
        this.game.phase = 'COME_OUT';
        this.game.point = null;
        newResult = 'loss';
      } else if (newSum === previousPoint) {
        this.game.money += this.game.bet * 2;
        this.game.winCount++;
        this.game.phase = 'COME_OUT';
        this.game.point = null;
        newResult = 'win';
      } else {
        newResult = 'continue';
      }
    }

    this.game.lastSum = newSum;
    return newResult;
  }

  /**
   * Shared post-resolution bookkeeping: passive income, hand counting,
   * node progression (map-based), and state transitions.
   *
   * @param {'win'|'loss'|'point'|'continue'|'push'} finalResult — result after all modifiers
   * @param {number[]} values — [die1Value, die2Value] from physics
   * @param {number} sum — final dice sum after all dice effects
   * @param {'COME_OUT'|'POINT'} previousPhase — phase before resolution
   * @param {number|null} previousPoint — active point value before resolution
   * @returns {'win'|'loss'|'point'|'continue'|'push'} the final result
   */
  _postResolve(finalResult, values, sum, previousPhase, previousPoint) {
    // ─── PER-HAND PASSIVE ─────────────────────────────
    if (this.interestPerHand > 0) {
      this.game.money += this.interestPerHand;
    }

    // ─── BOOKKEEPING ──────────────────────────────────
    this.handCount++;
    this._tableHandCount++; // per-table hand tracker (used by speed_run vow)
    this._lastResult = finalResult;
    this._lastSum = sum;
    this._lastPreviousPoint = previousPoint;

    // ========== NODE TRAITS (DIFFICULTY MODIFIERS) =========
    const nodeTraitName = this.currentNode?.trait;
    const tableTrait = nodeTraitName
      ? TABLE_TRAITS.find((t) => t.trait === nodeTraitName) || {}
      : {};

    // Crooked: chance to fudge a win into a loss (upgrade bonuses kept — thematically stolen)
    if (
      finalResult === 'win' &&
      tableTrait.crookedChance &&
      Math.random() < tableTrait.crookedChance
    ) {
      // Undo base win payout
      this.game.money -= this.game.bet * 2;
      this.game.winCount--;
      this.game.lossCount++;
      this.game.phase = 'COME_OUT';
      this.game.point = null;
      this.game.message = 'crooked! your win was stolen...';
      finalResult = 'loss';
    }

    // Boss table: chance to steal a random upgrade on loss
    if (
      finalResult === 'loss' &&
      tableTrait.stealChance &&
      Math.random() < tableTrait.stealChance
    ) {
      const activeIds = Array.from(this.activeUpgrades.keys());
      if (activeIds.length > 0) {
        const stolenId = activeIds[Math.floor(Math.random() * activeIds.length)];
        this.activeUpgrades.delete(stolenId);
        const def = UPGRADES.find((u) => u.id === stolenId);
        this.game.message += ` (${def ? def.name : 'upgrade'} stolen!)`;
      }
    }

    // ========== MAP NODE PROGRESSION ===================

    // Speed Run vow: hand limit per node (5 max)
    if (this.vow && this.vow.effect === 'hand_limit' && this._tableHandCount > this.vow.limit) {
      // Only bust if not already in a terminal state
      if (this.runState !== 'BUST' && this.runState !== 'RUN_WON' && this.runState !== 'MAP_NAV') {
        this.pendingShops = [];
        this.currentShopNpc = null;
        this.runState = 'BUST';
        this.game.message = 'Speed Run: hand limit reached!';
        return finalResult;
      }
    }

    if (this.isBust) {
      this.bonusPot = 0;
      // Escape Plan: survive with $5
      const escapeCharges = this.activeUpgrades.get('escape_plan');
      if (escapeCharges !== undefined && escapeCharges !== 0) {
        const c = escapeCharges;
        if (c === 1) this.activeUpgrades.delete('escape_plan');
        else if (c > 1) this.activeUpgrades.set('escape_plan', c - 1);
        this.game.money = 1;
        this.runState = 'BETTING';
        this.game.message = 'escape plan! survived with ₡1';
      } else {
        this.pendingShops = [];
        this.currentShopNpc = null;
        this.runState = 'BUST';
      }
    } else if (
      this.currentNode &&
      (this.currentNode.type === 'table' || this.currentNode.type === 'boss') &&
      this.game.money >= this.currentNode.target &&
      this.game.phase === 'COME_OUT' &&
      this.handCount > 0
    ) {
      // Node cleared!
      // Reset per-node hand counter (speed_run tracking)
      this._tableHandCount = 0;
      // Pay off Debt dice
      if (this._debtCounter > 0) {
        const debtPayoff = 5;
        this.game.money += debtPayoff;
        this.game.message += ` (debt paid +₡${debtPayoff})`;
        this._debtCounter = 0;
      }
      // Purist vow: +1 free upgrade per node clear
      if (this.vow && this.vow.effect === 'no_dice_effects') {
        const puristPool = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
        if (puristPool.length > 0) {
          const pick = puristPool[Math.floor(Math.random() * puristPool.length)];
          if (pick.maxCharges) {
            this.activeUpgrades.set(pick.id, pick.maxCharges);
          } else {
            this.activeUpgrades.set(pick.id, -1);
          }
          this.game.message += ` (purist: free ${pick.name}!)`;
        }
      }
      // Hustler's Cut: +5% of node target on clear
      if (this.activeUpgrades.has('hustlers_cut')) {
        const cut = Math.floor(this.currentNode.target * 0.05);
        this.game.money += cut;
        this.game.message += ` (hustler's cut +₡${cut})`;
      }
      this.pendingShops = [];

      if (this.currentNode.type === 'boss') {
        const actComplete = isActComplete(MAP_ACTS, this.currentActIndex);
        if (this.currentActIndex >= MAP_ACTS.length - 1 && actComplete) {
          // Final boss cleared → run won!
          if (this.activeUpgrades.has('side_pot') && this.sidePot > 0) {
            this.bonusPot = this.sidePot * 2;
            this.game.money += this.bonusPot;
          }
          this.currentShopNpc = null;
          this.diceHand.lockedSlots.clear();
          this.runState = 'RUN_WON';
        } else {
          // Advance to next floor/act after boss
          const next = getNextFloors(MAP_ACTS, this.currentActIndex, this.currentFloorIndex);
          if (next) {
            this.currentActIndex = next.actIndex;
            this.currentFloorIndex = next.floorIndex;
          }
          // Award 2 upgrade picks on boss clear
          const clearPool = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
          if (clearPool.length > 0) {
            this._pendingTableClearPicks = 2;
            this.runState = 'PICKING';
            this._pickShown = false;
            this.game.message = 'Boss cleared! Pick 2 upgrades!';
            return finalResult;
          }
          this._mapNavBlockedUntil = Date.now() + RESULT_CARD_DELAY + RESULT_CARD_DISPLAY + 200;
          this.diceHand.lockedSlots.clear();
          this.runState = 'MAP_NAV';
        }
      } else {
        // Award 1 upgrade pick on table clear
        const clearPool = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
        if (clearPool.length > 0) {
          this._pendingTableClearPicks = 1;
          this.runState = 'PICKING';
          this._pickShown = false;
          this.game.message = 'Table cleared! Pick 1 upgrade!';
          return finalResult;
        }
        this._mapNavBlockedUntil = Date.now() + RESULT_CARD_DELAY + RESULT_CARD_DISPLAY + 200;
        this.diceHand.lockedSlots.clear();
        this.runState = 'MAP_NAV';
      }
    } else if (this.game.phase === 'COME_OUT' && finalResult === 'win' && this.handCount > 0) {
      this.game.message = 'nice win! keep rolling...';
      this.runState = 'BETTING';
    } else if (finalResult === 'point' && this.handCount > 0) {
      this.game.message = 'point established — roll to hit it';
      this.runState = 'BETTING';
    } else if (
      this.game.phase === 'COME_OUT' &&
      (finalResult === 'loss' || finalResult === 'push') &&
      this.handCount > 0
    ) {
      this.runState = 'BETTING';
    } else {
      this.runState = 'BETTING';
    }

    return finalResult;
  }

  /**
   * Return N random picks from the remaining upgrade pool, weighted to favor
   * categories the player has 0–1 upgrades in (helps diversify builds).
   * Categories with 2+ upgrades get reduced weight but are not excluded.
   * Extra picks from meta-perks increase the number of cards shown.
   *
   * @param {number} [count=3] — base number of upgrade cards to show
   * @returns {Array<import('./upgrades.js').Upgrade>} weighted, shuffled selection of available upgrades
   */
  getPickOptions(count = 3) {
    const pickCount = count + (this.extraPick || 0);
    const excluded = new Set(this.activeUpgrades.keys());
    const available = getAvailableUpgrades(excluded);

    if (available.length === 0) return [];

    // Count active upgrades per category for weighting
    const categoryCounts = { dice: 0, bet: 0, charm: 0, talent: 0 };
    for (const [id] of this.activeUpgrades) {
      const def = UPGRADES.find((u) => u.id === id);
      if (def && Object.prototype.hasOwnProperty.call(categoryCounts, def.category)) {
        categoryCounts[def.category]++;
      }
    }

    // Build weighted pool — categories with 0–1 upgrades get 3x representation
    const weightedPool = [];
    for (const upgrade of available) {
      const catCount = categoryCounts[upgrade.category] || 0;
      if (catCount <= 1) {
        weightedPool.push(upgrade, upgrade, upgrade);
      } else {
        weightedPool.push(upgrade);
      }
    }

    // Shuffle weighted pool and deduplicate into final picks
    const shuffled = shuffle(weightedPool);
    const seen = new Set();
    const picks = [];
    for (const upg of shuffled) {
      if (!seen.has(upg.id)) {
        seen.add(upg.id);
        picks.push(upg);
        if (picks.length >= pickCount) break;
      }
    }

    return picks;
  }

  /**
   * Apply a chosen upgrade and transition back to betting.
   * Handles first-free perk, charge tracking, and loan_shark bust guard.
   *
   * @param {string} id — the upgrade's unique identifier
   */
  applyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;

    if (upgrade.maxCharges) {
      this.activeUpgrades.set(id, upgrade.maxCharges);
    } else {
      this.activeUpgrades.set(id, -1); // permanent
    }

    // First Free perk: first upgrade each run costs nothing
    if (this.firstFree > this._perksUsedFree) {
      this._perksUsedFree++;
      this.game.message = `${upgrade.name} acquired (free!)`;
    } else {
      this.game.message = `${upgrade.name} acquired`;
    }

    // Collector: +$10 whenever you add an upgrade (not self-triggering)
    if (id !== 'collector' && this.activeUpgrades.has('collector')) {
      this.game.money += 2;
      this.game.message += ` (collector +₡2)`;
    }

    // Handle table-clear pick queue
    if (this._pendingTableClearPicks > 0) {
      this._pendingTableClearPicks--;
      if (this._pendingTableClearPicks <= 0) {
        // All table clear picks done — continue to map
        this.diceHand.lockedSlots.clear();
        this._mapNavBlockedUntil = Date.now() + RESULT_CARD_DELAY + RESULT_CARD_DISPLAY + 200;
        this.runState = 'MAP_NAV';
        return;
      }
      // More picks remaining — refresh PICKING overlay
      this._pickShown = false;
      this.runState = 'PICKING';
      return;
    }

    this.runState = 'BETTING';

    // If loan_shark applied at exactly 0 money, prevent immediate bust
    if (id === 'loan_shark' && this.game.money <= 0) {
      this.runState = 'BETTING';
    }
  }

  /**
   * Skip the pick overlay — return to betting without selecting an upgrade.
   */
  skipPick() {
    this.runState = 'BETTING';
  }

  /**
   * Use a reroll token to get fresh pick options.
   *
   * @returns {boolean} true if a token was consumed and new picks should be shown
   */
  useReroll() {
    if (this.rerollTokens <= 0) return false;
    this.rerollTokens--;
    this._pickShown = false;
    return true;
  }

  /**
   * Advance to the next queued shop or return to betting.
   * Called after a shop visit ends to either show the next shop or resume play.
   *
   * Iron Man vow: shops are locked — skips all pending shops and returns to BETTING.
   *
   * @returns {string|null} npcId of the next shop NPC, or null if no more shops
   */
  advanceShop() {
    // Iron Man vow: shops are completely locked
    if (this.vow && this.vow.effect === 'no_shops') {
      this.pendingShops = [];
      this.currentShopNpc = null;
      this.runState = 'MAP_NAV';
      this.game.message = 'Iron Man: shops are locked';
      return null;
    }
    if (this.pendingShops.length > 0) {
      this.currentShopNpc = this.pendingShops.shift();
      this.runState = 'SHOPPING';
      return this.currentShopNpc;
    }
    this.currentShopNpc = null;
    this.runState = 'MAP_NAV';
    return null;
  }

  /**
   * Get list of active upgrades with metadata including charges and synergy info.
   * The returned array has a `.synergies` and `.legendary` property attached.
   *
   * @returns {Array<import('./upgrades.js').Upgrade & { charges: number }>}
   */
  getActiveUpgradeList() {
    const list = Array.from(this.activeUpgrades.entries()).map(([id, charges]) => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return { id, name: id, desc: '', category: '?', rarity: 'common', charges: 0 };
      return { ...def, charges };
    });

    // Attach active synergy info
    const synState = this._synergies || getActiveSynergies(this.activeUpgrades);
    list.synergies = synState.synergies.map((s) => `${s.category} ${s.tier}`);
    list.legendary = !!synState.legendary;

    return list;
  }

  /**
   * Human-friendly summary of the last run for end-of-run display and XP calculation.
   *
   * @returns {{ handsPlayed: number, winCount: number, lossCount: number,
   *   finalMoney: number, sidePot: number, bonusPot: number,
   *   nodesVisited: number, actIndex: number, floorIndex: number,
   *   tablesCleared: number, upgrades: string[], synergies: string[],
   *   legendary: boolean, diceHand: object[] }}
   */
  getRunSummary() {
    const synState = this._synergies || getActiveSynergies(this.activeUpgrades);
    // Count visited table/boss nodes for backward-compat XP calc
    const visitedTableNodes = [...this.visitedNodes].filter((id) => {
      const node = getNode(MAP_ACTS, id);
      return node && (node.type === 'table' || node.type === 'boss');
    }).length;
    return {
      handsPlayed: this.handCount,
      winCount: this.game.winCount,
      lossCount: this.game.lossCount,
      finalMoney: Math.max(this.game.money, 0),
      sidePot: this.sidePot,
      bonusPot: this.bonusPot,
      nodesVisited: this.visitedNodes.size,
      actIndex: this.currentActIndex,
      floorIndex: this.currentFloorIndex,
      tablesCleared: visitedTableNodes,
      upgrades: this.getActiveUpgradeList().map((u) => u.name),
      synergies: synState.synergies.map((s) => `${s.category} ${s.tier}`),
      legendary: !!synState.legendary,
      diceHand: this.diceHandSlots,
    };
  }
}
