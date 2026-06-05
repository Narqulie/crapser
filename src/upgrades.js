// Upgrade categories: dice, bet, charm, talent
// Rarities: common, uncommon, rare

export const TABLE_CONFIGS = [
  { id: 1, name: 'Back Alley',    target: 200,  minBet: 5,  boss: false },
  { id: 2, name: 'Side Street',   target: 400,  minBet: 10, boss: false },
  { id: 3, name: 'Midtown',       target: 600,  minBet: 15, boss: false },
  { id: 4, name: 'The Strip',     target: 800,  minBet: 20, boss: false },
  { id: 5, name: 'The House',     target: 1000, minBet: 25, boss: true, bossName: 'Pit Boss' },
];

export const RUN_WIN_TARGET = 1000;

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

  // ── uncommon ──
  {
    id: 'bookie',
    name: 'Bookie',
    description: 'Every roll pays $1, no matter what',
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

export const TOTAL_UPGRADES = UPGRADES.length;

export function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id);
}

export function getAvailableUpgrades(excludeIds) {
  return UPGRADES.filter(u => !excludeIds.has(u.id));
}

export function getTable(index) {
  return TABLE_CONFIGS[Math.min(index, TABLE_CONFIGS.length - 1)];
}

export function getTotalTables() {
  return TABLE_CONFIGS.length;
}
