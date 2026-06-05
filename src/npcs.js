const NPCS = [
  {
    id: 'larry', initials: 'L',
    name: 'Lucky Larry',
    color: '#4CAF50',
    bet: 5, money: 100,
    lines: {
      win: ['I knew it! Feeling lucky!', 'Told you, good vibes!', 'Right bettors get paid!', 'Another one for the good guys!'],
      loss: ['No worries, next one!', 'That\'s okay, gotta risk it!', 'Lady Luck\'s just warming up!'],
      point: ['Let\'s go! Set that point!', 'C\'mon shooter, we got this!', 'Point\'s on — time to work!'],
      made_point: ['BOOM! Told you!', 'Made it look easy!', 'That\'s how we do it!'],
      seven_out: ['Ah well, next shooter!', 'Tough break. New shooter energy!'],
      dead: ['Gotta hit the wall, shooter!', 'Take your time, aim it right!'],
    },
  },
  {
    id: 'sal', initials: 'S',
    name: 'Sal the Stat',
    color: '#2196F3',
    bet: 10, money: 100,
    lines: {
      win: ['Probability was in our favour.', 'I\'ll take the positive variance.', 'Statistically, it happens.', 'Expected value catches up.'],
      loss: ['House edge does its work.', 'That\'s the game. Expected value bites.', 'Variance giveth and taketh.'],
      point: ['Thirty-three percent chance, if you\'re counting.', 'Two ways to the point, six to seven.', 'The math says don\'t get your hopes up.'],
      made_point: ['Below expectation. But I\'ll take it.', 'P(hit) was low. Lucky.'],
      seven_out: ['Six ways to seven, two to four — simple arithmetic.', 'Called it. Seven is the most probable roll.'],
      dead: ['That\'s not how dice work.', 'Zero percent chance from there.'],
    },
  },
  {
    id: 'mike', initials: 'M',
    name: 'Big Mike',
    color: '#FF5722',
    bet: 20, money: 200,
    lines: {
      win: ['YEAH! Pay that man!', 'That\'s what I\'m talking about!', 'EASY money!', 'Who\'s next? Let\'s go!'],
      loss: ['You gotta be kidding me!', 'Unbelievable!', 'These dice are cursed!'],
      point: ['Set the number! Let\'s GO!', 'We got a point, lock it in!', 'C\'mon baby, one more time!'],
      made_point: ['BOOM! Right there!', 'THAT\'S how you do it!', 'Money in the pocket!'],
      seven_out: ['EVERY. DAMN. TIME.', 'I\'m out. Nah, I\'m back. Let\'s go again!'],
      dead: ['Hit the WALL! It\'s not that hard!', 'Aim for the bricks!'],
    },
  },
  {
    id: 'ruth', initials: 'R',
    name: 'Old Ruth',
    color: '#9C27B0',
    bet: 3, money: 80,
    lines: {
      win: ['Nice roll, dear.', 'There we go.', 'Good ones come in bunches.'],
      loss: ['That\'s the game, sweetheart.', 'Shake it off.', 'Can\'t win \'em all.'],
      point: ['Patience now. Good things.', 'Steady does it.', 'We got time.'],
      made_point: ['See? Patience pays.', 'Good things come to those who wait.', 'Told you, dear.'],
      seven_out: ['Next time, sugar.', 'That\'s why they call it gambling.', 'Dice don\'t owe you nothin\'.'],
      dead: ['Take your time, honey.', 'Aim steady, don\'t rush it.'],
    },
  },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class NPCPool {
  constructor() {
    this.npcs = NPCS.map(def => ({
      ...def,
      lines: { ...def.lines },
      _showTimer: null,
      bubble: null,
    }));
  }

  placeBets() {
    this.totalBet = 0;
    for (const npc of this.npcs) {
      const stake = Math.min(npc.bet, npc.money);
      if (stake > 0) {
        npc.money -= stake;
        this.totalBet += stake;
      }
    }
  }

  settle(result, sum, point) {
    for (const npc of this.npcs) {
      if (result === 'win') {
        npc.money += npc.bet * 2;
      }
      // loss: bet already deducted, no payout
    }
  }

  getBubble(npcId) {
    return this.npcs.find(n => n.id === npcId)?.bubble || null;
  }

  speak(npcId, event, force) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return;
    if (!force && Math.random() < 0.4) return;
    const pool = npc.lines[event];
    if (!pool) return;
    const line = pick(pool);
    npc.bubble = line;
    if (npc._showTimer) clearTimeout(npc._showTimer);
    npc._showTimer = setTimeout(() => { npc.bubble = null; }, 4500);
  }

  reactAll(event) {
    for (const npc of this.npcs) {
      this.speak(npc.id, event);
    }
  }

  reset() {
    this.npcs = NPCS.map(def => ({
      ...def,
      lines: { ...def.lines },
      _showTimer: null,
      bubble: null,
    }));
  }
}
