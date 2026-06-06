/**
 * shop.js — NPC shop system with trust tiers, item catalog, and purchase logic
 *
 * Manages 6 NPC vendors (Mike, Sal, Diane, Larry, Ruth, Nick) each with unique
 * shop inventories. Items span 6 categories: one_shot, counter, passive, charges,
 * dice, and immediate. The trust system tracks total money spent per NPC across runs
 * (persisted via MetaProgress), unlocking higher rarities and granting discounts at
 * 5 trust tiers (Stranger → Family).
 *
 * Dice-category items replace dice in the player's DiceHand rather than going into
 * the activeUpgrades Map.
 *
 * @module shop
 */

import { UPGRADES } from './upgrades.js';

// ========== TRUST SYSTEM ====================================================

/**
 * Trust tier definitions. As total money spent with an NPC increases,
 * the player unlocks higher tiers with better discounts and rarer items.
 *
 * @type {Array<{level: number, name: string, threshold: number, discount: number, unlocks: string[]}>}
 */
const TRUST_TABLE = [
  { level: 1, name: 'Stranger', threshold: 0,    discount: 0,    unlocks: ['common', 'uncommon'] },
  { level: 2, name: 'Regular',  threshold: 20,   discount: 0.10, unlocks: ['common', 'uncommon', 'rare'] },
  { level: 3, name: 'Friend',   threshold: 100,  discount: 0.15, unlocks: ['common', 'uncommon', 'rare'] },
  { level: 4, name: 'Partner',  threshold: 300,  discount: 0.20, unlocks: ['common', 'uncommon', 'rare', 'epic'] },
  { level: 5, name: 'Family',   threshold: 1000, discount: 0.30, unlocks: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
];

/**
 * Per-level greeting messages displayed when entering an NPC's shop.
 * @type {Object<number, string>}
 */
const TRUST_GREETINGS = {
  1: 'Step right up.',
  2: 'Back for more?',
  3: 'Good to see you, friend.',
  4: 'Now we\'re talking!',
  5: 'Family gets the good stuff.',
};

// ========== SHOP ITEM CATALOG ===============================================

/**
 * Complete catalog of all purchasable shop items.
 * Organized by NPC vendor. Items have categories, rarities, trust requirements,
 * and cost expressed as a percentage of the current table target.
 *
 * Categories:
 *   one_shot  — consumable, stored in activeUpgrades Map with maxCharges
 *   counter   — consumable with multiple uses before depletion
 *   passive   — permanent effect (charge = -1)
 *   charges   — consumable with multiple uses
 *   dice      — replaces a die in the player's DiceHand
 *   immediate — applied at purchase time, not stored in activeUpgrades
 *
 * @type {Array<{
 *   id: string, name: string, npcId: string, category: string,
 *   rarity: string, trustRequired: number, costPct: number,
 *   desc: string, maxCharges: number, stubbed: boolean,
 *   descStubbed: string, diceTypeId?: string
 * }>}
 */
export const SHOP_ITEMS = [
  // ═══════════════════════════════════════════════════════════
  // ─── MIKE — Risk Shop ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'double_boost',
    name: 'Double Boost',
    npcId: 'mike',
    category: 'one_shot',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.45,
    desc: 'Next win pays 3x instead of 2x',
    maxCharges: 1,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'all_in_token',
    name: 'All-In Token',
    npcId: 'mike',
    category: 'one_shot',
    rarity: 'epic',
    trustRequired: 4,
    costPct: 0.60,
    desc: 'Next win doubles your entire bankroll',
    maxCharges: 1,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── SAL — Math Shop ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'ev_display',
    name: 'EV Display',
    npcId: 'sal',
    category: 'passive',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.15,
    desc: 'HUD shows win probability for next point attempt',
    maxCharges: -1,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'prob_shield',
    name: 'Probability Shield',
    npcId: 'sal',
    category: 'counter',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.35,
    desc: 'Next 3 point-phase 7-outs refund your bet and stay in POINT',
    maxCharges: 3,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── DIANE — Dice Shop ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'crosshair',
    name: 'Crosshair',
    npcId: 'diane',
    category: 'counter',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.30,
    desc: 'Next 5 dead throws become valid throws (auto-redirect)',
    maxCharges: 5,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── LARRY — Charm Shop ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'rabbits_foot',
    name: 'Rabbit\'s Foot',
    npcId: 'larry',
    category: 'one_shot',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.15,
    desc: '12% chance to convert any non-win roll into a win (refund + payout)',
    maxCharges: 1,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    npcId: 'larry',
    category: 'charges',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.20,
    desc: 'On win, 50% chance to double payout (3 uses)',
    maxCharges: 3,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'charm_refill',
    name: 'Charm Refill',
    npcId: 'larry',
    category: 'immediate',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.15,
    desc: 'Add 2 charges to a charm upgrade you already own',
    maxCharges: 0,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'reroll_token',
    name: 'Reroll Token',
    npcId: 'larry',
    category: 'immediate',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.25,
    desc: '+1 reroll token for upgrade picks',
    maxCharges: 0,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── RUTH — Insurance Shop ────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'interest_shop',
    name: 'Interest',
    npcId: 'ruth',
    category: 'passive',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.20,
    desc: 'Earn 5% interest on your money after every resolved hand',
    maxCharges: -1,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'safety_net',
    name: 'Safety Net',
    npcId: 'ruth',
    category: 'counter',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.25,
    desc: 'Next 3 losses refund half your bet',
    maxCharges: 3,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'patience_shop',
    name: 'Patience',
    npcId: 'ruth',
    category: 'passive',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.10,
    desc: 'Settle threshold relaxed: V_THRESHOLD 0.08→0.06, SETTLE_TIMEOUT 3s→5s',
    maxCharges: -1,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── NICK — Bargain Bin ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'used_charm',
    name: 'Used Charm',
    npcId: 'nick',
    category: 'immediate',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.10,
    desc: 'Grants a random charm upgrade with 1 charge — 15% chance it fizzles',
    maxCharges: 0,
    stubbed: false,
    descStubbed: '',
  },
  {
    id: 'mystery_box',
    name: 'Mystery Box',
    npcId: 'nick',
    category: 'immediate',
    rarity: 'rare',
    trustRequired: 1,
    costPct: 0.20,
    desc: 'Grants a random non-stubbed shop item from any vendor',
    maxCharges: 0,
    stubbed: false,
    descStubbed: '',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── DICE HAND ITEMS (replace dice in DiceHand) ───────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'volatile_die',
    name: 'Volatile Die',
    npcId: 'mike',
    category: 'dice',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.20,
    desc: 'Win +50% payout, Loss -25%. Durability 6',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'volatile',
  },
  {
    id: 'glass_dice',
    name: 'Glass Dice',
    npcId: 'diane',
    category: 'dice',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.40,
    desc: 'Win 2.5x, shatters on loss. Durability 3',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'glass',
  },

  // ═══════════════════════════════════════════════════════════
  // ─── NEW DICE TYPES (Wave 3) ──────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'cursed_die',
    name: 'Cursed 13',
    npcId: 'mike',
    category: 'dice',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.20,
    desc: 'Win costs ₡1, loss pays ₡1 — purple elder-wood',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'cursed_13',
  },
  {
    id: 'snake_eyes_die',
    name: 'Snake Eyes',
    npcId: 'nick',
    category: 'dice',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.22,
    desc: 'Sum-of-2 auto-wins — cyan-laced bone',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'snake_eyes',
  },
  {
    id: 'loaded_set',
    name: 'Loaded Set',
    npcId: 'diane',
    category: 'dice',
    rarity: 'uncommon',
    trustRequired: 1,
    costPct: 0.28,
    desc: 'Paired: both faces skew +1 — weighted pair',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'loaded_set',
    isPair: true,
  },
  // ═══════════════════════════════════════════════════════════
  // ─── NEW DICE TYPES (Sprint C) ────────────────────────────
  // ═══════════════════════════════════════════════════════════
  {
    id: 'die_house_bones',
    name: 'House Bones',
    npcId: 'diane',
    category: 'dice',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.15,
    desc: 'Immune to cracked penalties — never loses money. Safe starter. Durability 15',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'house_bones',
  },
  {
    id: 'die_witness',
    name: 'Witness',
    npcId: 'sal',
    category: 'dice',
    rarity: 'common',
    trustRequired: 1,
    costPct: 0.18,
    desc: 'Reveals opponent die face before roll — strategic intel. Durability 10',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'witness',
  },
  {
    id: 'die_doom',
    name: 'Doom d20',
    npcId: 'mike',
    category: 'dice',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.35,
    desc: 'Rolls d20: 1=bust, 20=table clear. Extreme risk. Durability 3',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'doom',
  },
  {
    id: 'die_debt',
    name: 'Debt Die',
    npcId: 'ruth',
    category: 'dice',
    rarity: 'uncommon',
    trustRequired: 1,
    costPct: 0.25,
    desc: 'Owe ₡1 per roll; pays ₡5 on table clear. Debt accumulates. Durability 12',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'debt',
  },
  {
    id: 'die_vengeance',
    name: 'Vengeance',
    npcId: 'mike',
    category: 'dice',
    rarity: 'uncommon',
    trustRequired: 1,
    costPct: 0.25,
    desc: '+1 damage per cracked die in hand (adds to dice sum). Durability 8',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'vengeance',
  },
  {
    id: 'die_pyre',
    name: 'Pyre',
    npcId: 'larry',
    category: 'dice',
    rarity: 'rare',
    trustRequired: 2,
    costPct: 0.30,
    desc: '5% chance instant table clear, 95% lose ₡2. All or nothing. Durability 5',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'pyre',
  },
  {
    id: 'die_split',
    name: 'Split Die',
    npcId: 'sal',
    category: 'dice',
    rarity: 'uncommon',
    trustRequired: 2,
    costPct: 0.28,
    desc: 'Each die counts independently for payout — double-edged. Durability 10',
    stubbed: false,
    descStubbed: '',
    diceTypeId: 'split',
  },
];

