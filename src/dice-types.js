/**
 * dice-types.js — Die type catalog and DiceHand state machine for crapser
 *
 * Defines 12 die types across 4 categories (safe, calculated_risk, gambling,
 * build_around), each with durability tracking and a cracked state. The DiceHand
 * class manages a 4-slot hand with locked slots for table-scope dice locking.
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
  // ===== SAFE (2) =====================================================
  {
    id: 'house_bones',
    name: 'House Bones',
    durability: 15,
    effect: 'Immune to cracked penalties — never loses money',
    category: 'safe',
  },
  {
    id: 'witness',
    name: 'Witness',
    durability: 10,
    effect: 'Reveals opponent die face before roll (shows predicted value)',
    category: 'safe',
  },

  // ===== CALCULATED RISK (4) =========================================
  {
    id: 'glass',
    name: 'Glass',
    durability: 4,
    effect: 'Win pays 2.5x, but shatters (cracks) on loss',
    category: 'calculated_risk',
  },
  {
    id: 'volatile',
    name: 'Volatile',
    durability: 8,
    effect: 'Win +50% bonus payout, Loss −25% penalty',
    category: 'calculated_risk',
  },
  {
    id: 'cursed_13',
    name: 'Cursed 13',
    durability: 12,
    effect: 'Win costs ₡1, Loss pays ₡1 — reversed stakes',
    category: 'calculated_risk',
  },
  {
    id: 'loaded_set',
    name: 'Loaded Set',
    durability: 10,
    effect: 'Paired: both dice get +1 face skew (clamped to 6)',
    category: 'calculated_risk',
    isPair: true,
  },

  // ===== GAMBLING (2) ================================================
  {
    id: 'snake_eyes',
    name: 'Snake Eyes',
    durability: 6,
    effect: 'Sum=2 auto-wins on ANY phase (not just come-out)',
    category: 'gambling',
  },
  {
    id: 'doom',
    name: 'Doom d20',
    durability: 3,
    effect: 'Rolls d20: 1=bust, 20=table clear, 2-19 modifies sum',
    category: 'gambling',
  },

  // ===== BUILD-AROUND (4) ============================================
  {
    id: 'debt',
    name: 'Debt',
    durability: 12,
    effect: 'Owe ₡1 per roll; pays ₡5 on table clear. Debt accumulates.',
    category: 'build_around',
  },
  {
    id: 'vengeance',
    name: 'Vengeance',
    durability: 8,
    effect: '+1 damage per cracked die in hand (adds to dice sum)',
    category: 'build_around',
  },
  {
    id: 'pyre',
    name: 'Pyre',
    durability: 5,
    effect: '5% chance instant table clear, 95% lose ₡2',
    category: 'build_around',
  },
  {
    id: 'split',
    name: 'Split',
    durability: 10,
    effect: 'Both dice values count independently for payout (each treated as separate bet)',
    category: 'build_around',
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
  description: 'No special effect, 20% chance lose ₡1',
  loseChance: 0.2,
  loseAmount: 1,
};

// ========== LOOKUP HELPERS ================================================

/**
 * Look up a die type definition by its string id.
 *
 * @param {string} id — die type id (e.g. 'house_bones', 'glass', 'snake_eyes')
 * @returns {object|null} the die type definition, or null if not found
 */
