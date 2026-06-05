const CRAPS_NAMES = {
  2: 'snake eyes',
  3: 'cross eyes',
  12: 'boxcars',
};

export class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.money = 100;
    this.bet = 10;
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

  get canRoll() {
    return !this.rolling && this.money >= this.bet;
  }

  get bankrupt() {
    return this.money < this.bet && this.phase === 'COME_OUT';
  }

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
        this.message = `natural ${sum} \u2014 win $${this.bet}`;
        result = 'win';
      } else if (sum === 2 || sum === 3 || sum === 12) {
        const name = CRAPS_NAMES[sum] || sum;
        this.lossCount++;
        this.message = `${name} \u2014 craps, lose $${this.bet}`;
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
        this.message = `made point ${this.point} \u2014 win $${this.bet}`;
        this.point = null;
        this.phase = 'COME_OUT';
        result = 'win';
      } else if (sum === 7) {
        this.lossCount++;
        this.message = `seven out \u2014 lose $${this.bet}`;
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

  deadThrow() {
    if (this.phase === 'COME_OUT') {
      this.money += this.bet;
    }
    this.rolling = false;
    this.rollCount--;
    this.message = 'dead throw \u2014 roll again';
  }

  setBet(amount) {
    this.bet = Math.min(Math.max(5, amount), 100);
  }

}
