import { getUpgrade } from './upgrades.js';
import { PERKS, VOW_DEFS } from './meta-progress.js';
import { MAP_ACTS } from './map.js';

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
  /**
   * @param {import('./rogue-run.js').RogueRun} rogueRun - The roguelite run state machine
   * @param {import('./ui.js').UI} ui - Main HUD controller
   * @param {import('./shop.js').ShopSystem|null} shopSystem - NPC shop system (optional)
   * @param {Array<{id:string, name:string, color:string, initials:string}>} npcs - NPC definitions for shop portraits
   */
  constructor(rogueRun, ui, shopSystem = null, npcs = []) {
    this.rogueRun = rogueRun;
    this.ui = ui;
    this.shopSystem = shopSystem;
    this.npcs = npcs; // array of NPC objects with .id, .name, .color, .initials
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

    // Shop overlay
    this.shopOverlay = document.getElementById('shop-overlay');
    this.shopAvatar = document.getElementById('shop-avatar');
    this.shopNpcName = document.getElementById('shop-npc-name');
    this.shopNpcGreeting = document.getElementById('shop-npc-greeting');
    this.shopTrustBadge = document.getElementById('shop-trust-badge');
    this.shopMoney = document.getElementById('shop-money');
    this.shopItems = document.getElementById('shop-items');
    this.shopLeaveBtn = document.getElementById('shop-leave');

    // Vow selection overlay
    this.vowSelectOverlay = document.getElementById('vow-select-overlay');
    this.vowSelectCards = document.getElementById('vow-select-cards');
    this.vowSkipBtn = document.getElementById('vow-skip-btn');

    // Dice pick overlay
    this.dicePickOverlay = document.getElementById('dice-pick-overlay');
    this.dicePickSlots = document.getElementById('dice-pick-slots');
    this.dicePickConfirm = document.getElementById('dice-pick-confirm');
    this._pickedSlots = [];
    this._tableLockMode = false;
    this.onTableLockDone = null;

    // Map navigation overlay
    this.mapOverlay = document.getElementById('map-overlay');
    this.mapHeaderEl = document.getElementById('map-header');
    this.mapActLabel = document.getElementById('map-act-label');
    this.mapFloorLabel = document.getElementById('map-floor-label');
    this.mapNodes = document.getElementById('map-nodes');
    this._mapVisible = false;

    if (this.shopLeaveBtn) {
      this.shopLeaveBtn.addEventListener('click', () => {
        this.hideShop();
        const next = this.rogueRun.advanceShop ? this.rogueRun.advanceShop() : null;
        if (next) {
          this.showShop(next);
        } else {
          // Back to betting — sync full UI
          this.ui.sync();
          this.sync();
          if (this.onShopDone) this.onShopDone();
        }
      });
    }

    if (this.dicePickConfirm) {
      this.dicePickConfirm.addEventListener('click', () => {
        if (this._tableLockMode) {
          // Table lock mode: confirm locks 2 dice for the table
          if (this._pickedSlots.length !== 2) return;
          const slotA = this._pickedSlots[0];
          const slotB = this._pickedSlots[1];
          const success = this.rogueRun.lockTableDice([slotA, slotB]);
          if (success) {
            this._tableLockMode = false;
            this.hideTableStartLock();
            this.onTableLockDone();
          }
        } else {
          // Normal dice pick mode
          if (this._pickedSlots.length !== 2) return;
          const slotA = this._pickedSlots[0];
          const slotB = this._pickedSlots[1];
          const success = this.rogueRun.confirmDicePick([slotA, slotB]);
          if (success) {
            this.hideDicePick();
            if (this.onDicePickConfirmed) this.onDicePickConfirmed();
          }
        }
      });
    }

    if (this.vowSkipBtn) {
      this.vowSkipBtn.addEventListener('click', () => {
        this.hideVowSelect();
        this._continueNewRun();
      });
    }
  }

  // ─── PICK OVERLAY ────────────────────────────────────

  /**
   * Display the pick-1-of-3 upgrade overlay with staggered entrance animation.
   * Gets options from rogueRun, renders cards with rarity colors and category icons.
   */
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

  /**
   * Hide all overlays (pick, shop, dice pick, vow, map) and re-sync UI.
   */
  hide() {
    this._showing = false;
    this.overlay?.classList.remove('visible');
    this.hideShop();
    this.hideDicePick();
    this.hideVowSelect();
    this.hideMap();
    this.sync();
  }

  // ─── MAP OVERLAY ──────────────────────────────────

  /**
   * Render the map navigation overlay showing all nodes on the current floor.
   * Each node card displays its type icon, name, NPC opponent/shopkeeper,
   * target money (for table/boss nodes), and trait badge if applicable.
   * Clicking a non-visited node selects it and hides the map.
   *
   * @param {number} actIndex - Current act index (0-based)
   * @param {number} floorIndex - Current floor index (0-based)
   * @param {Array<object>} nodes - Floor nodes from MAP_ACTS
   * @param {string[]} visitedNodeIds - Array of already visited node IDs
   */
  showMap(actIndex, floorIndex, nodes, visitedNodeIds) {
    if (!this.mapOverlay || !this.mapNodes) return;
    if (this._mapVisible) return;

    const act = MAP_ACTS[actIndex];
    const floor = act?.floors?.[floorIndex];
    if (!act || !floor) return;

    const TYPE_ICONS = {
      table: '\u25C6',   // ◆
      boss: '\u2605',    // ★
      shop: '$',         // $
      mystery: '?',      // ?
      rest: '\u2665',    // ♥
    };

    const visitedSet = new Set(visitedNodeIds || []);

    // Set header labels
    if (this.mapHeaderEl) this.mapHeaderEl.textContent = 'Choose Your Path';
    if (this.mapActLabel) this.mapActLabel.textContent = act.name;
    if (this.mapFloorLabel) this.mapFloorLabel.textContent = floor.name;

    // Build node cards
    this.mapNodes.innerHTML = nodes.map(node => {
      const icon = TYPE_ICONS[node.type] || '?';
      const visited = visitedSet.has(node.id);
      const traitHTML = node.trait
        ? `<span class="map-node-trait">${node.trait}</span>`
        : '';
      const targetHTML = (node.type === 'table' || node.type === 'boss') && node.target
        ? `<span class="map-node-target">Target: ₡${node.target}</span>`
        : '';
      const npcHTML = node.npc
        ? `<span class="map-node-npc">${node.type === 'shop' ? node.npc : 'vs ' + node.npc}</span>`
        : '';

      return `<div class="map-node type-${node.type} ${visited ? 'visited' : ''}" data-node-id="${node.id}">
        <div class="map-node-header">
          <span class="map-node-icon">${icon}</span>
          <span class="map-node-name">${node.name}</span>
        </div>
        ${npcHTML}
        ${targetHTML || traitHTML ? `<div class="map-node-meta">${targetHTML}${traitHTML}</div>` : ''}
      </div>`;
    }).join('');

    // Attach click handlers for non-visited nodes
    this.mapNodes.querySelectorAll('.map-node:not(.visited)').forEach(card => {
      card.addEventListener('click', () => {
        const nodeId = card.dataset.nodeId;
        if (!nodeId) return;
        this.rogueRun.selectNode(nodeId);
        this.hideMap();
      });
    });

    this._mapVisible = true;
    requestAnimationFrame(() => {
      this.mapOverlay.classList.add('visible');
    });
  }

  /**
   * Dismiss the map navigation overlay.
   * Resets the _mapVisible flag so the game loop can re-trigger showMap
   * when the run state returns to MAP_NAV.
   */
  hideMap() {
    if (this.mapOverlay) {
      this.mapOverlay.classList.remove('visible');
    }
    this._mapVisible = false;
  }

  // ─── PERK OVERLAY ────────────────────────────────────

  /**
   * Show the meta-progression perk overlay with clickable unlockable perks.
   * Builds perk items from the PERKS definition imported from meta-progress.
   */
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
      ${PERKS.map(p => {
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

  /** Dismiss the perk overlay */
  hidePerks() {
    if (this.perkOverlay) this.perkOverlay.classList.remove('visible');
  }

  // ─── SHOP OVERLAY ───────────────────────────────────

  /**
   * Show the NPC shop overlay with inventory, portrait, trust badge, and buy buttons.
   * @param {string} npcId - NPC identifier from shopSystem
   */
  showShop(npcId) {
    if (!this.shopOverlay || !this.shopSystem) return;

    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return;

    const trustLevel = this.shopSystem.getTrustLevel(npcId);
    const greeting = this.shopSystem.getGreeting(npcId);
    const tableTarget = this.rogueRun.getCurrentTarget();
    const inventory = this.shopSystem.getInventory(npcId, tableTarget);

    // Portrait
    if (this.shopAvatar) {
      this.shopAvatar.style.background = npc.color;
      this.shopAvatar.textContent = npc.initials;
    }
    if (this.shopNpcName) this.shopNpcName.textContent = npc.name;
    if (this.shopNpcGreeting) this.shopNpcGreeting.textContent = greeting;
    if (this.shopTrustBadge) {
      this.shopTrustBadge.textContent = `Trust Lv ${trustLevel}`;
      this.shopTrustBadge.style.display = '';
    }

    // Money
    if (this.shopMoney) {
      this.shopMoney.textContent = `Money: ₡${this.rogueRun.game.money}`;
    }

    // Items
    if (this.shopItems) {
      this.shopItems.innerHTML = inventory.map(item => {
        const cost = this.shopSystem.getItemCost(item, tableTarget);
        const canBuy = this.shopSystem.canAfford(this.rogueRun.game.money, item, tableTarget);
        const buyClass = item.stubbed ? 'stubbed'
          : canBuy ? '' : 'cant-afford';

        return `<div class="shop-item" data-id="${item.id}" data-rarity="${item.rarity}">
          <div class="shop-item-info">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div>
            ${item.stubbed ? `<div class="shop-item-stubbed">${item.descStubbed}</div>` : ''}
          </div>
          <div class="shop-item-cost">
            <div class="shop-cost-amount">₡${cost}</div>
            <div class="shop-cost-label">${item.rarity}</div>
          </div>
          <button class="shop-buy-btn ${buyClass}" ${!canBuy || item.stubbed ? 'disabled' : ''}>
            ${item.stubbed ? 'LOCKED' : canBuy ? 'Buy' : 'Expensive'}
          </button>
        </div>`;
      }).join('');

      // Attach buy handlers
      this.shopItems.querySelectorAll('.shop-buy-btn:not(.cant-afford):not(.stubbed)').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = btn.closest('.shop-item');
          const itemId = card.dataset.id;
          this._handleBuy(itemId, npcId, btn);
        });
      });
    }

    // Show overlay
    requestAnimationFrame(() => {
      this.shopOverlay.classList.add('visible');
    });
  }

  /** Dismiss the shop overlay */
  hideShop() {
    if (this.shopOverlay) {
      this.shopOverlay.classList.remove('visible');
    }
  }

  /**
   * Handle buy button click: process purchase, update button states,
   * refresh money display and re-check affordability.
   * @param {string} itemId - Shop item identifier
   * @param {string} npcId - NPC shopkeeper identifier
   * @param {HTMLElement} btn - The clicked button element
   */
  _handleBuy(itemId, npcId, btn) {
    const result = this.shopSystem.buy(this.rogueRun, npcId, itemId);

    if (!result.success) {
      // Flash reason briefly
      btn.textContent = result.reason || 'Failed';
      btn.classList.add('bought');
      setTimeout(() => {
        this.showShop(npcId);
      }, 800);
      return;
    }

    // Success — mark button and refresh money
    const card = btn.closest('.shop-item');
    btn.textContent = 'Bought!';
    btn.classList.add('bought');
    btn.disabled = true;
    if (card) card.classList.add('just-bought');

    // Update money display
    if (this.shopMoney) {
      this.shopMoney.textContent = `Money: ₡${result.moneyAfter}`;
    }

    // Fizzle message for used_charm
    if (result.fizzled) {
      const info = card?.querySelector('.shop-item-desc');
      if (info) info.textContent = 'It fizzled! Nothing happened.';
    }

    // Refresh buy buttons (some may now be unaffordable)
    setTimeout(() => {
      const tableTarget = this.rogueRun.getCurrentTarget();
      const inventory = this.shopSystem.getInventory(npcId, tableTarget);
      const money = this.rogueRun.game.money;
      this.shopItems.querySelectorAll('.shop-buy-btn').forEach(b => {
        const itemCard = b.closest('.shop-item');
        if (!itemCard) return;
        const iid = itemCard.dataset.id;
        const item = inventory.find(i => i.id === iid);
        if (!item || b.classList.contains('bought')) return;
        const cost = this.shopSystem.getItemCost(item, tableTarget);
        const canBuy = this.shopSystem.canAfford(money, item, tableTarget);
        if (!canBuy) {
          b.classList.add('cant-afford');
          b.textContent = 'Expensive';
          b.disabled = true;
        }
      });

      if (this.shopMoney) {
        this.shopMoney.textContent = `Money: ₡${money}`;
      }
    }, 600);
  }

  // ─── DICE PICK OVERLAY ─────────────────────────────────

  /**
   * Display the dice-hand pick overlay with durability bars,
   * cracked indicators, and pick/unpick toggle for exactly 2 slots.
   */
  showDicePick() {
    if (!this.dicePickOverlay || !this.dicePickSlots) return;

    const slots = this.rogueRun.diceHandSlots;
    this._pickedSlots = [];

    this.dicePickSlots.innerHTML = slots.map((s, i) => {
      const def = s.type;
      const cracked = s.durability === 0;
      const maxDur = def ? def.durability : 1;
      const pct = cracked ? 0 : Math.min((s.durability / maxDur) * 100, 100);
      const durabClass = pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low';
      const delay = i * 0.08;

      return `<div class="dice-slot ${cracked ? 'cracked' : ''}" data-index="${i}" style="--enter-delay: ${delay}s">
        ${cracked ? '<span class="cracked-indicator">cracked</span>' : ''}
        <div class="dice-slot-emoji">🎲</div>
        <div class="dice-slot-type">${def ? def.name : '???'}</div>
        <div class="dice-slot-durability">
          <div class="dice-slot-durability-bar">
            <div class="dice-slot-durability-fill ${durabClass}" style="width:${pct}%"></div>
          </div>
          <span class="dice-slot-durability-label">${s.durability}/${maxDur}</span>
        </div>
        <div class="dice-slot-effect">${cracked ? 'Cracked \u2014 no effect, 20% lose $2' : (def ? def.effect : '')}</div>
      </div>`;
    }).join('');

    // Attach click handlers for pick/unpick
    this.dicePickSlots.querySelectorAll('.dice-slot:not(.cracked)').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index, 10);
        if (card.classList.contains('picked')) {
          // Unpick
          card.classList.remove('picked');
          this._pickedSlots = this._pickedSlots.filter(i => i !== idx);
        } else if (this._pickedSlots.length < 2) {
          // Pick
          card.classList.add('picked');
          this._pickedSlots.push(idx);
        }

        if (this.dicePickConfirm) {
          this.dicePickConfirm.disabled = this._pickedSlots.length !== 2;
        }
      });
    });

    if (this.dicePickConfirm) {
      this.dicePickConfirm.disabled = true;
    }

    requestAnimationFrame(() => {
      this.dicePickOverlay.classList.add('visible');
    });
  }

  /** Dismiss the dice-pick overlay and reset picked slots */
  hideDicePick() {
    if (this.dicePickOverlay) {
      this.dicePickOverlay.classList.remove('visible');
    }
    this._pickedSlots = [];
  }

  /**
   * Show overlay to pick 2 dice to lock for the entire table.
   * Reuses the dice-pick overlay DOM. Locked dice are used for every
   * roll during this table and can't be swapped out.
   */
  showTableStartLock() {
    if (!this.dicePickOverlay || !this.dicePickSlots) return;

    const slots = this.rogueRun.diceHandSlots;
    this._pickedSlots = [];
    this._tableLockMode = true;

    // Update header text
    const header = this.dicePickOverlay.querySelector('.pick-header');
    if (header) header.textContent = 'Lock 2 Dice for This Table';

    this.dicePickSlots.innerHTML = slots.map((s, i) => {
      const def = s.type;
      const cracked = s.durability === 0;
      const maxDur = def ? def.durability : 1;
      const pct = cracked ? 0 : Math.min((s.durability / maxDur) * 100, 100);
      const durabClass = pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low';
      const delay = i * 0.08;

      return `<div class="dice-slot ${cracked ? 'cracked' : ''}" data-index="${i}" style="--enter-delay: ${delay}s">
        ${cracked ? '<span class="cracked-indicator">⚠ cracked</span>' : ''}
        <div class="dice-slot-emoji">🎲</div>
        <div class="dice-slot-type">${def ? def.name : '???'}</div>
        <div class="dice-slot-durability">
          <div class="dice-slot-durability-bar">
            <div class="dice-slot-durability-fill ${durabClass}" style="width:${pct}%"></div>
          </div>
          <span class="dice-slot-durability-label">${s.durability}/${maxDur}</span>
        </div>
        <div class="dice-slot-effect">${cracked ? 'Cracked — 20% lose ₡1' : (def ? def.effect : '')}</div>
      </div>`;
    }).join('');

    // Attach click handlers for pick/unpick (all slots, including cracked)
    this.dicePickSlots.querySelectorAll('.dice-slot').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index, 10);
        if (card.classList.contains('picked')) {
          // Unpick
          card.classList.remove('picked');
          this._pickedSlots = this._pickedSlots.filter(i => i !== idx);
        } else if (this._pickedSlots.length < 2) {
          // Pick
          card.classList.add('picked');
          this._pickedSlots.push(idx);
        }

        if (this.dicePickConfirm) {
          this.dicePickConfirm.disabled = this._pickedSlots.length !== 2;
        }
        if (this.dicePickConfirm) {
          this.dicePickConfirm.textContent = this._pickedSlots.length === 2
            ? 'Lock These Dice'
            : `Pick ${2 - this._pickedSlots.length} More`;
        }
      });
    });

    if (this.dicePickConfirm) {
      this.dicePickConfirm.disabled = true;
      this.dicePickConfirm.textContent = 'Pick 2 Dice';
    }

    requestAnimationFrame(() => {
      this.dicePickOverlay.classList.add('visible');
    });
  }

  /** Dismiss table-start lock overlay and reset picked slots */
  hideTableStartLock() {
    if (this.dicePickOverlay) {
      this.dicePickOverlay.classList.remove('visible');
    }
    this._pickedSlots = [];
  }

  /** Default callback after table dice are locked: transition to BETTING state */
  onTableLockDone() {
    if (this.rogueRun.runState === 'TABLE_START_LOCK') {
      this.rogueRun.runState = 'BETTING';
    }
    this.ui.sync();
    this.sync();
  }

  // ─── VOW SELECTION OVERLAY ──────────────────────────

  /**
   * Display the vow selection overlay with glassmorphism cards for each burden.
   * Each card shows the vow name, description, and bonus. Clicking a card
   * calls metaProgress.setVow() and proceeds with the new-run flow.
   * If the user already has an activeVow, skip overlay and proceed directly.
   *
   * @param {Function} onComplete - Callback invoked after vow selection or skip
   */
  showVowSelect(onComplete) {
    if (!this.vowSelectOverlay || !this.vowSelectCards) {
      if (onComplete) onComplete();
      return;
    }

    // Check if a vow is already active — skip overlay
    const meta = this.rogueRun.meta;
    if (!meta || meta.getVow()) {
      if (onComplete) onComplete();
      return;
    }

    this._vowOnComplete = onComplete;

    // Build vow cards with staggered entrance animation
    this.vowSelectCards.innerHTML = VOW_DEFS.map((v, i) => {
      const delay = i * 0.08;
      const bonusText = this._formatVowBonus(v.bonus);
      return `<div class="vow-card" data-id="${v.id}" style="--enter-delay: ${delay}s">
        <div class="vow-card-name">${v.name}</div>
        <div class="vow-card-desc">${v.desc}</div>
        <div class="vow-card-bonus">${bonusText}</div>
      </div>`;
    }).join('');

    // Attach click handlers for vow selection
    this.vowSelectCards.querySelectorAll('.vow-card').forEach(card => {
      card.addEventListener('click', () => {
        const vowId = card.dataset.id;
        if (meta.setVow(vowId)) {
          // Add selected styling before hiding
          this.vowSelectCards.querySelectorAll('.vow-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          setTimeout(() => {
            this.hideVowSelect();
            if (this._vowOnComplete) {
              const cb = this._vowOnComplete;
              this._vowOnComplete = null;
              cb();
            }
          }, 200);
        }
      });
    });

    // Show overlay with requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
      this.vowSelectOverlay.classList.add('visible');
    });
  }

  /**
   * Format the vow bonus object into a human-readable string.
   * Maps bonus keys like `extraUpgrades`, `startingMoneyMult`, `xpMultiplier`,
   * and `extraUpgradePerTable` to concise display text.
   *
   * @param {object} bonus - Bonus values from VOW_DEFS entry
   * @returns {string} Formatted bonus display text
   */
  _formatVowBonus(bonus) {
    const parts = [];
    if (bonus.extraUpgrades) parts.push(`+${bonus.extraUpgrades} free upgrades`);
    if (bonus.extraUpgradePerTable) parts.push(`+${bonus.extraUpgradePerTable} upgrade per table`);
    if (bonus.startingMoneyMult) {
      const pct = Math.round((bonus.startingMoneyMult - 1) * 100);
      parts.push(`+${pct}% starting money`);
    }
    if (bonus.xpMultiplier) parts.push(`${bonus.xpMultiplier}x XP`);
    return parts.join(' · ');
  }

  /** Dismiss the vow selection overlay and release the onComplete callback */
  hideVowSelect() {
    if (this.vowSelectOverlay) {
      this.vowSelectOverlay.classList.remove('visible');
    }
    // Don't clear _vowOnComplete here — let the consuming flow handle it
  }

  /**
   * Start a new run, optionally gated by vow selection.
   * If no activeVow is set and meta-progression is available, show the
   * vow selection overlay first. Otherwise, proceed directly to the
   * full new-run flow. Called from _rehookNewGame and onNewRun callback.
   */
  startNewRun() {
    const meta = this.rogueRun.meta;

    // If a vow is already active, or meta isn't available, proceed directly
    if (!meta || meta.getVow()) {
      this._continueNewRun();
      return;
    }

    // Show vow selection — _continueNewRun is called on selection or skip
    this.showVowSelect(() => {
      this._continueNewRun();
    });
  }

  /**
   * Execute the full new-run flow: fetch bonuses, reset run, clear pot,
   * sync dice hand, hide all overlays, sync UI, and fire onNewRun callback.
   * Called after vow selection (or immediately if vow already active, or
   * from the No Vow skip button).
   */
  _continueNewRun() {
    this.hideGameOver();
    this.hide();
    this.hideShop();
    this.hideVowSelect();
    this.hideMap();
    this.sync();
    // Also sync the main HUD
    this.ui.sync();
    if (this.onNewRun) this.onNewRun();
  }

  // ─── SYNC ALL UI ─────────────────────────────────────

  /**
   * Refresh all rogue UI elements: table badge, side pot,
   * reroll tokens, meta XP bar, and delegate main HUD updates.
   */
  sync() {
    const run = this.rogueRun;
    if (!this.statusEl) return;

    // Delegate to main HUD
    this.ui.updateTableProgress(run.game.money, run.getCurrentTarget(), run.isBossTable);
    this.ui.updateBonusPanel(run.getActiveUpgradeList());

    const table = run.getCurrentTable();
    const isBoss = table.boss;
    const actName = MAP_ACTS[run.currentActIndex]?.name || '???';
    const floorNum = run.currentFloorIndex + 1;

    // Keep table display in rogue-info (compact badge with map context)
    if (this.tableEl) {
      this.tableEl.innerHTML = `
        <span class="table-badge ${isBoss ? 'boss' : ''}">
          ${isBoss ? '⚔ ' : ''}${actName}
        </span>
        <span class="table-name">Floor ${floorNum}: ${table.name}</span>
      `;
    }

    // Side pot display (keep this, it's unique to rogue-info)
    let sidePotHTML = '';
    if (run.sidePot > 0) {
      sidePotHTML = `<div class="run-pot">pot: ₡${run.sidePot}</div>`;
    }

    // Build a compact status line for the run-status area
    // (progress bar now in main HUD, so keep this minimal)
    this.statusEl.innerHTML = `
      ${sidePotHTML}
    `;

    // Reroll tokens (keep in meta-foot)
    if (this.rerollEl) {
      this.rerollEl.textContent = run.rerollTokens > 0 ? `⟳ ${run.rerollTokens}` : '';
    }

    // Meta display (keep in meta-foot)
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

  /**
   * Display the bust (game over) screen with run summary,
   * XP earned, and new-run button. Records run as a loss.
   */
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
      <p class="run-final">finished with ₡${summary.finalMoney}</p>
      ${this._xpHTML()}
      <button id="new-game-btn">new run</button>
    `;
    document.getElementById('game-over').classList.add('visible');
    this._rehookNewGame();
  }

  /**
   * Display the run-won victory screen with run summary,
   * side-pot payout, XP earned, and new-run button. Records run as a win.
   */
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
        ? `<p class="run-pot-payout" style="color: #4caf50">side pot x2: +₡${summary.bonusPot}</p>`
        : ''}
      ${summary.upgrades.length > 0
        ? `<p class="run-upgrades-line">${summary.upgrades.join(' \u00b7 ')}</p>`
        : ''}
      <p class="run-final" style="color: #ffd700">final: ₡${summary.finalMoney}</p>
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

  /** Dismiss the game-over overlay and remove any level-up banners */
  hideGameOver() {
    document.getElementById('game-over').classList.remove('visible');
    // Remove level-up banners
    document.querySelectorAll('.level-up-banner').forEach(el => el.remove());
  }

  // ─── INTERNALS ───────────────────────────────────────

  /**
   * Record a completed run in meta-progression: calc XP, add XP,
   * store pending level-up for display in the end screen.
   * @param {boolean} won - Whether the run was won
   */
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

  /**
   * Generate XP and level-up HTML for end-of-run screens.
   * Consumes the stored _lastXPEarned and _pendingLevelUp values.
   * @returns {string} HTML string with XP earned and optional level-up banner
   */
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

  /**
   * Re-attach the new-run button handler to reset the run,
   * hide all overlays, fetch fresh meta bonuses, and sync UI.
   * Uses startNewRun() to gate behind vow selection if needed.
   */
  _rehookNewGame() {
    const btn = document.getElementById('new-game-btn');
    const old = btn._listener;
    if (old) btn.removeEventListener('click', old);
    const handler = () => {
      this.startNewRun();
    };
    btn.addEventListener('click', handler);
    btn._listener = handler;
  }
}
