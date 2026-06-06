const CRAPS_NAMES = {
  2: 'snake eyes',
  3: 'cross eyes',
  12: 'boxcars',
};

export class Game {
  /**
   * Pass-line street craps state machine.
   *
   * @property {number} money - Current bankroll
   * @property {number} bet - Current bet amount (clamped to minBet–100)
   * @property {number} minBet - Minimum allowed bet (enforced by table/rogue run)
   * @property {number|null} point - The established point number, or null during come-out
   * @property {'COME_OUT'|'POINT'} phase - Current game phase
   * @property {boolean} rolling - Whether dice are currently in motion
   * @property {number} rollCount - Total rolls this session
   * @property {number} winCount - Total resolved wins
   * @property {number} lossCount - Total resolved losses
   * @property {number[]|null} lastRoll - The two individual die values from the last roll
   * @property {number|null} lastSum - The total sum of the last roll
   * @property {Array<{values:number[], sum:number, result:string}>} rollHistory - Recent rolls (max 12)
   * @property {Array<{values:number[], sum:number, result:string}>} handHistory - Current hand rolls (max 50)
   * @property {string} message - Human-readable status message for the UI
   */
  constructor() {
    this.reset();
  }

  /** Reset all game state to initial values (fresh session) */
  reset() {
    this.money = 20;
    this.bet = 2;
    this.minBet = 1;
    this.point = null;
    this.phase = 'COME_OUT';
    this.rolling = false;
    this.rollCount = 0;
    this.winCount = 0;
    this.lossCount = 0;
    this.lastRoll = null;
    this.lastSum = null;
    this.rollHistory = [];
    this.handHistory = [];
    this._newHand = false;
    this.message = 'place your bet';
  }

  /** @returns {boolean} True when dice are not rolling — a new roll can begin */
  get canRoll() {
    return !this.rolling;
  }

  /**
   * Mark the beginning of a dice roll: deduct bet on come-out,
   * set rolling flag, increment roll count.
   * @returns {boolean} True if roll was accepted (canRoll was true)
   */
  roll() {
    if (!this.canRoll) return false;

    if (this._newHand) {
      this.handHistory = [];
      this._newHand = false;
    }

    if (this.phase === 'COME_OUT') {
      this.money -= this.bet;
    }

    this.rolling = true;
    this.rollCount++;
    this.message = 'rolling\u2026';
    return true;
  }

  /**
   * Resolve the dice roll with standard pass-line craps rules.
   *
   * Come-out phase: 7/11 = win, 2/3/12 = loss, anything else = point established.
   * Point phase: hitting the point = win, 7 = loss (seven out), anything else = continue.
   *
   * @param {[number, number]} values - The two die face values
   * @returns {'win'|'loss'|'point'|'continue'} Result of the roll resolution
   */
  resolve(values) {
    this.rolling = false;
    this.lastRoll = values;
    const sum = values[0] + values[1];
    this.lastSum = sum;

    let result;
    if (this.phase === 'COME_OUT') {
      if (sum === 7 || sum === 11) {
        this.money += this.bet * 2;
        this.winCount++;
        this.message = `natural ${sum} \u2014 win \u20A1${this.bet}`;
        result = 'win';
      } else if (sum === 2 || sum === 3 || sum === 12) {
        const name = CRAPS_NAMES[sum] || sum;
        this.lossCount++;
        this.message = `${name} \u2014 craps, lose \u20A1${this.bet}`;
        result = 'loss';
      } else {
        this.point = sum;
        this.phase = 'POINT';
        this.message = `point: ${sum}`;
        result = 'point';
      }
    } else {
      if (sum === this.point) {
        this.money += this.bet * 2;
        this.winCount++;
        this.message = `made point ${this.point} \u2014 win \u20A1${this.bet}`;
        this.point = null;
        this.phase = 'COME_OUT';
        result = 'win';
      } else if (sum === 7) {
        this.lossCount++;
        this.message = `seven out \u2014 lose \u20A1${this.bet}`;
        this.point = null;
        this.phase = 'COME_OUT';
        result = 'loss';
      } else {
        this.message = `rolled ${sum}, need ${this.point}`;
        result = 'continue';
      }
    }

    this.rollHistory.unshift({ values, sum, result });
    if (this.rollHistory.length > 12) this.rollHistory.pop();

    this.handHistory.unshift({ values, sum, result });
    if (this.handHistory.length > 50) this.handHistory.pop();

    if (this.phase === 'COME_OUT' && result === 'loss' && sum === 7) {
      this._newHand = true;
    }

    return result;
  }

  /**
   * Handle a dead throw (dice failed to land properly):
   * refund bet if on come-out, reset rolling state, decrement roll count.
   */
  deadThrow() {
    if (this.phase === 'COME_OUT') {
      this.money += this.bet;
    }
    this.rolling = false;
    this.rollCount = Math.max(0, this.rollCount - 1);
    this.message = 'dead throw \u2014 roll again';
  }

  /**
   * Set the current bet amount, clamped between minBet (or 5) and 100.
   * @param {number} amount - Desired bet amount
   */
  setBet(amount) {
    this.bet = Math.min(Math.max(this.minBet || 1, amount), 20);
  }
}
