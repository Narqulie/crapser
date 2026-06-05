const RULES_TEXT = {
  'COME_OUT': `come-out: <em class="num-win">7</em> or <em class="num-win">11</em> wins &bull; <em class="num-loss">2</em>,<em class="num-loss">3</em>,<em class="num-loss">12</em> loses &bull; anything else sets the point`,
  'POINT': (p) => `point is <em class="num-point">${p}</em>: roll <em class="num-point">${p}</em> to win &bull; <em class="num-loss">7</em> loses (seven out)`,
};

const HISTORY_COLORS = {
  win: '#1b5e20',
  loss: '#b71c1c',
  point: '#e65100',
  continue: '#333',
};

export class UI {
  constructor(game, npcPool) {
    this.game = game;
    this.npcPool = npcPool;

    this.phaseEl = document.getElementById('phase-display');
    this.pointEl = document.getElementById('point-display');
    this.rulesEl = document.getElementById('rules-hint');
    this.historyEl = document.getElementById('history-strip');
    this.diceResultEl = document.getElementById('dice-result');
    this.moneyEl = document.getElementById('money-display');
    this.betChips = document.querySelectorAll('.bet-chip');
    this.rollCountEl = document.getElementById('roll-count');
    this.winCountEl = document.getElementById('win-count');
    this.npcsEl = document.getElementById('npcs');

    this.gameOverEl = document.getElementById('game-over');
    this.newGameBtn = document.getElementById('new-game-btn');
    this.powerBarBg = document.getElementById('power-bar-bg');
    this.powerBarFill = document.getElementById('power-bar-fill');

    this.newGameBtn.addEventListener('click', () => this.onNewGame?.());

    this.betChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.game.setBet(parseInt(chip.dataset.amount));
        this.sync();
      });
    });

    this.onNewGame = null;
    this.sync();
  }

  showAnnouncement(text, type) {
    const el = this.diceResultEl;
    el.textContent = text;
    el.className = 'show';
    if (type === 'win') el.classList.add('announce-win');
    else if (type === 'loss') el.classList.add('announce-loss');
    else if (type === 'point') el.classList.add('announce-point');
    else if (type === 'dead') el.classList.add('announce-dead');
    clearTimeout(this._resultTimeout);
    this._resultTimeout = setTimeout(() => { el.className = ''; el.textContent = ''; }, 4000);
  }

  showGameOver() {
    this.gameOverEl.classList.add('visible');
  }

  hideGameOver() {
    this.gameOverEl.classList.remove('visible');
  }

  syncRules() {
    const g = this.game;
    if (g.rolling) {
      this.rulesEl.innerHTML = '';
    } else if (g.phase === 'POINT') {
      this.rulesEl.innerHTML = RULES_TEXT.POINT(g.point);
    } else {
      this.rulesEl.innerHTML = RULES_TEXT.COME_OUT;
    }
  }

  syncHistory() {
    const entries = this.game.handHistory;
    if (entries.length === 0) {
      this.historyEl.innerHTML = '';
      return;
    }
    this.historyEl.innerHTML = entries.map(e => {
      const color = HISTORY_COLORS[e.result] || '#333';
      const label = e.sum === 2 ? '2\u2605' :
        e.sum === 3 ? '3\u2605' :
        e.sum === 12 ? '12\u2605' : `${e.sum}`;
      return `<div class="hist-entry" style="background:${color}" title="${e.values[0]}+${e.values[1]}=${e.sum}">${label}</div>`;
    }).join('');
  }

  setPower(p) {
    this.powerBarFill.style.width = `${p * 100}%`;
    this.powerBarBg.style.display = 'block';
  }

  hidePower() {
    this.powerBarBg.style.display = 'none';
  }

  syncNPCs() {
    this.npcsEl.innerHTML = this.npcPool.npcs.map(n => {
      const color = n.color;
      const moneyClass = n.money < n.bet ? 'broke' : '';
      const bubbleShow = n.bubble ? 'show' : '';
      const outClass = !n.active ? 'out' : '';
      const betDisplay = n.active
        ? `<div class="npc-bet">$${n.bet}</div>`
        : `<div class="npc-bet out">out</div>`;
      return `<div class="npc-card ${outClass}">
        <div class="npc-avatar" style="background:${color}">${n.initials}</div>
        <div class="npc-info">
          <div class="npc-name">${n.name}</div>
          <div class="npc-money ${moneyClass}">$${n.money}</div>
          ${betDisplay}
        </div>
        <div class="npc-bubble ${bubbleShow}">${n.bubble || ''}</div>
      </div>`;
    }).join('');
  }

  sync() {
    const g = this.game;
    this.phaseEl.textContent = g.phase === 'POINT' ? `\u25CF POINT ${g.point} \u25CF` : 'COME OUT';
    this.phaseEl.className = g.phase === 'POINT' ? 'phase-point' : 'phase-comeout';
    const msgEl = document.getElementById('game-message');
    if (msgEl) msgEl.textContent = g.rolling ? 'rolling\u2026' : (g.message || '');
    this.pointEl.textContent = '';
    this.moneyEl.textContent = `$${this.game.money}`;

    this.betChips.forEach(chip => {
      const val = parseInt(chip.dataset.amount);
      chip.classList.toggle('active', val === this.game.bet);
      chip.disabled = this.game.rolling || this.game.phase === 'POINT' || val < (this.game.minBet || 5);
    });

    this.rollCountEl.textContent = `rolls: ${this.game.rollCount}`;
    this.winCountEl.textContent = `wins: ${this.game.winCount}`;

    this.syncRules();
    this.syncHistory();
    this.syncNPCs();

    if (this.game.bankrupt) {
      this.showGameOver();
    }
  }
}
