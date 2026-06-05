import { Game } from './game.js';
import { UPGRADES, RUN_WIN_TARGET, getAvailableUpgrades, getTable, getTotalTables } from './upgrades.js';

/**
 * RogueRun wraps a Game instance with roguelite progression.
 *
 * States:
 *   BETTING    — player can set bet and roll
 *   ROLLING    — dice physics in progress
 *   PICKING    — choose-1-of-3 overlay shown
 *   TABLE_CLEAR — just cleared a table (brief celebration)
 *   BUST       — run lost (money <= threshold)
 *   RUN_WON    — run won (money >= target on final table)
 */
export class RogueRun {
  constructor(metaProgress = null) {
    this.meta = metaProgress;
    this.game = new Game();
    this.resetRun();
  }

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
    this.tableIndex = 0;
    this.tablesCleared = 0;
    this.runState = 'BETTING';
    this._lastResult = null;
    this._lastSum = null;
    this._lastPreviousPoint = null;
    this._pickShown = false;
    this._handEarnings = 0;
    this._hotDiceReady = false;
    this._firePoints = new Set();
    this._ironBankCounter = 0;
    this._perksUsedFree = 0;

    // Reroll tokens from meta
    this.rerollTokens = bonuses.rerollTokens || 0;
    this.extraPick = bonuses.extraPick || 0;
    this.firstFree = bonuses.firstFree || 0;
    this.interestPerHand = bonuses.interestPerHand || 0;

    // Apply starting-money upgrades
    if (this.activeUpgrades.has('high_roller')) {
      this.game.money += 25;
    }

