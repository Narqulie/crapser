/**
 * dice-types.js — Die type catalog and DiceHand state machine for crapser
 *
 * Defines 6 die types across 3 categories (basic, special, risk), each with
 * durability tracking and a cracked state that triggers when durability hits 0.
 * The DiceHand class manages a 4-slot hand, picking 2 dice per roll, with
 * durability consumption and die replacement during shop visits.
 *
 * @module dice-types
 */

// ========== DICE TYPE DEFINITIONS ========================================

/**
 * Catalog of all die types available in the game.
 * Each type has an id, display name, durability (rolls before cracking),
 * effect description, and category classification.
 *
 * @type {Array<{id: string, name: string, durability: number, effect: string, category: string}>}
 */
export const DICE_TYPES = [
  // ── basic ──
  {
    id: 'standard',
    name: 'Standard',
    durability: 12,
    effect: 'No special effect',
    category: 'basic',
  },

  // ── special ──
  {
    id: 'weighted',
    name: 'Weighted',
    durability: 8,
    effect: '25% come-out sum becomes 7',
    category: 'special',
  },
  {
    id: 'seven_die',
    name: 'Seven Die',
    durability: 6,
    effect: 'Once per hand: sum=6 becomes 7',
    category: 'special',
  },
  {
    id: 'precision',
    name: 'Precision',
    durability: 10,
    effect: 'Re-roll 2 or 12',
    category: 'special',
  },

  // ── risk ──
  {
    id: 'volatile',
    name: 'Volatile',
    durability: 6,
    effect: 'Win +50% payout, Loss −25%',
    category: 'risk',
  },
  {
    id: 'glass',
    name: 'Glass',
    durability: 3,
    effect: 'Win 2.5x, shatters on loss',
    category: 'risk',
  },

  // ── dice (roguelike-only) ──
  {
    id: 'lucky_11',
    name: 'Lucky 11',
    desc: '20% chance pays at 3:2 odds',
    durability: 8,
    category: 'dice',
    rarity: 'uncommon',
    effect: 'lucky_payout',
  },
  {
    id: 'cursed_13',
    name: 'Cursed 13',
    desc: 'Win: -$5, Loss: +$3',
    durability: 10,
    category: 'dice',
    rarity: 'rare',
    effect: 'cursed_swing',
  },
  {
    id: 'mirror',
    name: 'Mirror',
    desc: 'Copies other die effect at 50%',
    durability: 8,
    category: 'dice',
    rarity: 'uncommon',
    effect: 'mirror_copy',
  },
  {
    id: 'snake_eyes',
    name: 'Snake Eyes',
    desc: 'Sum=2 auto-wins',
    durability: 6,
    category: 'dice',
    rarity: 'rare',
    effect: 'snake_eyes_win',
  },
  {
    id: 'hustler',
    name: 'Hustler',
    desc: '3 wins with this die = free upgrade',
    durability: 5,
    category: 'dice',
    rarity: 'epic',
    effect: 'hustler_tracker',
  },
  {
    id: 'loaded_set',
    name: 'Loaded Set',
    desc: 'Paired: both faces get +1 skew',
    durability: 12,
    category: 'dice',
    rarity: 'uncommon',
    effect: 'loaded_skew',
    isPair: true,
  },
];

// ========== CRACKED STATE ================================================

/**
 * Effect applied when a die reaches 0 durability.
 * The die loses its special effect and has a 20% chance to deduct $2 on each roll.
 *
 * @type {{description: string, loseChance: number, loseAmount: number}}
 */
export const crackedEffect = {
  description: 'No special effect, 20% chance lose $2',
  loseChance: 0.20,
  loseAmount: 2,
};

// ========== LOOKUP HELPERS ================================================

/**
 * Look up a die type definition by its string id.
 *
 * @param {string} id — die type id (e.g. 'standard', 'weighted', 'glass')
 * @returns {object|null} the die type definition, or null if not found
 */
export function getDieType(id) {
  return DICE_TYPES.find(t => t.id === id) || null;
}

/**
 * Check whether a die state object is cracked (durability exhausted).
 * A cracked die has durability exactly 0.
 *
 * @param {{durability: number}} die — die state object with a durability field
 * @returns {boolean}
 */
