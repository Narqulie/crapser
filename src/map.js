/**
 * map.js — Roguelike map navigation system (3 acts × 3 floors × 2–4 nodes)
 *
 * Replaces the old linear TABLE_CONFIGS progression with a player-chosen
 * node navigation system. Each act has 3 floors; each floor contains 2–4
 * nodes of varying types (table, boss, shop, mystery, rest). Players pick
 * one node per floor visit; clearing a boss advances to the next act.
 *
 * ## Node Types
 * - **table**: Standard craps table with money target and optional trait
 * - **boss**: Boss fight table — clearing it advances to the next act
 *   (RUN_WON after Act 3 boss)
 * - **shop**: Instant shop interaction with 1–2 NPCs
 * - **mystery**: Random event — could be +₡12, -₡10, free upgrade, or cracked die
 * - **rest**: Restore 2 durability to all dice + ₡5 bonus
 *
 * ## Act Structure
 * - Act 1: The Back Alleys (Dive Bar District → Warehouse Row → The Vault)
 * - Act 2: The Underground (Smoke-Filled Dens → The Switch → Deep Below)
 * - Act 3: The House (Marble Halls → Velvet Ropes → The Penthouse)
 *
 * The inner game loop (BETTING→DICE_PICK→ROLLING→RESOLVE→PICKING) is
 * unchanged. Only the outer progression loop is replaced: after clearing
 * a node, the player returns to MAP_NAV to choose the next one.
 *
 * @module map
 */

// ========== NODE TYPE DEFINITIONS =============================================

/**
 * Describes each node type's behavior: whether it hosts a craps game,
 * requires a money target, shows a boss visual, and its display properties.
 *
 * @type {Object<string, {label: string, icon: string, description: string,
 *   hasGame: boolean, hasTarget: boolean, isBoss: boolean}>}
 */
export const NODE_TYPES = {
  table: {
    label: 'Table',
    icon: '\u{1F3B2}', // game die
    description: 'Craps table — bet and roll to reach the money target',
    hasGame: true,
    hasTarget: true,
    isBoss: false,
  },
  boss: {
    label: 'Boss',
    icon: '\u2694\uFE0F', // crossed swords
    description: 'Boss table — higher stakes with a unique trait. Clearing it advances to the next act.',
    hasGame: true,
    hasTarget: true,
    isBoss: true,
  },
  shop: {
    label: 'Shop',
    icon: '\u{1F6D2}', // shopping cart
    description: 'Browse dice and items from an NPC vendor',
    hasGame: false,
    hasTarget: false,
    isBoss: false,
  },
  mystery: {
    label: 'Mystery',
    icon: '\u2753', // question mark
    description: 'Random event — reward, penalty, free upgrade, or cracked die',
    hasGame: false,
    hasTarget: false,
    isBoss: false,
  },
  rest: {
    label: 'Rest',
    icon: '\u{1F3E8}', // hotel
    description: 'Restore 2 durability to all dice and gain ₡5',
    hasGame: false,
    hasTarget: false,
    isBoss: false,
  },
};

// ========== MAP ACTS ==========================================================

/**
 * Complete map of all 3 acts with 3 floors each (~27 total nodes).
 * Each node has:
 * - `id`: unique string identifier
 * - `type`: one of `table`, `boss`, `shop`, `mystery`, `rest`
 * - `name`: display name
 * - `npc`: (table/shop) associated NPC id from NPC_DEFS
 * - `target`: (table/boss) money target required to clear
 * - `minBet`: (table/boss) minimum bet enforced at this node
 * - `trait`: (table/boss) trait id from TABLE_TRAITS to apply
 * - `visited`: set to `true` after the player completes the node
 *
 * @type {Array<{id: string, name: string, floors: Array<{
 *   id: string, name: string, nodes: Array<{
 *     id: string, type: string, name: string, npc?: string,
 *     target?: number, minBet?: number, trait?: string|null
 *   }>}>}>}
 */