    // Apply per-table min bet
    this.game.minBet = this.getCurrentTable().minBet;
    if (this.game.bet < this.game.minBet) {
      this.game.setBet(this.game.minBet);
    }
  }

  getCurrentTable() {
    return getTable(this.tableIndex);
  }

  getCurrentTarget() {
    return this.getCurrentTable().target;
  }

  get isBossTable() {
    return this.getCurrentTable().boss;
  }

  get canRoll() {
    return this.runState === 'BETTING' && this.game.canRoll && !this.game.bankrupt;
  }

  get bustThreshold() {
    if (this.activeUpgrades.has('loan_shark')) return -50;
    return 0;
  }

  get isBust() {
    return this.game.money <= this.bustThreshold && this.game.phase === 'COME_OUT' && this.handCount > 0;
  }

  get isRunWon() {
    return this.game.money >= this.getCurrentTarget() && this.game.phase === 'COME_OUT' && this.handCount > 0;
  }

  roll() {
    if (this.runState !== 'BETTING') return false;
    if (!this.game.roll()) return false;
    this.runState = 'ROLLING';
    return true;
  }

  /**
   * Called after dice settle. Returns the modified result string.
   * Result: 'win' | 'loss' | 'point' | 'continue' | 'push'
   */
  resolve(values) {
    const sum = values[0] + values[1];
    const previousPhase = this.game.phase;
    const previousPoint = this.game.point;

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

    // Step 2: apply upgrade effects
    let finalResult = result;
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

    // ─── CHARMS ────────────────────────────────────────

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
      this.game.message += ` (lucky coin! +$${doubled})`;
      consume('lucky_coin');
    }

    // ─── DICE MODIFIERS ────────────────────────────────

    // Loaded Dice: on come-out, 6 or 10 win
    if (result !== 'win' && previousPhase === 'COME_OUT' && has('loaded_dice') && (sum === 6 || sum === 10)) {
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.lossCount--;
      this.game.message = `loaded dice! ${sum} wins!`;
      finalResult = 'win';
    }

    // Snake Charmer: 2 and 12 win on come-out
    if (result === 'loss' && previousPhase === 'COME_OUT' && (sum === 2 || sum === 12) && has('snake_charmer')) {
      this.game.money += this.game.bet * 2;
      this.game.winCount++;
      this.game.lossCount--;
      this.game.message = `snake charmer! ${sum} wins!`;
      finalResult = 'win';
    }

    // Bouncy Dice: 25% to save on seven-out
    if (result === 'loss' && sum === 7 && previousPhase === 'POINT' && has('bouncy_dice') && Math.random() < 0.25) {
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
    if (finalResult === 'win' && sum === 7 && previousPhase === 'COME_OUT' && has('loaded_sevens')) {
      this.game.money += this.game.bet;
      if (this.game.message.includes('natural')) {
        this.game.message += ' (loaded 7s!)';
      } else {
        this.game.message = 'loaded 7s!';
      }
    }

    // Lucky 7s: rolling 7 on come-out pays +$2
    if (finalResult === 'win' && sum === 7 && previousPhase === 'COME_OUT' && has('lucky_7s')) {
      this.game.money += 2;
    }

    // Magnetic Point: point wins pay +50%
    if (finalResult === 'win' && previousPhase === 'POINT' && has('magnetic_point')) {
      const bonus = Math.floor(this.game.bet * 0.5);
      this.game.money += bonus;
      this.game.message += ` (magnetic: +$${bonus})`;
    }

    // Hot Dice: set ready flag when point is made
    if (finalResult === 'win' && previousPhase === 'POINT' && has('hot_dice')) {
      this._hotDiceReady = true;
    }
    // Hot Dice resets on seven-out
    if (result === 'loss' && sum === 7 && previousPhase === 'POINT') {
      this._hotDiceReady = false;
    }

    // ─── BET MODIFIERS ─────────────────────────────────

    // Double Down: all wins pay 3x instead of 2x
    if (finalResult === 'win' && has('double_down')) {
      this.game.money += this.game.bet;
    }

    // Pocket Change: each win pays +$2 extra
    if (finalResult === 'win' && has('pocket_change')) {
      this.game.money += 2;
    }

    // Lucky 11: natural 11 on come-out pays +$3
    if (finalResult === 'win' && sum === 11 && previousPhase === 'COME_OUT' && has('lucky_11')) {
      this.game.money += 3;
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
    if (result === 'loss' && previousPhase === 'COME_OUT' && has('insurance') && sum !== 2 && sum !== 12) {
      const refund = Math.floor(this.game.bet / 2);
      this.game.money += refund;
      this.game.message += ` (insurance: -$${refund})`;
    }
    if (result === 'loss' && previousPhase === 'COME_OUT' && has('insurance') && (sum === 2 || sum === 12) && !has('snake_charmer')) {
      const refund = Math.floor(this.game.bet / 2);
      this.game.money += refund;
      this.game.message += ` (insurance: -$${refund})`;
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
      } else {
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

    // ─── TALENTS ───────────────────────────────────────

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
        this.game.money += 5;
        this.game.message += ' (iron bank +$5)';
      }
    }

    return this._postResolve(finalResult, values, sum, previousPhase, previousPoint);
  }

  /** Shared post-resolution bookkeeping */
  _postResolve(finalResult, values, sum, previousPhase, previousPoint) {
    // ─── PER-HAND PASSIVE ─────────────────────────────
    if (this.interestPerHand > 0) {
      this.game.money += this.interestPerHand;
    }

    // ─── BOOKKEEPING ──────────────────────────────────
    this.handCount++;
    this._lastResult = finalResult;
    this._lastSum = sum;
    this._lastPreviousPoint = previousPoint;

    // ─── TABLE PROGRESSION ────────────────────────────
    if (this.isBust) {
      this.bonusPot = 0;
      // Escape Plan: survive with $5
      if (hasCharges('escape_plan')) {
        const c = this.activeUpgrades.get('escape_plan');
        if (c === 1) this.activeUpgrades.delete('escape_plan');
        else if (c > 1) this.activeUpgrades.set('escape_plan', c - 1);
        this.game.money = 5;
        this.runState = 'BETTING';
        this.game.message = 'escape plan! survived with $5';
      } else {
        this.runState = 'BUST';
      }
    } else if (this.isRunWon) {
      const table = this.getCurrentTable();
      if (this.tableIndex < getTotalTables() - 1) {
        // Advance to next table
        this.tablesCleared++;
        this.tableIndex++;
        // Apply new min bet
        this.game.minBet = this.getCurrentTable().minBet;
        if (this.game.bet < this.game.minBet) {
          this.game.setBet(this.game.minBet);
        }
        this.runState = 'TABLE_CLEAR';
      } else {
        // Won the whole run!
        if (has('side_pot') && this.sidePot > 0) {
          this.bonusPot = this.sidePot * 2;
          this.game.money += this.bonusPot;
        }
        this.runState = 'RUN_WON';
      }
    } else if (
      this.game.phase === 'COME_OUT' &&
      (finalResult === 'win' || finalResult === 'loss' || finalResult === 'push') &&
      this.handCount > 0
    ) {
      const remaining = getAvailableUpgrades(new Set(this.activeUpgrades.keys()));
      if (remaining.length === 0) {
        this.runState = 'BETTING';
      } else {
        this.runState = 'PICKING';
        this._pickShown = false;
      }
    } else {
      this.runState = 'BETTING';
    }

    return finalResult;
  }

  /** Return N random picks from remaining upgrades (extraPick adds choices) */
  getPickOptions(count = 3) {
    const pickCount = count + (this.extraPick || 0);
    const excluded = new Set(this.activeUpgrades.keys());
    const available = getAvailableUpgrades(excluded);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(pickCount, shuffled.length));
  }

  /** Apply a chosen upgrade */
  applyUpgrade(id) {
    const upgrade = UPGRADES.find(u => u.id === id);
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

    this.runState = 'BETTING';

    // If loan_shark applied at exactly 0 money, prevent immediate bust
    if (id === 'loan_shark' && this.game.money <= 0) {
      this.runState = 'BETTING';
    }
  }

  /** Skip the pick — just close it and go back to betting */
  skipPick() {
    this.runState = 'BETTING';
  }

  /** Use a reroll token to get fresh picks */
  useReroll() {
    if (this.rerollTokens <= 0) return false;
    this.rerollTokens--;
    this._pickShown = false;
    return true;
  }

  /** Get list of active upgrades with metadata */
  getActiveUpgradeList() {
    return Array.from(this.activeUpgrades.entries()).map(([id, charges]) => {
      const def = UPGRADES.find(u => u.id === id);
      if (!def) return { id, name: id, desc: '', category: '?', rarity: 'common', charges: 0 };
      return { ...def, charges };
    });
  }

  /** Human-friendly summary of the last run */
  getRunSummary() {
    return {
      handsPlayed: this.handCount,
      winCount: this.game.winCount,
      lossCount: this.game.lossCount,
      finalMoney: Math.max(this.game.money, 0),
      sidePot: this.sidePot,
      bonusPot: this.bonusPot,
      tablesCleared: this.tablesCleared,
      upgrades: this.getActiveUpgradeList().map(u => u.name),
    };
  }
}