// ========== PURE CALCULATION HELPERS ========================================

/** Get the trust tier entry for a given total spent */
export function getTrustEntry(totalSpent) {
  let entry = TRUST_TABLE[0];
  for (let i = TRUST_TABLE.length - 1; i >= 0; i--) {
    if (totalSpent >= TRUST_TABLE[i].threshold) {
      entry = TRUST_TABLE[i];
      break;
    }
  }
  return entry;
}

/** Calculate item cost: floor(tableTarget × costPct × (1 − trustDiscount)) */
export function calcItemCost(item, tableTarget, trustDiscount) {
  return Math.floor(tableTarget * item.costPct * (1 - trustDiscount));
}

/** Filter shop items by NPC and trust-unlocked rarities */
export function filterInventory(npcId, unlockedRarities) {
  const raritySet = new Set(unlockedRarities);
  return SHOP_ITEMS.filter(
    (item) => item.npcId === npcId && raritySet.has(item.rarity)
  );
}

// ========== SHOP SYSTEM CLASS ===============================================

export class ShopSystem {
  /**
   * @param {import('./meta-progress.js').MetaProgress} metaProgress — MetaProgress instance for trust persistence
   */
  constructor(metaProgress) {
    this.meta = metaProgress;
  }

  /** Get the current trust tier (1-5) for an NPC */
  getTrustLevel(npcId) {
    const total = this._getTrustTotal(npcId);
    return getTrustEntry(total).level;
  }