export const MAP_ACTS = [
  {
    id: 'act_1', name: 'The Back Alleys', floors: [
      {
        id: 'floor_1_1', name: 'Dive Bar District', nodes: [
          { id: 'alley_mike', type: 'table', name: "Mike's Back Alley", npc: 'mike', target: 30, trait: null },
          { id: 'alley_sal', type: 'table', name: "Sal's Side Game", npc: 'sal', target: 40, minBet: 2, trait: null },
          { id: 'alley_mystery', type: 'mystery', name: 'Lucky Break' },
        ],
      },
      {
        id: 'floor_1_2', name: 'Warehouse Row', nodes: [
          { id: 'alley_diane', type: 'table', name: "Diane's Table", npc: 'diane', target: 40, minBet: 3, trait: null },
          { id: 'alley_nick', type: 'shop', name: "Nick's Bargain Bin", npc: 'nick' },
          { id: 'alley_ruth', type: 'table', name: "Ruth's Back Room", npc: 'ruth', target: 50, trait: 'slippery' },
        ],
      },
      {
        id: 'floor_1_3', name: 'The Vault', nodes: [
          { id: 'alley_boss', type: 'boss', name: 'The Vault Keeper', npc: 'ruth', target: 70, trait: 'boss' },
        ],
      },
    ],
  },
  {
    id: 'act_2', name: 'The Underground', floors: [
      {
        id: 'floor_2_1', name: 'Smoke-Filled Dens', nodes: [
          { id: 'ug_mike', type: 'table', name: "Mike's High Stakes", npc: 'mike', target: 60, minBet: 5, trait: null },
          { id: 'ug_sal', type: 'table', name: "Sal's Rigged Setup", npc: 'sal', target: 70, minBet: 5, trait: 'crooked' },
          { id: 'ug_rest', type: 'rest', name: 'Back Room Breather' },
        ],
      },
      {
        id: 'floor_2_2', name: 'The Switch', nodes: [
          { id: 'ug_diane', type: 'shop', name: "Diane's Dice Emporium", npc: 'diane' },
          { id: 'ug_larry', type: 'table', name: "Larry's Loan Game", npc: 'larry', target: 80, minBet: 6, trait: null },
          { id: 'ug_mystery', type: 'mystery', name: 'Whisper in the Dark' },
        ],
      },
      {
        id: 'floor_2_3', name: 'Deep Below', nodes: [
          { id: 'ug_boss', type: 'boss', name: 'The Pit Boss', npc: 'mike', target: 100, trait: 'boss' },
        ],
      },
    ],
  },
  {
    id: 'act_3', name: 'The House', floors: [
      {
        id: 'floor_3_1', name: 'Marble Halls', nodes: [
          { id: 'house_sal', type: 'table', name: "Sal's Final Table", npc: 'sal', target: 100, minBet: 8, trait: null },
          { id: 'house_mystery', type: 'mystery', name: 'The Vault Key' },
          { id: 'house_diane', type: 'table', name: "Diane's Last Stand", npc: 'diane', target: 120, minBet: 10, trait: 'slippery' },
        ],
      },
      {
        id: 'floor_3_2', name: 'Velvet Ropes', nodes: [
          { id: 'house_larry', type: 'shop', name: "Larry's Final Goods", npc: 'larry' },
          { id: 'house_mike', type: 'table', name: "Mike's All-In", npc: 'mike', target: 140, minBet: 12, trait: 'crooked' },
          { id: 'house_ruth', type: 'table', name: "Ruth's Insurance Policy", npc: 'ruth', target: 160, minBet: 15, trait: 'high_stakes' },
        ],
      },
      {
        id: 'floor_3_3', name: 'The Penthouse', nodes: [
          { id: 'house_boss', type: 'boss', name: 'The House', npc: 'ruth', target: 200, trait: 'boss' },
        ],
      },
    ],
  },
];

// ========== HELPER FUNCTIONS ==================================================

/**
 * Find a node by its unique id across all acts and floors.
 * Returns `undefined` if no node matches.
 *
 * @param {Array} mapActs — the MAP_ACTS array (or compatible structure)
 * @param {string} nodeId  — unique node identifier (e.g. 'alley_mike')
 * @returns {object|undefined} the node object, or undefined if not found
 */
