const NPCS = [
  {
    id: 'larry', initials: 'L',
    name: 'Lucky Larry',
    color: '#4CAF50',
    bet: 5, money: 100, participation: 0.8,
    lines: {
      win: ['I knew it! Feeling lucky!', 'Told you, good vibes!', 'Right bettors get paid!', 'Another one for the good guys!', 'Luck ain\'t luck — it\'s destiny!', 'Hah! Told you I had a good feeling!'],
      loss: ['No worries, next one!', 'That\'s okay, gotta risk it!', 'Lady Luck\'s just warming up!', 'Can\'t win \'em all, but we\'ll try!', 'She\'s just teasing us, that\'s all!'],
      point: ['Let\'s go! Set that point!', 'C\'mon shooter, we got this!', 'Point\'s on — time to work!', 'Alright, now the real game starts!', 'One number. That\'s all we need!'],
      made_point: ['BOOM! Told you!', 'Made it look easy!', 'That\'s how we do it!', 'Nailed it! Right on the money!', 'Like shooting fish in a barrel!'],
      seven_out: ['Ah well, next shooter!', 'Tough break. New shooter energy!', 'Shake it off — fresh start coming!', 'Seven waits for nobody.'],
      dead: ['Gotta hit the wall, shooter!', 'Take your time, aim it right!', 'Send it to the back!', 'That wall ain\'t gonna hit itself!'],
    },
  },
  {
    id: 'sal', initials: 'S',
    name: 'Sal the Stat',
    color: '#2196F3',
    bet: 10, money: 100, participation: 0.9,
    lines: {
      win: ['Probability was in our favour.', 'I\'ll take the positive variance.', 'Statistically, it happens.', 'Expected value catches up.', 'The numbers don\'t lie. Sometimes.', 'A win is a win is a win.'],
      loss: ['House edge does its work.', 'That\'s the game. Expected value bites.', 'Variance giveth and taketh.', 'Law of large numbers. One roll means nothing.', 'The math always wins in the end.'],
      point: ['Thirty-three percent chance, if you\'re counting.', 'Two ways to the point, six to seven.', 'The math says don\'t get your hopes up.', 'Historically, points get made about 40% of the time.', 'The odds are against us. Just so you know.'],
      made_point: ['Below expectation. But I\'ll take it.', 'P(hit) was low. Lucky.', 'That\'s a sub-40% outcome. Nice.', 'One for the underdogs of probability.'],
      seven_out: ['Six ways to seven, two to four — simple arithmetic.', 'Called it. Seven is the most probable roll.', 'Most likely outcome, statistically speaking.', 'Seven appears once every six rolls on average.'],
      dead: ['That\'s not how dice work.', 'Zero percent chance from there.', 'Physics doesn\'t care about your intentions.', 'The wall is there for a reason.'],
    },
  },
  {
    id: 'mike', initials: 'M',
    name: 'Big Mike',
    color: '#FF5722',
    bet: 20, money: 200, participation: 0.95,
    lines: {
      win: ['YEAH! Pay that man!', 'That\'s what I\'m talking about!', 'EASY money!', 'Who\'s next? Let\'s go!', 'PUT IT IN THE BOOKS!', 'That\'s how we ROLL baby!'],
      loss: ['You gotta be kidding me!', 'Unbelievable!', 'These dice are cursed!', 'NAH! Not buying it!', 'Somebody check those dice!', 'RIGGED! This whole table is rigged!'],
      point: ['Set the number! Let\'s GO!', 'We got a point, lock it in!', 'C\'mon baby, one more time!', 'POINT! Let\'s get to work!', 'EVERYBODY quiet — shooter\'s working!'],
      made_point: ['BOOM! Right there!', 'THAT\'S how you do it!', 'Money in the pocket!', 'BEAUTIFUL! Absolutely beautiful!', 'WHO\'S NEXT?!'],
      seven_out: ['EVERY. DAMN. TIME.', 'I\'m out. Nah, I\'m back. Let\'s go again!', 'Seven is the DEVIL\'S number!', 'I hate this game! ...deal me in.'],
      dead: ['Hit the WALL! It\'s not that hard!', 'Aim for the bricks!', 'THE WALL IS RIGHT THERE!', 'You gotta put some mustard on it!'],
    },
  },
  {
    id: 'ruth', initials: 'R',
    name: 'Old Ruth',
    color: '#9C27B0',
    bet: 3, money: 80, participation: 0.7,
    lines: {
      win: ['Nice roll, dear.', 'There we go.', 'Good ones come in bunches.', 'See? Patience pays.', 'That\'s the way it\'s supposed to go.', 'Mmm-hmm. Knew it.'],
      loss: ['That\'s the game, sweetheart.', 'Shake it off.', 'Can\'t win \'em all.', 'Dice are fickle creatures.', 'Been at this since before you were born. It happens.'],
      point: ['Patience now. Good things.', 'Steady does it.', 'We got time.', 'A point is just an invitation.', 'No rush, honey. The dice know what to do.'],
      made_point: ['See? Patience pays.', 'Good things come to those who wait.', 'Told you, dear.', 'Never doubted it for a second.', 'I\'ve seen this movie before. Happy ending.'],
      seven_out: ['Next time, sugar.', 'That\'s why they call it gambling.', 'Dice don\'t owe you nothin\'.', 'Seven comes for everybody eventually.', 'That\'s gambling. Dust yourself off.'],
      dead: ['Take your time, honey.', 'Aim steady, don\'t rush it.', 'The wall isn\'t going anywhere.', 'Breathe first, throw second.'],
    },
  },
  {
    id: 'nick', initials: 'N',
    name: 'Nervous Nick',
    color: '#FF9800',
    bet: 2, money: 60, participation: 0.5,
    lines: {
      win: ['Oh! Oh wow! We won!', 'I didn\'t expect that!', 'That\'s... that\'s good, right?', 'Okay okay okay, we\'re doing great!', 'Is that enough to quit while we\'re ahead?'],
      loss: ['Called it. I knew it.', 'That\'s it, we\'re doomed.', 'I have a bad feeling about this.', 'Should\'ve walked away when we had the chance.', 'My palms are sweating.'],
      point: ['A point? What does that mean? Is that bad?', 'Oh boy, oh boy, oh boy...', 'How do you make a point again? I always forget.', 'I don\'t like this part. The waiting is worse.', 'Can we just skip to the end?'],
      made_point: ['WE DID IT! Wait, we did it!', 'I can\'t believe that worked!', 'Okay that was actually pretty good!', 'I\'m starting to breathe again!'],
      seven_out: ['I KNEW IT! I knew it was coming!', 'The sky is falling!', 'THAT\'S IT! I\'M BROKE! ...wait I still have some.', 'Every single time. Every. Single. Time.'],
      dead: ['I told you! Too much pressure!', 'Maybe we should just... not?', 'Let me try. I\'ll probably mess it up too.', 'The wall\'s looking at me funny.'],
    },
  },
  {
    id: 'diane', initials: 'D',
    name: 'Deadeye Diane',
    color: '#00BCD4',
    bet: 15, money: 150, participation: 0.85,
    lines: {
      win: ['All in a night\'s work.', 'Clean and simple.', 'That\'s how you do it.', 'Right where I wanted it.', 'Money talks.'],
      loss: ['Fine. Next roll.', 'Not my night. Doesn\'t matter.', 'Cost of doing business.', 'I\'ve lost more on worse games.', 'Shake it off and move on.'],
      point: ['Now we work.', 'Point\'s up. Let\'s see what you\'ve got.', 'This is where it gets interesting.', 'Alright. One number. Let\'s lock in.', 'Focus. Everything else is noise.'],
      made_point: ['Textbook.', 'Right on schedule.', 'Called it from the jump.', 'That\'s control. That\'s discipline.', 'One down. Keep rolling.'],
      seven_out: ['Tough beat. Next shooter.', 'It happens. Stay cool.', 'Seven waits for nobody.', 'Didn\'t stick. Reset and regroup.', 'That\'s why you stay calm.'],
      dead: ['Hit the damn wall.', 'Short. Back it up and send it.', 'You\'re aiming too early. Follow through.', 'The wall\'s your friend. Use it.'],
    },
  },
];

import { pick } from './announcer.js';

export class NPCPool {
  constructor() {
    this.reset();
  }

  placeBets() {
    this.totalBet = 0;
    this.bettors = [];
    for (const npc of this.npcs) {
      npc.active = Math.random() < npc.participation;
      if (!npc.active) continue;
      const stake = Math.min(npc.bet, npc.money);
      if (stake > 0) {
        npc.money -= stake;
        this.totalBet += stake;
        this.bettors.push(npc);
      }
    }
  }

  settle(result) {
    for (const npc of this.bettors) {
      if (result === 'win') {
        npc.money += npc.bet * 2;
      }
    }
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
    for (const npc of this.bettors) {
      this.speak(npc.id, event);
    }
  }

  reset() {
    this.npcs = NPCS.map(def => ({
      ...def,
      lines: { ...def.lines },
      _showTimer: null,
      bubble: null,
      active: true,
    }));
  }
}
