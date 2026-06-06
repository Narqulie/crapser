// ============================================================
// announcer.js — Procedural Dice Commentary
// ============================================================
//
// Generates flavourful street-craps callouts for every roll.
// Maps 21 unique two-dice combos to ~60 colourful aliases
// and attaches context-appropriate phrases (come-out win,
// craps, point set, seven out, dead throw).
//
// All exports are pure utility functions — no state, no DOM,
// no side effects. Safe to call from anywhere in the game loop.

// ========== DICE-COMBO ALIASES ==========

/**
 * Maps sorted dice values ("low,high") to arrays of street-craps aliases.
 *
 * Covers all 21 unique two-d6 combos. Each entry has 1–5 nicknames;
 * a random one is selected on every roll for variety.
 *
 * @constant {Object<string, string[]>}
 *
 * @example
 *   COMBOS['1,1'] // → ['Snake Eyes', 'Aces', 'Loose Deuce', ...]
 *   COMBOS['5,6'] // → ['Yo-leven', 'Yo', 'Six Five No Jive']
 */
const COMBOS = {
  '1,1': ['Snake Eyes', 'Aces', 'Loose Deuce', 'Double Aces', 'Snickies'],
  '1,2': ['Ace Deuce', 'Tracy', 'Acey Deucy', 'Three Craps Three'],
  '1,3': ['Easy Four'],
  '2,2': ['Little Joe from Kokomo', 'Little Joe', 'Ballerina', 'Little Dick'],
  '1,4': ['Fever', 'Little Phoebe', 'No Field Five'],
  '2,3': ['Fever', 'Fever in the South'],
  '1,5': ['Easy Six'],
  '2,4': ['Easy Six'],
  '3,3': ['Jimmie Hicks', 'Jimmie Hicks from the Sticks', 'Sixty Days', 'Sice', 'Winner 6'],
  '1,6': ['Natural', 'Big Red', 'Seven Out'],
  '2,5': ['Natural', 'Big Red', 'Seven Out'],
  '3,4': ['Up Pops the Devil', 'Up Jumped the Devil', 'Six Ace'],
  '2,6': ['Easy Eight'],
  '3,5': ['Easy Eight'],
  '4,4': [
    'Eighter from Decatur',
    'Square Pair',
    'Ozzie and Harriet',
    'Mom and Dad',
    'Ada from Decatur',
  ],
  '3,6': ['Nine', 'Niner from Carolina', 'Old Mike'],
  '4,5': [
    'Jesse James',
    'Nina from Pasadena',
    'Nina at the Marina',
    'Centerfield Nine',
    'Railroad Nine',
  ],
  '4,6': ['Easy Ten'],
  '5,5': [
    'Big Dick',
    'Big Dick from Boston',
    'Dos Equis',
    'Puppy Paws',
    'Big John',
    'Pair of Sunflowers',
  ],
  '5,6': ['Yo-leven', 'Yo', 'Six Five No Jive'],
  '6,6': ['Boxcars', 'Midnight', 'Double-action Field Traction', '12 Craps 12'],
};

// ========== CONTEXT PHRASES ==========

/**
 * Situational callout phrases keyed by game event type.
 *
 * Each event maps to 3–4 short phrases. One is randomly picked and
 * appended after the dice alias to give the announcement context
 * (e.g. "Snake Eyes! Craps! Better luck, shooter!").
 *
 * @constant {Object<string, string[]>}
 */
const CONTEXT_CALLS = {
  comeout_win: [
    'Front line winner!',
    'Pay the line!',
    'Winner, winner!',
    'Take the money!',
    'Right bettors get paid!',
  ],
  comeout_craps: ['Craps!', 'Better luck, shooter!', "Don't bettors take the money!"],
  point_set: ['Point is on!', 'We got a point!', 'And the betting opens!'],
  point_made: [
    'Made the point!',
    "That's a winner!",
    'Pay the line!',
    'Money for the right bettors!',
  ],
  seven_out: ['Seven out!', "That's a loser!", "Take the don'ts!", 'Dice are coming through!'],
  dead: [
    'No roll!',
    "Didn't reach the back wall!",
    'Gotta hit the wall, shooter!',
    'Dead throw, try again!',
  ],
};

// ========== PUBLIC API ==========

/**
 * Pick a random element from an array.
 *
 * @param {Array} arr — any array.
 * @returns {*} a randomly selected element from `arr`.
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a full-street-craps announcement for a landed roll.
 *
 * Selects a random alias for the dice combo, then chooses a
 * context-appropriate follow-up phrase based on `result` and `point`.
 *
 * @param {number} d1     — face value of first die (1–6).
 * @param {number} d2     — face value of second die (1–6).
 * @param {number} sum    — total of d1 + d2.
 * @param {string} result — game result: 'win' | 'loss' | 'point'.
 * @param {number} [point] — current point (only used for point-made check).
 * @returns {string} a human-readable announcement, e.g.
 *                   `"Snake Eyes! Craps! Better luck, shooter!"`
 */
export function callAnnouncement(d1, d2, sum, result, point) {
  const key = `${Math.min(d1, d2)},${Math.max(d1, d2)}`;
  const names = COMBOS[key] || [`${sum}`];
  let name = pick(names);

  if (result === 'win' && (sum === 7 || sum === 11)) {
    return `${name}! ${pick(CONTEXT_CALLS.comeout_win)}`;
  }

  if (result === 'loss' && (sum === 2 || sum === 3 || sum === 12)) {
    return `${name}! ${pick(CONTEXT_CALLS.comeout_craps)}`;
  }

  if (result === 'point') {
    return `${name}! ${pick(CONTEXT_CALLS.point_set)} ${sum}`;
  }

  if (result === 'win' && sum === point) {
    return `${name}! ${pick(CONTEXT_CALLS.point_made)}`;
  }

  if (result === 'loss' && sum === 7) {
    return `${name}! ${pick(CONTEXT_CALLS.seven_out)}`;
  }

  return `${name}!`;
}

/**
 * Return a random "dead throw" callout.
 *
 * Used when dice fail to hit the back wall (no-roll scenario).
 *
 * @returns {string} a dead-throw phrase, e.g. `"No roll!"`.
 */
export function callDead() {
  return pick(CONTEXT_CALLS.dead);
}