export function getNode(mapActs, nodeId) {
  for (const act of mapActs) {
    for (const floor of act.floors) {
      const node = floor.nodes.find(n => n.id === nodeId);
      if (node) return node;
    }
  }
  return undefined;
}

/**
 * Get all nodes on a specific floor within an act.
 * Returns an empty array if indices are out of bounds.
 *
 * @param {Array} mapActs   — the MAP_ACTS array
 * @param {number} actIndex   — 0-based index of the act
 * @param {number} floorIndex — 0-based index of the floor within the act
 * @returns {Array<object>} the floor's nodes array, or empty array if not found
 */
export function getFloorNodes(mapActs, actIndex, floorIndex) {
  return mapActs[actIndex]?.floors[floorIndex]?.nodes ?? [];
}

/**
 * Determine the next available floor position after the given act/floor,
 * accounting for node completion state (nodes must have `visited: true`).
 *
 * - If any node on the current floor is unvisited, returns the same floor.
 * - If all nodes on the current floor are visited, advances to the next floor.
 * - If the current floor is the last in the act, advances to the next act's
 *   first floor (floor index 0).
 * - Returns `null` when all acts and floors are complete (run won).
 *
 * @param {Array} mapActs          — the MAP_ACTS array
 * @param {number} currentActIndex   — 0-based act index
 * @param {number} currentFloorIndex — 0-based floor index
 * @returns {{actIndex: number, floorIndex: number}|null}
 *   the next available position, or null if the entire map is complete
 */
export function getNextFloors(mapActs, currentActIndex, currentFloorIndex) {
  const act = mapActs[currentActIndex];
  if (!act) return null;

  const floor = act.floors[currentFloorIndex];
  if (!floor) return null;

  // Stay on current floor if any node is unvisited
  const allVisited = floor.nodes.every(n => n.visited);
  if (!allVisited) {
    return { actIndex: currentActIndex, floorIndex: currentFloorIndex };
  }

  // Advance to next floor within the same act
  const nextFloor = currentFloorIndex + 1;
  if (nextFloor < act.floors.length) {
    return { actIndex: currentActIndex, floorIndex: nextFloor };
  }

  // Advance to the next act's first floor
  const nextAct = currentActIndex + 1;
  if (nextAct < mapActs.length) {
    return { actIndex: nextAct, floorIndex: 0 };
  }

  // Entire map complete
  return null;
}

/**
 * Check whether all boss nodes in an act have been visited (cleared).
 * Returns `false` if any boss node in the act is unvisited.
 *
 * @param {Array} mapActs  — the MAP_ACTS array
 * @param {number} actIndex  — 0-based act index
 * @returns {boolean} true if every boss node in the act has `visited: true`
 */
export function isActComplete(mapActs, actIndex) {
  const act = mapActs[actIndex];
  if (!act) return false;

  for (const floor of act.floors) {
    for (const node of floor.nodes) {
      if (node.type === 'boss' && !node.visited) return false;
    }
  }
  return true;
}

/**
 * Get the display name of an act by its index.
 * Returns `'Unknown'` if the index is out of bounds.
 *
 * @param {Array} mapActs — the MAP_ACTS array
 * @param {number} actIndex — 0-based act index
 * @returns {string} the act's name, or 'Unknown'
 */
export function getActName(mapActs, actIndex) {
  return mapActs[actIndex]?.name ?? 'Unknown';
}

/**
 * Get the display name of a floor within an act.
 * Returns `'Unknown'` if either index is out of bounds.
 *
 * @param {Array} mapActs   — the MAP_ACTS array
 * @param {number} actIndex   — 0-based act index
 * @param {number} floorIndex — 0-based floor index
 * @returns {string} the floor's name, or 'Unknown'
 */
export function getFloorName(mapActs, actIndex, floorIndex) {
  return mapActs[actIndex]?.floors[floorIndex]?.name ?? 'Unknown';
}