export function getDieType(id) {
  return DICE_TYPES.find((t) => t.id === id) || null;
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
 * Always includes House Bones and Witness (safe dice), plus two
 * random non-safe types from the remaining pool.
 *
 * @returns {string[]} array of 4 die type ids
 */
export function getStartingHand() {
  const nonSafe = DICE_TYPES.filter((t) => t.category !== 'safe');
  const r1 = nonSafe[Math.floor(Math.random() * nonSafe.length)];
  const r2 = nonSafe[Math.floor(Math.random() * nonSafe.length)];
  return ['house_bones', 'witness', r1.id, r2.id];
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
    this.lockedSlots = new Set();
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
    this.slots = types.map((id) => {
      const def = getDieType(id);
      return {
        typeId: id,
        durability: def ? def.durability : 0,
        picked: false,
        hustlerWins: 0,
      };
    });
    this.lockedSlots.clear();
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
   * Lock a slot so its die is auto-picked every roll for the table's duration.
   * Locked dice cannot be swapped and persist across die replacements.
   *
   * @param {number} index — 0-based slot index to lock
   * @returns {boolean} true if locked, false if invalid or already picked
   */
  lockSlot(index) {
    if (index < 0 || index >= this.slots.length) return false;
    if (this.slots[index].picked) return false;
    this.lockedSlots.add(index);
    return true;
  }

  /**
   * Remove a slot from the locked set.
   *
   * @param {number} index — 0-based slot index to unlock
   * @returns {boolean} true if the slot was removed, false if it wasn't locked
   */
  unlockSlot(index) {
    return this.lockedSlots.delete(index);
  }

  /**
   * Get all currently locked slot indices as an array.
   * @returns {number[]}
   */
  get lockedSlotsArray() {
    return [...this.lockedSlots];
  }

  /**
   * Lock exactly 2 slots for the duration of a table.
   * Clears any existing locks before applying the new ones.
   *
   * @param {number[]} slotIndices — array of exactly 2 slot indices to lock
   * @returns {boolean} true if both slots were locked, false on invalid input
   */
  lockSlotsForTable(slotIndices) {
    if (!Array.isArray(slotIndices) || slotIndices.length !== 2) return false;
    this.lockedSlots.clear();
    for (const i of slotIndices) {
      if (i < 0 || i >= this.slots.length) return false;
      this.lockedSlots.add(i);
    }
    return true;
  }

  /**
   * Auto-pick all locked slots at the start of a new roll.
   * Clears existing picked state first, then marks locked slots as picked.
   *
   * @returns {number} number of slots that were auto-picked
   */
  autoPickLocked() {
    for (const slot of this.slots) slot.picked = false;
    let picked = 0;
    for (const idx of this.lockedSlots) {
      if (idx >= 0 && idx < this.slots.length && picked < 2) {
        this.slots[idx].picked = true;
        picked++;
      }
    }
    return picked;
  }

  /**
   * Pick a slot for the current roll.
   * At most 2 slots can be picked simultaneously.
   * Locked slots are auto-picked first if they aren't already picked.
   *
   * @param {number} index — 0-based slot index to pick
   * @returns {boolean} true if the pick was accepted, false otherwise
   */
  pickSlot(index) {
    if (index < 0 || index >= this.slots.length) return false;

    const alreadyPicked = this.slots.filter((s) => s.picked).length;
    if (alreadyPicked >= 2) return false;

    // Auto-pick locked slots first if they aren't picked yet
    for (const lockedIdx of this.lockedSlots) {
      if (!this.slots[lockedIdx].picked && this.slots.filter((s) => s.picked).length < 2) {
        this.slots[lockedIdx].picked = true;
      }
    }

    // If we now have 2 picked, reject the manual pick unless it was a locked slot
    const nowPicked = this.slots.filter((s) => s.picked).length;
    if (nowPicked >= 2) return this.lockedSlots.has(index) && this.slots[index].picked;

    this.slots[index].picked = true;
    return true;
  }

  /**
   * Get the currently picked dice with their full type definitions resolved.
   * @returns {Array<{id: string, name: string, durability: number, effect: string, category: string}>}
   */
  get pickedDice() {
    return this.slots
      .filter((s) => s.picked)
      .map((s) => {
        const def = getDieType(s.typeId);
        return def ? { ...def, durability: s.durability } : null;
      })
      .filter(Boolean);
  }

  /**
   * Get indices of all unpicked and unlocked slots (available for manual picking).
   * Locked slots are excluded since they are auto-managed.
   * @returns {number[]}
   */
  get availableSlots() {
    return this.slots
      .map((s, i) => {
        if (s.picked) return -1;
        if (this.lockedSlots.has(i)) return -1;
        return i;
      })
      .filter((i) => i !== -1);
  }

  /**
   * Replace the die in a slot with a new type (e.g. from a shop purchase).
   * Resets durability to the new type's default. The lock persists across
   * replacements — if the slot is locked the new die is auto-picked.
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
      picked: this.lockedSlots.has(slotIndex),
      hustlerWins: 0,
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
    const picked = this.slots.filter((s) => s.picked);
    if (dieIndex < 0 || dieIndex >= picked.length) return false;

    picked[dieIndex].durability = Math.max(0, picked[dieIndex].durability - 1);
    return picked[dieIndex].durability > 0;
  }
}
