const STORAGE_KEY = 'crapser_meta';

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

export const PERKS = [
  { id: 'starter_boost', name: 'Starter Boost',    desc: 'Start each run with +$10',        cost: 1, prerequisite: null },
  { id: 'fat_stacks',    name: 'Fat Stacks',        desc: 'Start each run with +$25',        cost: 2, prerequisite: 'starter_boost' },
  { id: 'reroll_basic',  name: 'Mulligan',           desc: '1 reroll token per run',         cost: 1, prerequisite: null },
  { id: 'reroll_master', name: 'Double Mulligan',    desc: '2 reroll tokens per run',        cost: 2, prerequisite: 'reroll_basic' },
  { id: 'extra_choice',  name: 'More Options',       desc: 'Pick from 4 upgrades instead of 3', cost: 2, prerequisite: null },
  { id: 'interest',      name: 'Street Interest',    desc: '+$1 per hand played (passive)',   cost: 1, prerequisite: null },
  { id: 'first_free',    name: 'First Pick Free',    desc: 'First upgrade each run is free', cost: 2, prerequisite: null },
  { id: 'xp_boost',      name: 'Quick Learner',      desc: '2x XP gain',                     cost: 1, prerequisite: null },
];

function getDefaultData() {
  return {
    xp: 0,
    level: 1,
    runsPlayed: 0,
    runsWon: 0,
    bestMoney: 0,
    totalEarned: 0,
    totalTablesCleared: 0,
    unlockedPerks: [],
    availablePoints: 0,
  };
}

function xpForNextLevel(level) {
  if (level < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level];
  return Math.floor(10000 * Math.pow(1.15, level - 9));
}

export class MetaProgress {
  constructor() {
    this.data = getDefaultData();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...getDefaultData(), ...parsed };
      }
    } catch {
      this.data = getDefaultData();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage may be full — silently ignore
    }
  }

  /** Add XP, check level-ups, return { leveledUp, newLevel } */
  addXP(amount) {
    if (this.hasPerk('xp_boost')) amount *= 2;
    this.data.xp += amount;
    let leveledUp = false;
    while (true) {
      const needed = xpForNextLevel(this.data.level);
      if (this.data.xp < needed) break;
      this.data.xp -= needed;
      this.data.level++;
      this.data.availablePoints++;
      leveledUp = true;
    }
    this.save();
    return { leveledUp, newLevel: this.data.level };
  }

  /** Calculate XP earned from a completed run */
  calcRunXP(money, tablesCleared, upgradesCount, won) {
    let xp = Math.floor(money / 5);
    xp += tablesCleared * 50;
    xp += upgradesCount * 10;
    if (won) xp += 200;
    return Math.max(xp, 10);
  }

  /** Record a completed run */
  recordRun(money, won, tablesCleared, upgradesCount) {
    this.data.runsPlayed++;
    if (won) this.data.runsWon++;
    if (money > this.data.bestMoney) this.data.bestMoney = money;
    if (money > 0) this.data.totalEarned += money;
    this.data.totalTablesCleared += tablesCleared;
    return this.calcRunXP(money, tablesCleared, upgradesCount, won);
  }

  /** Unlock a perk, spending available points */
  unlockPerk(perkId) {
    if (this.data.availablePoints <= 0) return false;
    if (this.data.unlockedPerks.includes(perkId)) return false;
    const perk = PERKS.find(p => p.id === perkId);
    if (!perk) return false;
    if (perk.prerequisite && !this.data.unlockedPerks.includes(perk.prerequisite)) return false;
    this.data.availablePoints--;
    this.data.unlockedPerks.push(perkId);
    this.save();
    return true;
  }

  /** Check if a perk is unlocked */
  hasPerk(perkId) {
    return this.data.unlockedPerks.includes(perkId);
  }

  /** Get bonuses to apply at run start */
  getBonuses() {
    return {
      startingMoney: (this.hasPerk('fat_stacks') ? 25 : this.hasPerk('starter_boost') ? 10 : 0),
      rerollTokens: (this.hasPerk('reroll_master') ? 2 : this.hasPerk('reroll_basic') ? 1 : 0),
      extraPick: this.hasPerk('extra_choice') ? 1 : 0,
      interestPerHand: this.hasPerk('interest') ? 1 : 0,
      firstFree: this.hasPerk('first_free') ? 1 : 0,
    };
  }

  getLevelProgress() {
    const current = this.data.xp;
    const needed = xpForNextLevel(this.data.level);
    return { current, needed, progress: needed > 0 ? current / needed : 0 };
  }

  reset() {
    this.data = getDefaultData();
    this.save();
  }
}