  /** Get the full trust entry for an NPC */
  _getTrustEntry(npcId) {
    const total = this._getTrustTotal(npcId);
    return getTrustEntry(total);
  }

  /** Read total spent with an NPC from meta persistence */
  _getTrustTotal(npcId) {
    if (!this.meta || !this.meta.data) return 0;
    if (!this.meta.data.npcTrust) return 0;
    return this.meta.data.npcTrust[npcId] || 0;
  }

  /** Add trust (money spent) to an NPC after a purchase. Persisted across runs. */
  addTrust(npcId, amount) {
    if (!this.meta || !this.meta.data) return;
    if (!this.meta.data.npcTrust) this.meta.data.npcTrust = {};
    this.meta.data.npcTrust[npcId] = (this.meta.data.npcTrust[npcId] || 0) + amount;
    this.meta.save();
  }

  /**
   * Get up to 4 randomly selected items available from an NPC at the current trust tier.
   * Items are filtered by the NPC's unlocked rarities, then shuffled.
   *
   * @param {string} npcId
   * @param {number} tableTarget — current table's money target (for cost calculation)
   * @returns {Array<object>}
   */
  getInventory(npcId, tableTarget) {
    const entry = this._getTrustEntry(npcId);
    const candidates = filterInventory(npcId, entry.unlocks);

    // Return up to 4 items, randomly shuffled
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }

  /**
   * Calculate the actual dollar cost of an item, factoring in table target scaling
   * and the NPC's trust discount.
   *
   * @param {object} item
   * @param {number} tableTarget
   * @returns {number}
   */
  getItemCost(item, tableTarget) {
    const entry = this._getTrustEntry(item.npcId);
    return calcItemCost(item, tableTarget, entry.discount);
  }

  /**
   * Check whether the player has enough money to afford an item.
   *
   * @param {number} money — player's current money
   * @param {object} item
   * @param {number} tableTarget
   * @returns {boolean}
   */
  canAfford(money, item, tableTarget) {
    return money >= this.getItemCost(item, tableTarget);
  }

