/**
 * upgrades.js — Roguelike upgrade catalog, system definitions, and synergy detection
 *
 * Defines 33 upgrades across 4 categories (dice, bet, charm, talent) and 3 rarities
 * (common, uncommon, rare). Table configurations were moved to src/map.js as
 * the MAP_ACTS node-based progression system (3 acts x 3 floors x ~27 nodes).
 * The internal TABLE_CONFIGS (non-exported) remains for backward compat with
 * {@link getTable} and {@link getTotalTables} — these are used by rogue-run.js
 * until the full map-navigation migration is complete.
 *
 * Synergies reward set bonuses when collecting 2+ or 3+ upgrades from the same category.
 * Anti-synergies penalize specific conflicting upgrade pairs.
 * The Legendary bonus activates at 1+ from each of the 4 categories.
 *
 * @module upgrades
 */

// ========== TABLE CONFIGURATIONS (INTERNAL — deprecated, see src/map.js) ======

/**
 * Table progression definitions — module-private, kept for backward compat.
 * **Deprecated**: table progression now lives in {@link module:map~MAP_ACTS}.
 * {@link getTable} and {@link getTotalTables} still reference this data until
 * consumers migrate to the map.js node system.
 *
 * @private
 * @type {Array<{id: number, name: string, target: number, minBet: number, boss: boolean, bossName?: string}>}
 */
const TABLE_CONFIGS = [
  { id: 1, name: 'Back Alley',    target: 200,  minBet: 5,  boss: false },
  { id: 2, name: 'Side Street',   target: 400,  minBet: 10, boss: false },
  { id: 3, name: 'Midtown',       target: 600,  minBet: 15, boss: false },
  { id: 4, name: 'The Strip',     target: 800,  minBet: 20, boss: false },
  { id: 5, name: 'The House',     target: 1000, minBet: 25, boss: true, bossName: 'Pit Boss' },
];

/**
 * Difficulty traits per table — scaling modifiers applied during the roguelike run.
 * Each table (index 0–4) adds a unique mechanic that escalates difficulty.
 *
 * Trait types:
 * - `slippery`: increases the minimum bet requirement
 * - `crooked`: chance per roll that a win result is fudged to a loss
 * - `high_stakes`: dice pick happens BEFORE bet placement (order swap)
 * - `boss`: chance to steal a random upgrade on loss; also marks boss table for visual effects
 *
 * @type {Array<{tableIndex: number, name: string, trait: string|null, description: string, minBetAdd?: number, crookedChance?: number, highStakes?: boolean, stealChance?: number, isBoss?: boolean}>}
 */
export const TABLE_TRAITS = [
  { tableIndex: 0, name: 'Back Alley',   trait: null,         description: 'No tricks — pure craps' },
  { tableIndex: 1, name: 'Dive Bar',     trait: 'slippery',   description: 'Min bet $25',                minBetAdd: 25 },
  { tableIndex: 2, name: 'Crooked Den',  trait: 'crooked',    description: '10% chance result fudged against you', crookedChance: 0.10 },
  { tableIndex: 3, name: 'High Stakes',  trait: 'high_stakes', description: 'Pick dice BEFORE setting bet',         highStakes: true },
  { tableIndex: 4, name: 'The House',    trait: 'boss',        description: '3% chance steals upgrade on loss',    stealChance: 0.03, isBoss: true },
];

/**
 * Money target required to win the entire roguelike run (final table: The House).
 * **Note**: with map.js migration, the run-won condition is now determined by
 * clearing the Act 3 boss node (`house_boss` with target 1000). Kept for
 * backward compat with existing consumers.
 *
 * @type {number}
 */
export const RUN_WIN_TARGET = 1000;

/**
 * Complete catalog of all 33 roguelike upgrades.
 * Four categories: dice, bet, charm, talent — each with common/uncommon/rare tiers.
 * Charms have maxCharges for one-time use; others are permanent passives.
 *
 * @type {Array<{id: string, name: string, description: string, category: string, rarity: string, maxCharges?: number}>}
 */
