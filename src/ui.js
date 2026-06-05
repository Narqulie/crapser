import { getActiveSynergies } from './upgrades.js';

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
  /**
   * @param {object} game - the craps game state
   * @param {object} rogueRun - the rogue-lite run manager
   */
  constructor(game, rogueRun) {
    this.game = game;
    this.rogueRun = rogueRun;

    this.phaseEl = document.getElementById('phase-display');
    this.pointEl = document.getElementById('point-display');
    this.rulesEl = document.getElementById('rules-hint');
    this.historyEl = document.getElementById('history-strip');
    this.diceResultEl = document.getElementById('dice-result');

    // Triple-bar money elements
    this.moneyValue = document.getElementById('money-value');
    this.betValue = document.getElementById('bet-value');
    this.payoutValue = document.getElementById('payout-value');

    this.betChips = document.querySelectorAll('.bet-chip');
    this.rollCountEl = document.getElementById('roll-count');
    this.winCountEl = document.getElementById('win-count');

    // Table progress
    this.tableProgress = document.getElementById('table-progress');
    this.tableProgressFill = document.querySelector('.table-progress-fill');
    this.tableProgressLabel = document.querySelector('.table-progress-label');

    // Bonus panel
    this.bonusPanel = document.getElementById('bonus-panel');

    // Result card
    this.resultCard = document.getElementById('result-card');
    this.resultCardInner = document.querySelector('#result-card .result-card');
    this.resultHeader = document.querySelector('#result-card .result-header');
    this.resultBreakdown = document.querySelector('#result-card .result-breakdown');
    this.resultNet = document.querySelector('#result-card .result-net');

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

  /**
   * Show dice-result announcement with shorter 1.5s hold.
   * @param {string} text - announcement message
   * @param {'win'|'loss'|'point'|'dead'} type - result type for styling
   */
  showAnnouncement(text, type) {
    const el = this.diceResultEl;
    el.textContent = text;
    el.className = 'show';
    if (type === 'win') el.classList.add('announce-win');
    else if (type === 'loss') el.classList.add('announce-loss');
    else if (type === 'point') el.classList.add('announce-point');
    else if (type === 'dead') el.classList.add('announce-dead');
    clearTimeout(this._resultTimeout);
    this._resultTimeout = setTimeout(() => { el.className = ''; el.textContent = ''; }, 1500);
  }

  /** Show the game-over overlay. */
  showGameOver() {
    this.gameOverEl.classList.add('visible');
  }

  /** Hide the game-over overlay. */
  hideGameOver() {
    this.gameOverEl.classList.remove('visible');
  }

  /** Update the rules hint based on current game phase. */
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

  /** Rebuild the roll-history strip from game hand history. */
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

  /**
   * Set the power bar fill for aim-strength visualization.
   * @param {number} p - power level 0–1
   */
  setPower(p) {
    this.powerBarFill.style.width = `${p * 100}%`;
    this.powerBarBg.style.display = 'block';
  }

  /** Hide the power bar. */
  hidePower() {
    this.powerBarBg.style.display = 'none';
  }

  /**
   * Return estimated base payout (2x bet) for the TO WIN display.
   * @returns {number} estimated payout
   */
  calculatePayout() {
    return this.game.bet * 2;
  }

  /**
   * Show animated result breakdown card after hand resolution.
   * @param {'win'|'loss'|'push'} result
   * @param {number} bet - amount wagered
   * @param {number} payout - total returned (0 for loss)
   * @param {Array<{name:string,amount:number}>} bonuses - bonus breakdowns
   * @param {number} netChange - net money change
   */
  showResultCard(result, bet, payout, bonuses, netChange) {
    if (!this.resultCard || !this.resultCardInner) return;

    const absNet = Math.abs(netChange);
    const headerText = result === 'win' ? `WIN +$${absNet}` :
      result === 'loss' ? `LOSS -$${absNet}` :
      `PUSH $0`;
    this.resultHeader.textContent = headerText;
    this.resultHeader.className = 'result-header';

    // Build breakdown items
    let breakdownHtml = '';
    breakdownHtml += `<div class="result-item"><span class="label">Bet</span><span class="value negative">-$${bet}</span></div>`;

    if (payout > 0 || result === 'push') {
      const payoutClass = payout > 0 ? 'positive' : 'neutral';
      breakdownHtml += `<div class="result-item"><span class="label">Payout</span><span class="value ${payoutClass}">+$${payout}</span></div>`;
    }

    if (bonuses && bonuses.length > 0) {
      bonuses.forEach(b => {
        breakdownHtml += `<div class="result-item"><span class="label">${b.name}</span><span class="value positive">+$${b.amount}</span></div>`;
      });
    }

    this.resultBreakdown.innerHTML = breakdownHtml;

    // Net change line
    const netSign = netChange >= 0 ? '+' : '';
    const netClass = netChange > 0 ? 'positive' : netChange < 0 ? 'negative' : 'neutral';
    this.resultNet.textContent = `NET ${netSign}$${netChange}`;
    this.resultNet.className = `result-net ${netClass}`;

    // Apply result type class for border/glow coloring
    this.resultCardInner.className = `result-card ${result}`;

    // Animate in
    this.resultCard.classList.add('visible');

    // Dismiss after 2.5s
    clearTimeout(this._cardTimeout);
    this._cardTimeout = setTimeout(() => {
      this.resultCard.classList.remove('visible');
      this.resultCard.classList.add('dismiss');
      setTimeout(() => {
        this.resultCard.classList.remove('dismiss');
      }, 350);
    }, 2500);
  }

  /**
   * Update table progress bar fill and label.
   * @param {number} current - current money earned this table
   * @param {number} target - table target money
   * @param {boolean} isBoss - whether this is the boss table
   */
  updateTableProgress(current, target, isBoss) {
    if (!this.tableProgress || !this.tableProgressFill || !this.tableProgressLabel) return;
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    this.tableProgressFill.style.width = `${pct}%`;
    this.tableProgressLabel.textContent = `$${current} / $${target}`;
    if (isBoss) {
      this.tableProgress.classList.add('boss');
    } else {
      this.tableProgress.classList.remove('boss');
    }
  }

  /**
   * Render active upgrade tags and synergy badges in the bonus panel.
   * @param {Array<{id:string,name:string,category:string,charges:number}>} upgrades
   * @param {{synergies:Array,antiSynergies:Array,legendary:object|null}} [synergyData] — optional; derived from rogueRun if omitted
   */
  updateBonusPanel(upgrades, synergyData) {
    if (!this.bonusPanel) return;

    // Derive synergy data from rogueRun if not explicitly provided
    if (!synergyData && this.rogueRun) {
      synergyData = this.rogueRun._synergies
        || getActiveSynergies(this.rogueRun.activeUpgrades);
    }

    if (!upgrades || upgrades.length === 0) {
      this.bonusPanel.innerHTML = '';
      this.bonusPanel.style.display = 'none';
      return;
    }
    this.bonusPanel.style.display = '';

    // Build set of IDs involved in active anti-synergies
    const antiIds = new Set();
    if (synergyData && synergyData.antiSynergies) {
      for (const anti of synergyData.antiSynergies) {
        for (const id of anti.pair) {
          antiIds.add(id);
        }
      }
    }

    // Render upgrade tags (existing style + anti-synergy indicators)
    const tagsHtml = upgrades.map(u => {
      const chargeText = u.charges > 0 ? ` <span class="charge">x${u.charges}</span>` : '';
      const antiWarn = antiIds.has(u.id)
        ? ' <span class="anti-warn" title="Anti-synergy active">\u26A0</span>'
        : '';
      return `<span class="bonus-tag ${u.category}">${u.name}${chargeText}${antiWarn}</span>`;
    }).join('');

    // Render synergy set badges
    const categoryIcons = { dice: '\u25C6', bet: '\u25C6', charm: '\u2726', talent: '\u25C6' };
    let synergyHtml = '';
    if (synergyData && synergyData.synergies && synergyData.synergies.length > 0) {
      synergyHtml = synergyData.synergies.map(s => {
        const icon = categoryIcons[s.category] || '\u25C6';
        const label = s.tier === 'set3' ? '3-set' : '2-set';
        return `<span class="synergy-badge ${s.category} ${s.tier}" title="${s.description}">${icon} ${label}</span>`;
      }).join('');
    }

    // Render legendary badge
    let legendaryHtml = '';
    if (synergyData && synergyData.legendary) {
      const desc = (synergyData.legendary.description || '').replace(/"/g, '&quot;');
      legendaryHtml = `<span class="synergy-badge legendary" title="${desc}">\u2605 LEGENDARY</span>`;
    }

    this.bonusPanel.innerHTML = tagsHtml + synergyHtml + legendaryHtml;
  }

  /**
   * Flash the screen with a brief colored overlay.
   * @param {'win'|'loss'} type
   */
  static flashScreen(type) {
    document.body.classList.add('screen-flash', type);
    setTimeout(() => document.body.classList.remove('screen-flash', type), 800);
  }

  /**
   * Full UI sync: update all HUD elements from current game state.
   */
  sync() {
    const g = this.game;
    this.phaseEl.textContent = g.phase === 'POINT' ? `\u25CF POINT ${g.point} \u25CF` : 'COME OUT';
    this.phaseEl.className = g.phase === 'POINT' ? 'phase-point' : 'phase-comeout';
    const msgEl = document.getElementById('game-message');
    if (msgEl) msgEl.textContent = g.rolling ? 'rolling\u2026' : (g.message || '');
    this.pointEl.textContent = '';

    // Triple-bar money display
    if (this.moneyValue) this.moneyValue.textContent = `$${this.game.money}`;
    if (this.betValue) this.betValue.textContent = `$${this.game.bet}`;
    if (this.payoutValue) this.payoutValue.textContent = `$${this.calculatePayout()}`;

    this.betChips.forEach(chip => {
      const val = parseInt(chip.dataset.amount);
      chip.classList.toggle('active', val === this.game.bet);
      chip.disabled = this.game.rolling || this.game.phase === 'POINT' || val < (this.game.minBet || 5);
    });

    this.rollCountEl.textContent = `rolls: ${this.game.rollCount}`;
    this.winCountEl.textContent = `wins: ${this.game.winCount}`;

    this.syncRules();
    this.syncHistory();

    if (this.game.bankrupt) {
      this.showGameOver();
    }
  }
}
