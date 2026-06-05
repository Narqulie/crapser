import { getUpgrade, getTotalTables } from './upgrades.js';

const RARITY_COLORS = {
  common: '#888',
  uncommon: '#4caf50',
  rare: '#ffd700',
};

const CATEGORY_ICONS = {
  dice: '[D]',
  bet: '[B]',
  charm: '[C]',
  talent: '[T]',
};

export class RogueUI {
  constructor(rogueRun) {
    this.rogueRun = rogueRun;
    this._showing = false;

    // Pick overlay
    this.overlay = document.getElementById('pick-overlay');
    this.container = document.getElementById('pick-cards');
    this.skipBtn = document.getElementById('pick-skip');
    this.pickHeader = document.getElementById('pick-header');

    this.skipBtn.addEventListener('click', () => {
      this.rogueRun.skipPick();
      this.hide();
    });

    this.rerollBtn = document.getElementById('pick-reroll');
    if (this.rerollBtn) {
      this.rerollBtn.addEventListener('click', () => {
        if (this.rogueRun.useReroll()) {
          this._showing = false;
          this.showPick();
        }
      });
    }

    // Run status elements
    this.statusEl = document.getElementById('run-status');
    this.tableEl = document.getElementById('table-display');
    this.metaEl = document.getElementById('meta-display');
    this.rerollEl = document.getElementById('reroll-display');

    // Table clear overlay
    this.tableClearEl = document.getElementById('table-clear');
    this.tableClearName = document.getElementById('table-clear-name');
    this.tableClearBtn = document.getElementById('table-clear-btn');
    if (this.tableClearBtn) {
      this.tableClearBtn.addEventListener('click', () => {
        this.hideTableClear();
        this.rogueRun.runState = 'BETTING';
        this.sync();
      });
    }

    // Perk overlay
    this.perkOverlay = document.getElementById('perk-overlay');
    this.perkContainer = document.getElementById('perk-list');
    this.perkCloseBtn = document.getElementById('perk-close');
    this.perkToggleBtn = document.getElementById('perk-toggle');
    if (this.perkCloseBtn) {
      this.perkCloseBtn.addEventListener('click', () => this.hidePerks());
    }
    if (this.perkToggleBtn) {
      this.perkToggleBtn.addEventListener('click', () => {
        if (this.perkOverlay && this.perkOverlay.classList.contains('visible')) {
          this.hidePerks();
        } else {
          this.showPerks();
        }
      });
    }
  }

  // ─── PICK OVERLAY ────────────────────────────────────