export const UPGRADES = [
  // ═══════════════════════════════════════════════════════════
  // ─── DICE MODIFIERS ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── common ──
  {
    id: 'loaded_sevens',
    name: 'Loaded Sevens',
    description: 'On come-out, natural 7 pays 3x instead of 2x',
    category: 'dice',
    rarity: 'common',
  },
  {
    id: 'lucky_7s',
    name: 'Lucky 7s',
    description: 'Rolling 7 on come-out pays +$2 bonus',
    category: 'dice',
    rarity: 'common',
  },
  {
    id: 'loaded_dice',
    name: 'Loaded Dice',
    description: 'Sum of all rolls is +1 (capped at 12)',
    category: 'dice',
    rarity: 'common',
  },

  // ── uncommon ──
  {
    id: 'snake_charmer',
    name: 'Snake Charmer',
    description: '2 and 12 win on come-out instead of losing',
    category: 'dice',
    rarity: 'uncommon',
  },
  {
    id: 'bouncy_dice',
    name: 'Bouncy Dice',
    description: '25% chance to save your hand on seven-out (keep rolling)',
    category: 'dice',
    rarity: 'uncommon',
  },
  {
    id: 'all_weather',
    name: 'All-Weather Dice',
    description: 'During point phase, rolling 7 does not lose — treated as continue',
    category: 'dice',
    rarity: 'uncommon',
  },

  // ── rare ──
  {
    id: 'magnetic_point',
    name: 'Magnetic Point',
    description: 'Wins on point pay +50%',
    category: 'dice',
    rarity: 'rare',
  },
  {
    id: 'hot_dice',
    name: 'Hot Dice',
    description: 'After making your point, the very next come-out roll auto-wins (once per hand)',
    category: 'dice',
    rarity: 'rare',
  },
  {
    id: 'face_off',
    name: 'Face-Off',
    description: 'Doubles pay +$10 bonus',
    category: 'dice',
    rarity: 'uncommon',
  },
  {
    id: 'rigged_roll',
    name: 'Rigged Roll',
    description: 'On losing 7, re-roll one die (1 charge)',
    category: 'dice',
    rarity: 'rare',
    maxCharges: 1,
  },

  // ═══════════════════════════════════════════════════════════
  // ─── BET MODIFIERS ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── common ──
  {
    id: 'insurance',
    name: 'Insurance',
    description: 'On come-out loss, refund half your bet (rounded down)',
    category: 'bet',
    rarity: 'common',
  },
  {
    id: 'pocket_change',
    name: 'Pocket Change',
    description: 'Each win pays +$2 extra',
    category: 'bet',
    rarity: 'common',
  },
  {
    id: 'lucky_11',
    name: 'Lucky 11',
    description: 'Natural 11 on come-out pays +$3 bonus',
    category: 'bet',
    rarity: 'common',
  },

  // ── uncommon ──
  {
    id: 'side_pot',
    name: 'Side Pot',
    description: '15% of each win goes to a bonus pot. Doubles your money if you win the run.',
    category: 'bet',
    rarity: 'uncommon',
  },
  {
    id: 'sucker_bet',
    name: 'Sucker Bet',
    description: '15% chance any loss becomes a push (bet returned)',
    category: 'bet',
    rarity: 'uncommon',
  },

  // ── rare ──
  {
    id: 'double_down',
    name: 'Double Down',
    description: 'All wins pay 3x instead of 2x',
    category: 'bet',
    rarity: 'rare',
  },
  {
    id: 'compound_streak',
    name: 'Compound Streak',
    description: 'Consecutive hand wins multiply: 1x -> 1.5x -> 2x -> 2.5x -> 3x (max)',
    category: 'bet',
    rarity: 'rare',
  },
  {
    id: 'cascade',
    name: 'Cascade',
    description: 'On point win, get your bet back in addition to normal payout',
    category: 'bet',
    rarity: 'rare',
  },
  {
    id: 'fire_bet',
    name: 'Fire Bet',
    description: 'Each different point you make adds +0.5x to all point-win multipliers (cumulative)',
    category: 'bet',
    rarity: 'rare',
  },
  {
    id: 'parlay',
    name: 'Parlay',
    description: 'Win doubles bet (but lose loses double)',
    category: 'bet',
    rarity: 'rare',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── CHARMS (one-time use) ──────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── common ──
  {
    id: 'rabbit_foot',
    name: 'Lucky Rabbit Foot',
    description: 'Once: turn a loss into a full refund (keep your bet)',
    category: 'charm',
    rarity: 'common',
    maxCharges: 1,
  },
  {
    id: 'escape_plan',
    name: 'Escape Plan',
    description: 'Once: when you would bust, survive with $5 instead',
    category: 'charm',
    rarity: 'common',
    maxCharges: 1,
  },

  // ── uncommon ──
  {
    id: 'four_leaf_clover',
    name: 'Four-Leaf Clover',
    description: 'Once: turn a loss into a win (full payout)',
    category: 'charm',
    rarity: 'uncommon',
    maxCharges: 1,
  },

  // ── rare ──
  {
    id: 'cut_the_deck',
    name: 'Cut the Deck',
    description: 'Once: on seven-out, reroll both dice instead of losing',
    category: 'charm',
    rarity: 'rare',
    maxCharges: 1,
  },
  {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    description: 'Once: double your current money right now',
    category: 'charm',
    rarity: 'rare',
    maxCharges: 1,
  },
  {
    id: 'unlucky_streak',
    name: 'Unlucky Streak',
    description: 'On loss, next roll +15% win chance (3 charges)',
    category: 'charm',
    rarity: 'common',
    maxCharges: 3,
  },

  // ═══════════════════════════════════════════════════════════
  // ─── TALENTS ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── common ──
  {
    id: 'loan_shark',
    name: 'Loan Shark',
    description: 'You can go to -$50 before busting',
    category: 'talent',
    rarity: 'common',
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Start the run with +$25 extra',
    category: 'talent',
    rarity: 'common',
  },
  {
    id: 'sharp',
    name: 'Sharp',
    description: 'On any loss, get $1 back',
    category: 'talent',
    rarity: 'common',
  },
  {
    id: 'collector',
    name: 'Collector',
    description: '+$10 whenever you add an upgrade',
    category: 'talent',
    rarity: 'common',
  },

  // ── uncommon ──
  {
    id: 'bookie',
    name: 'Bookie',
    description: 'Every roll pays $1, no matter what',
    category: 'talent',
    rarity: 'uncommon',
  },
  {
    id: 'hustlers_cut',
    name: "Hustler's Cut",
    description: '+5% of table target on table clear',
    category: 'talent',
    rarity: 'uncommon',
  },

  // ── rare ──
  {
    id: 'iron_bank',
    name: 'Iron Bank',
    description: 'Every 3 hands played, collect +$5 passive income',
    category: 'talent',
    rarity: 'rare',
  },
];

/**
 * Total number of upgrades in the catalog.
 * @type {number}
 */
export const TOTAL_UPGRADES = UPGRADES.length;

/**
 * Look up an upgrade by its string id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id);
}

/**
 * Get all upgrades except those whose ids are in the exclude set.
 * Used when generating pick-3 options to avoid duplicates.
 *
 * When `categoryWeights` is provided, entries from favored categories are
 * duplicated in the returned pool so random selection favors under-represented
 * categories. Each category's weight acts as a multiplier (e.g. weight 3 means
 * upgrades from that category appear 3x in the pool). Weight 0 excludes the
 * category entirely. Omit the parameter for equal-chance selection.
 *
 * @param {Set<string>} excludeIds — set of upgrade ids to exclude
 * @param {Object<string, number>} [categoryWeights] — optional weight multipliers per category (dice, bet, charm, talent)
 * @returns {Array<object>} pool of available upgrades, possibly with duplicates from favored categories
 */
export function getAvailableUpgrades(excludeIds, categoryWeights) {
  const pool = UPGRADES.filter(u => !excludeIds.has(u.id));

  // No weighting → return raw pool (backward compatible)
  if (!categoryWeights) return pool;

  // Duplicate entries from favored categories to increase their pick probability
  const weighted = [];
  for (const upg of pool) {
    const weight = categoryWeights[upg.category] ?? 1;
    if (weight <= 0) continue; // weight 0 = exclude this category
    for (let i = 0; i < weight; i++) {
      weighted.push(upg);
    }
  }
  return weighted;
}

/**
 * Get the table config at a given index, clamped to the last table.
 * **Deprecated**: use {@link module:map~getNode} and node-based progression instead.
 * Kept for backward compat until rogue-run.js migrates to map.js.
 *
 * @param {number} index — 0-based table index
 * @returns {object} table config with `id`, `name`, `target`, `minBet`, `boss`
 * @deprecated Table progression migrated to src/map.js MAP_ACTS
 */
export function getTable(index) {
  return TABLE_CONFIGS[Math.min(index, TABLE_CONFIGS.length - 1)];
}

/**
 * Total number of tables in the legacy run progression.
 * **Deprecated**: use {@link module:map~MAP_ACTS} act/floor structure instead.
 * Kept for backward compat until rogue-ui.js migrates to map.js.
 *
 * @returns {number} always 5 (legacy table count)
 * @deprecated Table progression migrated to src/map.js MAP_ACTS
 */
export function getTotalTables() {
  return TABLE_CONFIGS.length;
}

// ========== SYNERGIES (SET BONUSES PER CATEGORY) ============================

/**
 * Synergy definitions — set bonuses triggered when collecting
 * 2+ or 3+ upgrades from the same category. Each tier stacks:
 * set2 unlocks at 2, set2+set3 unlock together at 3.
 *
 * @type {Object<string, {set2: object, set3: object}>}
 */
export const SYNERGIES = {
  dice: {
    set2: {
      description: '+1 free re-roll per hand',
      implNote: 'Grant one free re-roll token usable during DICE_PICK or roll phase',
    },
    set3: {
      description: 'auto-reroll on 2/3/12',
      implNote: 'After roll: if sum is 2, 3, or 12, automatically re-roll once per hand',
    },
  },
  bet: {
    set2: {
      description: '+15% payout',
      implNote: 'Multiply all win payouts by 1.15',
    },
    set3: {
      description: 'compound 1% interest per hand',
      implNote: 'At end of each hand, add 1% of current money (rounded down)',
    },
  },
  charm: {
    set2: {
      description: '+1 charge to all charms',
      implNote: 'When this becomes active, add 1 charge to every active charm upgrade',
    },
    set3: {
      description: "charms don't consume on 7/11",
      implNote: 'When a charm would trigger on a 7 or 11 roll, skip charge consumption',
    },
  },
  talent: {
    set2: {
      description: '+$2 passive income per roll',
      implNote: 'Each roll grants an additional $2 passive income',
    },
    set3: {
      description: 'double passive income',
      implNote: 'All passive income sources (Bookie, Iron Bank) are doubled',
    },
  },
};

// ========== ANTI-SYNERGIES (CONFLICTING PAIRS) ===============================

/**
 * Anti-synergy definitions — pairs of upgrades that conflict,
 * applying a nerf when both are active simultaneously.
 *
 * @type {Array<{pair: string[], nerf: string}>}
 */
export const ANTI_SYNERGIES = [
  {
    pair: ['loaded_dice', 'precision'],
    nerf: 'Lose 1 re-roll per hand',
  },
  {
    pair: ['double_down', 'loan_shark'],
    nerf: 'All payouts reduced by 10%',
  },
  {
    pair: ['insurance', 'volatile'],
    nerf: 'Insurance refund reduced by 1 point',
  },
  {
    pair: ['compound_streak', 'all_weather'],
    nerf: 'No streak stacking on loss rolls',
  },
];

// ========== LEGENDARY BONUS =================================================

/**
 * Legendary bonus — activates when the player has at least 1 upgrade
 * from each of the 4 categories. Grants a 5% chance to instantly win any roll.
 *
 * @type {{description: string, chance: number, implNote: string}}
 */
export const LEGENDARY_BONUS = {
  description: '5% instant win on any roll when 1+ upgrade from each of 4 categories active',
  chance: 0.05,
  implNote: 'After every roll: if Legendary active, 5% chance to instantly win the current hand',
};

// ========== SYNERGY DETECTION ===============================================

/**
 * Pure function — analyzes active upgrades for synergies, anti-synergies, and legendary bonus.
 * @param {Map<string, number>} activeUpgrades — Map of upgrade.id → charge as number (-1 = permanent, > 0 = active, 0 = depleted)
 * @returns {{ synergies: Array, antiSynergies: Array, legendary: object|null }}
 */
export function getActiveSynergies(activeUpgrades) {
  const counts = { dice: 0, bet: 0, charm: 0, talent: 0 };
  const activeIds = [];

  for (const [id, charge] of activeUpgrades) {
    // charge is a raw number: -1 = permanent, > 0 = active charges, 0/deleted = depleted
    if (charge === -1 || charge > 0) {
      const upg = getUpgrade(id);
      if (upg && upg.category && Object.prototype.hasOwnProperty.call(counts, upg.category)) {
        counts[upg.category]++;
        activeIds.push(id);
      }
    }
  }

  // Check synergies — include both set2 and set3 if thresholds met
  const synergies = [];
  for (const [category, bonuses] of Object.entries(SYNERGIES)) {
    const count = counts[category];
    if (count >= 3) {
      synergies.push({ category, tier: 'set3', ...bonuses.set3 });
    }
    if (count >= 2) {
      synergies.push({ category, tier: 'set2', ...bonuses.set2 });
    }
  }
  // Stable sort: set3 before set2 within same category, then by category name
  synergies.sort((a, b) => a.category.localeCompare(b.category) || a.tier.localeCompare(b.tier));

  // Check anti-synergies — both IDs must be present in activeUpgrades
  const antiSynergies = [];
  for (const anti of ANTI_SYNERGIES) {
    if (anti.pair.every(id => activeIds.includes(id))) {
      antiSynergies.push(anti);
    }
  }

  // Check legendary — at least 1 upgrade from each of the 4 categories
  const legendary =
    counts.dice >= 1 && counts.bet >= 1 && counts.charm >= 1 && counts.talent >= 1
      ? LEGENDARY_BONUS
      : null;

  return { synergies, antiSynergies, legendary };
}
