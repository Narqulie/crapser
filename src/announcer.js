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
  '4,4': ['Eighter from Decatur', 'Square Pair', 'Ozzie and Harriet', 'Mom and Dad', 'Ada from Decatur'],
  '3,6': ['Nine', 'Niner from Carolina', 'Old Mike'],
  '4,5': ['Jesse James', 'Nina from Pasadena', 'Nina at the Marina', 'Centerfield Nine', 'Railroad Nine'],
  '4,6': ['Easy Ten'],
  '5,5': ['Big Dick', 'Big Dick from Boston', 'Dos Equis', 'Puppy Paws', 'Big John', 'Pair of Sunflowers'],
  '5,6': ['Yo-leven', 'Yo', 'Six Five No Jive'],
  '6,6': ['Boxcars', 'Midnight', 'Double-action Field Traction', '12 Craps 12'],
};

const CONTEXT_CALLS = {
  comeout_win: ['Front line winner!', 'Pay the line!', 'Winner, winner!', 'Take the money!', 'Right bettors get paid!'],
  comeout_craps: ['Craps!', 'Better luck, shooter!', 'Don\'t bettors take the money!'],
  point_set: ['Point is on!', 'We got a point!', 'And the betting opens!'],
  point_made: ['Made the point!', 'That\'s a winner!', 'Pay the line!', 'Money for the right bettors!'],
  seven_out: ['Seven out!', 'That\'s a loser!', 'Take the don\'ts!', 'Dice are coming through!'],
  dead: ['No roll!', 'Didn\'t reach the back wall!', 'Gotta hit the wall, shooter!', 'Dead throw, try again!'],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

export function callDead() {
  return pick(CONTEXT_CALLS.dead);
}