  /**
   * Purchase an item: deduct money, apply effect, add trust.
   * @param {import('./rogue-run.js').RogueRun} rogueRun
   * @param {string} npcId
   * @param {string} itemId
   * @returns {{ success: true, moneyAfter: number, item: object }} |
   *          {{ success: false, reason: string }}
   */
  buy(rogueRun, npcId, itemId) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { success: false, reason: 'Item not found' };

    const tableTarget = rogueRun.getCurrentTable().target;
    const cost = this.getItemCost(item, tableTarget);

    if (rogueRun.game.money < cost) {
      return { success: false, reason: 'Not enough money' };
    }

    if (item.stubbed) {
      return { success: false, reason: item.descStubbed };
    }

    // Apply item effect BEFORE deducting money (may fail for charm_refill, dice hand full)
    const applyResult = this._applyItem(item, rogueRun);
    if (applyResult === false) {
      return { success: false, reason: 'No charms owned to refill' };
    }
    if (applyResult && applyResult.success === false) {
      return { success: false, reason: applyResult.reason || 'Purchase failed' };
    }

    // Deduct money after confirming success
    rogueRun.game.money -= cost;

    // Add trust
    this.addTrust(npcId, cost);

    const response = { success: true, moneyAfter: rogueRun.game.money, item };

    // Attach rolled/fizzled info for immediate items
    if (applyResult && typeof applyResult === 'object') {
      if (applyResult.fizzled) response.fizzled = true;
      if (applyResult.rolledId) response.rolledId = applyResult.rolledId;
      if (applyResult.rolledItem) response.rolledItem = applyResult.rolledItem;
    }