export function isCracked(die) {
  return die.durability === 0;
}

/**
 * Generate the starting hand for a new roguelike run.
 * Always includes two standard dice, one weighted die, and one
 * random non-standard type.
 *
 * @returns {string[]} array of 4 die type ids
 */
export function getStartingHand() {
  const randomPool = DICE_TYPES.filter(t => t.id !== 'standard');
  const randomType = randomPool[Math.floor(Math.random() * randomPool.length)];
  return ['standard', 'standard', 'weighted', randomType.id];
}

// ========== DICE HAND CLASS ================================================

/**
 * Manages a 4-slot hand of dice for the roguelike mode.
 * Each slot holds a die type with its current durability and picked state.
 * Two dice slots are picked per roll; durability is consumed on the picked dice.
 *
 * @class DiceHand
 */
export class DiceHand {
  /**
   * Create a DiceHand with the given type ids.
   * @param {string[]} types — array of 4 die type ids
   */
  constructor(types) {
    this.reset(types);
  }

  /**
   * Reset all slots to fresh dice of the given types.
   * Clears picked state and resets durability to each type's default.
   *
   * @param {string[]} types — array of 4 die type ids
   */
  reset(types) {

    /**
     * Array of 4 slot objects.
     * @type {Array<{typeId: string, durability: number, picked: boolean}>}
     */
    this.slots = types.map(id => {
      const def = getDieType(id);
      return {
        typeId: id,
        durability: def ? def.durability : 0,
        picked: false,
      };
    });
  }

  /**
   * Read a slot by index without mutating state.
   *
   * @param {number} index — 0-based slot index
   * @returns {object|null} the slot object, or null if index out of bounds
   */
  getSlot(index) {
    return this.slots[index] || null;
  }

  /**
   * Pick a slot for the current roll.
   * At most 2 slots can be picked simultaneously.
   *
   * @param {number} index — 0-based slot index to pick
   * @returns {boolean} true if the pick was accepted, false otherwise
   */
  pickSlot(index) {
    if (index < 0 || index >= this.slots.length) return false;

    const alreadyPicked = this.slots.filter(s => s.picked).length;
    if (alreadyPicked >= 2) return false;

    this.slots[index].picked = true;
    return true;
  }

  /**
   * Get the currently picked dice with their full type definitions resolved.
   * @returns {Array<{id: string, name: string, durability: number, effect: string, category: string}>}
   */
  get pickedDice() {
    return this.slots
      .filter(s => s.picked)
      .map(s => {
        const def = getDieType(s.typeId);
        return def ? { ...def, durability: s.durability } : null;
      })
      .filter(Boolean);
  }

  /**
   * Get indices of all unpicked slots (available for picking).
   * @returns {number[]}
   */
  get availableSlots() {
    return this.slots
      .map((s, i) => (s.picked ? -1 : i))
      .filter(i => i !== -1);
  }

  /**
   * Replace the die in a slot with a new type (e.g. from a shop purchase).
   * Resets durability to the new type's default and clears the picked flag.
   *
   * @param {number} slotIndex — 0-based slot index to replace
   * @param {string} typeId — die type id to insert
   * @returns {boolean} true if replacement succeeded, false if invalid
   */
  replaceDie(slotIndex, typeId) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return false;
    const def = getDieType(typeId);
    if (!def) return false;

    this.slots[slotIndex] = {
      typeId,
      durability: def.durability,
      picked: false,
    };
    return true;
  }

  /**
   * Consume 1 durability from a picked die (indexed within picked dice, not full slots).
   * When durability reaches 0, the die becomes cracked.
   *
   * @param {number} dieIndex — index within the picked dice array, NOT the slot index
   * @returns {boolean} true if the die still has durability remaining, false if it just cracked or was already cracked
   */
  consumeDurability(dieIndex) {
    const picked = this.slots.filter(s => s.picked);
    if (dieIndex < 0 || dieIndex >= picked.length) return false;

    picked[dieIndex].durability = Math.max(0, picked[dieIndex].durability - 1);
    return picked[dieIndex].durability > 0;
  }
}
