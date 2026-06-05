// ─── TIMING CONSTANTS ─────────────────────────────────────
/** Delay before showing result card (ms) */
export const RESULT_CARD_DELAY = 400;
/** Duration result card stays visible (ms) */
export const RESULT_CARD_DISPLAY = 2800;
/** Timeout for announcer phrase display (ms) */
export const ANNOUNCE_TIMEOUT = 1500;
/** Timeout for dice settle detection (ms) */
export const SETTLE_TIMEOUT = 3000;

// ─── STORAGE ──────────────────────────────────────────────
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

// ─── VOW DEFS (DIFFICULTY MODIFIERS) ────────────────────────

/**
 * Difficulty vow definitions — selected at run start.
 * Each vow adds a permanent challenge modifier with a compensating bonus.
 *
 * @type {Array<{id: string, name: string, desc: string, effect: string, bonus: object, limit?: number}>}
 */
export const VOW_DEFS = [
  {
    id: 'iron_man',
    name: 'Iron Man',
    desc: 'Shops are locked. +2 free upgrades at start.',
    effect: 'no_shops',
    bonus: { extraUpgrades: 2 },
  },
  {
    id: 'glass_jaw',
    name: 'Glass Jaw',
    desc: 'Standard dice start cracked. +50% starting money.',
    effect: 'cracked_standards',
    bonus: { startingMoneyMult: 1.5 },
  },
  {
    id: 'speed_run',
    name: 'Speed Run',
    desc: '5 hands per table max. Double XP.',
    effect: 'hand_limit',
    bonus: { xpMultiplier: 2 },
    limit: 5,
  },
  {
    id: 'purist',
    name: 'Purist',
    desc: 'No dice type effects. +1 upgrade per table clear.',
    effect: 'no_dice_effects',
    bonus: { extraUpgradePerTable: 1 },
  },
];

/** @returns {object} Fresh default meta-progression data structure */
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
    activeVow: null,        // id of the active difficulty vow (null = no vow)
    npcTrust: {},
  };
}

function xpForNextLevel(level) {
  if (level < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level];
  return Math.floor(10000 * Math.pow(1.15, level - 9));
}

export class MetaProgress {
  /** Initialize meta-progression: load saved data or start fresh */
  constructor() {
    this.data = getDefaultData();
    this.load();
  }

  /** Load persisted meta data from localStorage, merging with defaults */
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

  /** Persist current meta data to localStorage */
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
    let xp = this.calcRunXP(money, tablesCleared, upgradesCount, won);
    // Speed Run vow: double XP
    if (this.data.activeVow === 'speed_run') {
      xp *= 2;
    }
    return xp;
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

  /** @returns {{ current: number, needed: number, progress: number }} XP progress toward next level */
  getLevelProgress() {
    const current = this.data.xp;
    const needed = xpForNextLevel(this.data.level);
    return { current, needed, progress: needed > 0 ? current / needed : 0 };
  }

  // ─── VOWS ──────────────────────────────────────────────

  /**
   * Set the active difficulty vow for the next run.
   * Must be called BEFORE the run starts (during vow selection).
   *
   * @param {string} vowId — id from VOW_DEFS (e.g., 'iron_man', 'speed_run')
   */
  setVow(vowId) {
    this.data.activeVow = vowId;
    this.save();
  }

  /**
   * Get the currently active vow definition, or null if no vow is set.
   * @returns {object|null} matching entry from VOW_DEFS, or null
   */
  getVow() {
    if (!this.data.activeVow) return null;
    return VOW_DEFS.find(v => v.id === this.data.activeVow) || null;
  }

  /** Clear the active vow so the next run has no vow modifier */
  clearVow() {
    this.data.activeVow = null;
    this.save();
  }

  /** Add trust to an NPC (record dollars spent) */
  addTrust(npcId, amount) {
    if (!this.data.npcTrust[npcId]) this.data.npcTrust[npcId] = 0;
    this.data.npcTrust[npcId] += amount;
    this.save();
  }

  /** Get total trust (dollars spent) for an NPC */
  getTrust(npcId) {
    return this.data.npcTrust?.[npcId] || 0;
  }

  /**
   * Get trust level (1-5) for an NPC based on spending thresholds.
   * T1: $0, T2: $100, T3: $500, T4: $1500, T5: $5000
   */
  getTrustLevel(npcId) {
    const spent = this.getTrust(npcId);
    const levels = [
      { level: 1, threshold: 0 },
      { level: 2, threshold: 100 },
      { level: 3, threshold: 500 },
      { level: 4, threshold: 1500 },
      { level: 5, threshold: 5000 },
    ];
    let current = 1;
    for (const l of levels) {
      if (spent >= l.threshold) current = l.level;
    }
    return current;
  }

  /**
   * Reset all meta-progression data to defaults (including activeVow) and persist.
   */
  reset() {
    this.data = getDefaultData();
    this.save();
  }
}