  showPick() {
    if (this._showing) return;
    this._showing = true;

    const options = this.rogueRun.getPickOptions(3);
    if (options.length === 0) {
      this.rogueRun.skipPick();
      this._showing = false;
      return;
    }

    // Entrance stagger animation: add delay to each card
    this.container.innerHTML = options.map((u, i) => {
      const catIcon = CATEGORY_ICONS[u.category] || `[${u.category}]`;
      const rarityColor = RARITY_COLORS[u.rarity] || '#888';
      const delay = i * 0.08;
      return `<div class="pick-card" data-id="${u.id}" style="--rarity-color: ${rarityColor}; --enter-delay: ${delay}s">
        <div class="pick-rarity-bar" style="background: ${rarityColor}"></div>
        <div class="pick-category">${catIcon} ${u.rarity}</div>
        <div class="pick-name">${u.name}</div>
        <div class="pick-desc">${u.description}</div>
      </div>`;
    }).join('');

    this.container.querySelectorAll('.pick-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.rogueRun.applyUpgrade(id);
        this.hide();
      });
    });

    // Update reroll button
    if (this.rerollBtn) {
      this.rerollBtn.textContent = `reroll (${this.rogueRun.rerollTokens})`;
      this.rerollBtn.style.display = this.rogueRun.rerollTokens > 0 ? 'inline-block' : 'none';
    }

    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
  }

  hide() {
    this._showing = false;
    this.overlay.classList.remove('visible');
    this.sync();
  }

  // ─── TABLE CLEAR OVERLAY ─────────────────────────────

  showTableClear() {
    const table = this.rogueRun.getCurrentTable();
    const prevTable = getTotalTables() - (getTotalTables() - this.rogueRun.tableIndex);
    const isBoss = table.boss;
    const bossLabel = isBoss ? 'BOSS TABLE' : 'table cleared';

    if (this.tableClearName) {
      this.tableClearName.innerHTML = `
        <div class="table-clear-number">${isBoss ? '⚔' : '★'} ${bossLabel}</div>
        <div class="table-clear-name">${table.name}</div>
        <div class="table-clear-money">money: $${this.rogueRun.game.money}</div>
        <div class="table-clear-next">next: ${getTotalTables() > this.rogueRun.tableIndex + 1
          ? `Table ${this.rogueRun.tableIndex + 1}/${getTotalTables()}`
          : 'final table!'}</div>
      `;
    }

    requestAnimationFrame(() => {
      if (this.tableClearEl) this.tableClearEl.classList.add('visible');
    });
  }

  hideTableClear() {
    if (this.tableClearEl) this.tableClearEl.classList.remove('visible');
  }

  // ─── PERK OVERLAY ────────────────────────────────────

  showPerks() {
    if (!this.perkOverlay || !this.rogueRun.meta) return;
    const meta = this.rogueRun.meta;
    const data = meta.data;

    this.perkContainer.innerHTML = `
      <div class="perk-header-stats">
        <span>level ${data.level}</span>
        <span>${data.xp} XP</span>
        <span>${data.availablePoints} point${data.availablePoints !== 1 ? 's' : ''}</span>
      </div>
      ${PERK_ITEMS.map(p => {
        const unlocked = data.unlockedPerks.includes(p.id);
        const canBuy = data.availablePoints >= p.cost && !unlocked &&
          (!p.prerequisite || data.unlockedPerks.includes(p.prerequisite));
        return `<div class="perk-item ${unlocked ? 'unlocked' : ''}" data-id="${p.id}">
          <div class="perk-info">
            <div class="perk-name">${p.name}</div>
            <div class="perk-desc">${p.desc}</div>
          </div>
          <div class="perk-cost">${unlocked ? '✓' : `${p.cost} pt`}</div>
        </div>`;
      }).join('')}
    `;

    this.perkContainer.querySelectorAll('.perk-item:not(.unlocked)').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (meta.unlockPerk(id)) {
          this.showPerks(); // refresh
          this.sync();
        }
      });
    });

    this.perkOverlay.classList.add('visible');
  }

  hidePerks() {
    if (this.perkOverlay) this.perkOverlay.classList.remove('visible');
  }

  // ─── SYNC ALL UI ─────────────────────────────────────

  sync() {
    const run = this.rogueRun;
    if (!this.statusEl) return;

    const upgrades = run.getActiveUpgradeList();
    const table = run.getCurrentTable();
    const progress = Math.min(run.game.money / run.getCurrentTarget() * 100, 100);
    const isBoss = table.boss;

    // Table display
    if (this.tableEl) {
      this.tableEl.innerHTML = `
        <span class="table-badge ${isBoss ? 'boss' : ''}">
          ${isBoss ? '⚔ ' : ''}T${table.id}/${getTotalTables()}
        </span>
        <span class="table-name">${table.name}</span>
      `;
    }

    // Upgrade tags
    let upgradeHTML = '';
    if (upgrades.length > 0) {
      upgradeHTML = `<div class="run-upgrades">${upgrades.map(u => {
        const color = RARITY_COLORS[u.rarity] || '#888';
        const chargeTag = u.charges > 0 ? ` <span class="run-charge">x${u.charges}</span>` : '';
        return `<span class="run-upgrade" style="border-color: ${color}; color: ${color}" title="${u.description}">${u.name}${chargeTag}</span>`;
      }).join(' ')}</div>`;
    }

    // Progress tiers
    const tiers = [25, 50, 75, 100].map(t => {
      const active = progress >= t ? 'active' : '';
      return `<span class="progress-tier ${active}" style="left: ${t}%"></span>`;
    }).join('');

    this.statusEl.innerHTML = `
      <div class="run-progress">
        <div class="run-progress-fill" style="width: ${progress}%"></div>
        ${tiers}
        <div class="run-progress-label">$${run.game.money} / $${run.getCurrentTarget()}</div>
      </div>
      ${run.sidePot > 0 ? `<div class="run-pot">pot: $${run.sidePot}</div>` : ''}
      ${upgradeHTML}
    `;

    // Reroll tokens
    if (this.rerollEl) {
      this.rerollEl.textContent = run.rerollTokens > 0 ? `⟳ ${run.rerollTokens}` : '';
    }

    // Meta display
    if (this.metaEl && run.meta) {
      const m = run.meta;
      const lvl = m.data.level;
      const prog = m.getLevelProgress();
      const pct = Math.min(prog.progress * 100, 100);
      this.metaEl.innerHTML = `
        <span class="meta-level">Lv ${lvl}</span>
        <span class="meta-xp-bar"><span class="meta-xp-fill" style="width: ${pct}%"></span></span>
      `;
    }
  }

  // ─── RUN END SCREENS ────────────────────────────────

  showBust() {
    // Record run before showing
    this._recordRunEnd(false);

    const summary = this.rogueRun.getRunSummary();
    const el = document.getElementById('game-over-content');
    el.innerHTML = `
      <h2 style="color: #e74c3c">tapped out</h2>
      <p class="run-stats">
        ${summary.handsPlayed} hands &bull;
        ${summary.winCount}W / ${summary.lossCount}L
        ${summary.tablesCleared > 0 ? `&bull; ${summary.tablesCleared} table${summary.tablesCleared > 1 ? 's' : ''}` : ''}
      </p>
      ${summary.upgrades.length > 0
        ? `<p class="run-upgrades-line">${summary.upgrades.join(' \u00b7 ')}</p>`
        : ''}
      <p class="run-final">finished with $${summary.finalMoney}</p>
      ${this._xpHTML()}
      <button id="new-game-btn">new run</button>
    `;
    document.getElementById('game-over').classList.add('visible');
    this._rehookNewGame();
  }

  showRunWon() {
    // Record run before showing
    this._recordRunEnd(true);

    const summary = this.rogueRun.getRunSummary();
    const el = document.getElementById('game-over-content');
    el.innerHTML = `
      <h2 style="color: #ffd700; text-shadow: 0 0 40px rgba(255,215,0,0.5)">house broke!</h2>
      <p class="run-stats">
        ${summary.handsPlayed} hands &bull;
        ${summary.winCount}W / ${summary.lossCount}L
        ${summary.tablesCleared > 0 ? `&bull; ${summary.tablesCleared} table${summary.tablesCleared > 1 ? 's' : ''}` : ''}
      </p>
      ${summary.sidePot > 0
        ? `<p class="run-pot-payout" style="color: #4caf50">side pot x2: +$${summary.bonusPot}</p>`
        : ''}
      ${summary.upgrades.length > 0
        ? `<p class="run-upgrades-line">${summary.upgrades.join(' \u00b7 ')}</p>`
        : ''}
      <p class="run-final" style="color: #ffd700">final: $${summary.finalMoney}</p>
      ${this._xpHTML()}
      <button id="new-game-btn">new run</button>
    `;
    document.getElementById('game-over').classList.add('visible');
    this._rehookNewGame();
  }

  /** Show levelled-up notification */
  showLevelUp(level) {
    const el = document.getElementById('game-over-content');
    // Insert level-up banner above existing content
    const banner = document.createElement('div');
    banner.className = 'level-up-banner';
    banner.innerHTML = `
      <div class="level-up-glow"></div>
      <div class="level-up-text">LEVEL UP! Lv ${level}</div>
      <div class="level-up-sub">perk point available</div>
    `;
    el.prepend(banner);
    setTimeout(() => banner.classList.add('show'), 100);
  }

  hideGameOver() {
    document.getElementById('game-over').classList.remove('visible');
    // Remove level-up banners
    document.querySelectorAll('.level-up-banner').forEach(el => el.remove());
  }

  // ─── INTERNALS ───────────────────────────────────────

  _recordRunEnd(won) {
    const meta = this.rogueRun.meta;
    if (!meta) return;
    const summary = this.rogueRun.getRunSummary();
    const xp = meta.recordRun(summary.finalMoney, won, summary.tablesCleared, summary.upgrades.length);
    const result = meta.addXP(xp);
    if (result.leveledUp) {
      // Store for display after the screen renders
      this._pendingLevelUp = result.newLevel;
    }
    this._lastXPEarned = xp;
  }

  _xpHTML() {
    const xp = this._lastXPEarned || 0;
    const lvl = this._pendingLevelUp;
    this._pendingLevelUp = null;
    this._lastXPEarned = null;
    return `
      ${xp > 0 ? `<p class="run-xp-earned">+${xp} XP</p>` : ''}
      ${lvl ? `<p class="run-level-up" style="color: #ffd700; font-weight: bold;">★ LEVEL UP! Lv ${lvl} ★</p>` : ''}
    `;
  }

  _rehookNewGame() {
    const btn = document.getElementById('new-game-btn');
    const old = btn._listener;
    if (old) btn.removeEventListener('click', old);
    const handler = () => {
      const freshBonuses = this.rogueRun.meta ? this.rogueRun.meta.getBonuses() : {};
      this.rogueRun.resetRun(freshBonuses);
      this.hideGameOver();
      this.hide();
      this.hideTableClear();
      this.sync();
      if (this.onNewRun) this.onNewRun();
    };
    btn.addEventListener('click', handler);
    btn._listener = handler;
  }
}

// Perk definitions for the UI (matches meta-progress.js)
const PERK_ITEMS = [
  { id: 'starter_boost', name: 'Starter Boost',    desc: 'Start each run with +$10',        cost: 1, prerequisite: null },
  { id: 'fat_stacks',    name: 'Fat Stacks',        desc: 'Start each run with +$25',        cost: 2, prerequisite: 'starter_boost' },
  { id: 'reroll_basic',  name: 'Mulligan',           desc: '1 reroll token per run',         cost: 1, prerequisite: null },
  { id: 'reroll_master', name: 'Double Mulligan',    desc: '2 reroll tokens per run',        cost: 2, prerequisite: 'reroll_basic' },
  { id: 'extra_choice',  name: 'More Options',       desc: 'Pick from 4 upgrades instead of 3', cost: 2, prerequisite: null },
  { id: 'interest',      name: 'Street Interest',    desc: '+$1 per hand played (passive)',   cost: 1, prerequisite: null },
  { id: 'first_free',    name: 'First Pick Free',    desc: 'First upgrade each run is free', cost: 2, prerequisite: null },
  { id: 'xp_boost',      name: 'Quick Learner',      desc: '2x XP gain',                     cost: 1, prerequisite: null },
];