    return response;
  }

  /**
   * Select 1-2 random NPCs for a shop visit after clearing a table.
   * Lower-trust NPCs are weighted more heavily to encourage variety.
   * First 2 tables offer 1 shop, tables 3+ offer 2 shops.
   *
   * @param {number} tableIndex — current table index (0-based)
   * @returns {string[]} array of NPC ids
   */
  getShopsForClear(tableIndex) {
    const count = tableIndex < 2 ? 1 : 2;
    const allNpcIds = ['mike', 'sal', 'diane', 'larry', 'ruth', 'nick'];

    // Weight: lower trust = higher weight (to encourage variety)
    const weights = allNpcIds.map((id) => {
      const trustLevel = this.getTrustLevel(id);
      return 6 - trustLevel; // trust 1 → weight 5, trust 5 → weight 1
    });

    // Weighted random selection without replacement
    const selected = [];
    const available = [...allNpcIds];
    const availableWeights = [...weights];

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < availableWeights.length - 1; idx++) {
        r -= availableWeights[idx];
        if (r <= 0) break;
      }
      selected.push(available[idx]);
      available.splice(idx, 1);
      availableWeights.splice(idx, 1);
    }

    return selected;
  }

  /**
   * Get the flavour greeting for an NPC based on current trust level.
   *
   * @param {string} npcId
   * @returns {string}
   */
  getGreeting(npcId) {
    const level = this.getTrustLevel(npcId);
    return TRUST_GREETINGS[level] || TRUST_GREETINGS[1];
  }

  // ========== INTERNAL =====================================================

  /**
   * Apply an item's effect to the rogueRun.
   * Returns false on failure, true/object on success.
   */
  _applyItem(item, rogueRun) {
    if (item.category === 'immediate') {
      return this._applyImmediate(item, rogueRun);
    }

    // dice category: goes into DiceHand, not activeUpgrades Map
    if (item.category === 'dice') {
      return this._applyDiceItem(item, rogueRun);
    }

    // one_shot, counter, passive, charges — all go into activeUpgrades Map
    rogueRun.activeUpgrades.set(item.id, item.maxCharges);
    return { success: true };
  }

  /**
   * Replace a die (or pair) in the DiceHand with a shop-purchased die.
   * Prefers replacing cracked dice (durability 0), then house bones (starter dice).
   * For isPair items, replaces TWO slots — both must be available.
   * Returns { success: false, reason } if hand is full or diceHand missing.
   */
  _applyDiceItem(item, rogueRun) {
    if (!rogueRun.diceHand) {
      return { success: false, reason: 'Dice hand not available' };
    }

    const diceHand = rogueRun.diceHand;
    const slots = diceHand.slots;
    const slotsNeeded = item.isPair ? 2 : 1;

    // Gather candidate slot indices: prefer cracked, then house bones, then same-type (for pairs)
    const candidates = [];

    // First pass: cracked slots
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].durability === 0) {
        candidates.push(i);
      }
    }

    // Second pass: house bones slots (only if we still need more)
    if (candidates.length < slotsNeeded) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].typeId === 'house_bones' && !candidates.includes(i)) {
          candidates.push(i);
          if (candidates.length >= slotsNeeded) break;
        }
      }
    }

    // Third pass (isPair only): existing same-type dice already in hand
    if (item.isPair && candidates.length < slotsNeeded) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].typeId === item.diceTypeId && !candidates.includes(i)) {
          candidates.push(i);
          if (candidates.length >= slotsNeeded) break;
        }
      }
    }

    // Fourth pass (isPair fallback): any non-cracked slot to complete the pair
    if (item.isPair && candidates.length < slotsNeeded) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].durability > 0 && !candidates.includes(i)) {
          candidates.push(i);
          if (candidates.length >= slotsNeeded) break;
        }
      }
    }

    // Not enough free slots
    if (candidates.length < slotsNeeded) {
      return { success: false, reason: item.isPair ? 'Need 2 free slots for loaded set' : 'Dice hand full' };
    }

    // Replace the target slot(s)
    const targets = candidates.slice(0, slotsNeeded);
    for (const slotIdx of targets) {
      const replaced = diceHand.replaceDie(slotIdx, item.diceTypeId);
      if (!replaced) {
        return { success: false, reason: 'Failed to add die to hand' };
      }
    }

    return { success: true };
  }

  /**
   * Apply an immediate-use item effect.
   * Returns false on failure, or an object with extra info.
   */
  _applyImmediate(item, rogueRun) {
    switch (item.id) {
      case 'charm_refill':
        return this._applyCharmRefill(rogueRun);

      case 'reroll_token':
        rogueRun.rerollTokens += 1;
        return { success: true };

      case 'used_charm':
        return this._applyUsedCharm(rogueRun);

      case 'mystery_box':
        return this._applyMysteryBox(rogueRun);

      default:
        return { success: true };
    }
  }

  /**
   * Add 2 charges to a randomly selected charm upgrade the player already owns.
   * Prefers charms with remaining charges; returns false if the player owns no charms.
   *
   * @param {import('./rogue-run.js').RogueRun} rogueRun
   * @returns {false|{success: boolean}}
   */
  _applyCharmRefill(rogueRun) {
    // Find charm-type upgrades the player owns in activeUpgrades
    const ownedCharms = Array.from(rogueRun.activeUpgrades.entries())
      .filter(([id]) => {
        const def = UPGRADES.find((u) => u.id === id);
        return def && def.category === 'charm';
      });

    if (ownedCharms.length === 0) return false;

    // Prefer charms that still have charges remaining
    const withCharges = ownedCharms.filter(([, c]) => c > 0);
    const pool = withCharges.length > 0 ? withCharges : ownedCharms;
    const [charmId, currentCharges] = pool[Math.floor(Math.random() * pool.length)];

    rogueRun.activeUpgrades.set(charmId, Math.max(currentCharges, 0) + 2);
    return { success: true };
  }

  /**
   * Grant a random charm upgrade with 1 charge. 15% chance it fizzles (no effect).
   *
   * @param {import('./rogue-run.js').RogueRun} rogueRun
   * @returns {{success: boolean, fizzled?: boolean, rolledId?: string, rolledItem?: object}}
   */
  _applyUsedCharm(rogueRun) {
    const charms = UPGRADES.filter((u) => u.category === 'charm');
    const rolled = charms[Math.floor(Math.random() * charms.length)];

    if (Math.random() < 0.15) {
      return { success: true, fizzled: true };
    }

    rogueRun.activeUpgrades.set(rolled.id, 1);
    return { success: true, rolledId: rolled.id, rolledItem: rolled };
  }

  /**
   * Grant a random non-stubbed shop item from any vendor (excluding self to prevent recursion).
   * The rolled item is applied via _applyItem, which handles its category automatically.
   *
   * @param {import('./rogue-run.js').RogueRun} rogueRun
   * @returns {{success: boolean, rolledId?: string, rolledItem?: object}}
   */
  _applyMysteryBox(rogueRun) {
    const candidates = SHOP_ITEMS.filter(
      (i) => !i.stubbed && i.id !== 'mystery_box'
    );
    if (candidates.length === 0) return { success: true };

    const rolled = candidates[Math.floor(Math.random() * candidates.length)];
    const subResult = this._applyItem(rolled, rogueRun);

    const didSucceed = subResult !== false && (!subResult || subResult.success !== false);

    return {
      success: didSucceed,
      rolledId: rolled.id,
      rolledItem: rolled,
    };
  }
}
