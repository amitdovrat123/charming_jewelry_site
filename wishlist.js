// wishlist.js — "הרשימה שלי" (favorites) drawer + localStorage logic
// Shared across index.html and shop.html. Plain script (no module).
// Storage key: charming-wishlist  →  Array<{id, name, price, imageUrl}>

(function () {
  'use strict';

  const WL_KEY   = 'charming-wishlist';
  const CART_KEY = 'charming-cart';

  // ── tiny i18n helper (uses lang.js global `t` if loaded) ────────
  function tr(key, fb) {
    return (typeof window.t === 'function') ? window.t(key, fb) : fb;
  }

  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── storage ─────────────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch { return []; }
  }
  function save(list) {
    localStorage.setItem(WL_KEY, JSON.stringify(list));
  }
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  // ── public API ──────────────────────────────────────────────────
  function isInWishlist(id) {
    return load().some(i => i.id === id);
  }

  function add(item) {
    if (!item || !item.id) return;
    const list = load();
    if (list.some(i => i.id === item.id)) return;
    list.push({
      id:       item.id,
      name:     item.name || '',
      price:    Number(item.price) || 0,
      imageUrl: item.imageUrl || '',
    });
    save(list);
    refreshUI();
  }

  function remove(id) {
    save(load().filter(i => i.id !== id));
    refreshUI();
  }

  function toggle(item) {
    if (isInWishlist(item.id)) {
      remove(item.id);
      return false;
    }
    add(item);
    return true;
  }

  // ── badge + heart sync ──────────────────────────────────────────
  function updateBadge() {
    const count = load().length;
    document.querySelectorAll('.wishlist-badge').forEach(el => {
      el.textContent   = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  function syncHearts() {
    document.querySelectorAll('.sp-card-fav[data-fav-id]').forEach(btn => {
      const id = btn.getAttribute('data-fav-id');
      btn.classList.toggle('is-fav', isInWishlist(id));
    });
  }

  function refreshUI() {
    updateBadge();
    syncHearts();
    if (drawerOpen) renderDrawerItems();
  }

  // ── add to cart from wishlist drawer ────────────────────────────
  function addToCartFromWishlist(id) {
    const item = load().find(i => i.id === id);
    if (!item) return;
    const cart = loadCart();
    const existing = cart.find(c => c.id === id && !c.size);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      cart.push({
        id:       item.id,
        name:     item.name,
        price:    item.price,
        imageUrl: item.imageUrl,
        qty:      1,
        customizationNote: null,
        size:     null,
      });
    }
    saveCart(cart);
    remove(id);
    // update cart badge (cart logic lives in catalog.js / shop.js / nav.js)
    updateCartBadge();
    showToast(tr('wl_moved_to_cart', 'הועבר לסל'));
  }

  function updateCartBadge() {
    const count = loadCart().reduce((s, i) => s + (i.qty || 1), 0);
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent   = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  // ── toast ───────────────────────────────────────────────────────
  function showToast(msg) {
    let el = document.getElementById('wl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wl-toast';
      el.className = 'wl-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('wl-toast--show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('wl-toast--show'), 1800);
  }

  // ── drawer ──────────────────────────────────────────────────────
  let drawerOpen = false;

  function buildDrawer() {
    if (document.getElementById('wl-drawer')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="wl-backdrop" id="wl-backdrop" hidden></div>
      <aside class="wl-drawer" id="wl-drawer" role="dialog" aria-modal="true" aria-labelledby="wl-title" hidden>
        <header class="wl-header">
          <button class="wl-close" id="wl-close" type="button" aria-label="${esc(tr('wl_close','סגור'))}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h2 class="wl-title" id="wl-title">
            <span>${esc(tr('wl_title','הרשימה שלי'))}</span>
            <span class="wl-title-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span class="wl-title-count" id="wl-title-count">0</span>
            </span>
          </h2>
        </header>
        <div class="wl-body" id="wl-body"></div>
      </aside>`;
    document.body.appendChild(wrap);

    document.getElementById('wl-close').addEventListener('click', close);
    document.getElementById('wl-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawerOpen) close();
    });
  }

  function renderDrawerItems() {
    const body  = document.getElementById('wl-body');
    const count = document.getElementById('wl-title-count');
    if (!body) return;
    const items = load();
    if (count) count.textContent = items.length;

    if (!items.length) {
      body.innerHTML = `
        <div class="wl-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="opacity:.35;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <p class="wl-empty-title">${esc(tr('wl_empty_title','הרשימה שלך ריקה'))}</p>
          <p class="wl-empty-sub">${esc(tr('wl_empty_sub','סמני לב על מוצרים אהובים כדי לשמור אותם כאן'))}</p>
          <a class="wl-empty-cta" href="shop.html">${esc(tr('wl_empty_cta','המשיכי לקנייה'))}</a>
        </div>`;
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="wl-item" data-wl-id="${esc(item.id)}">
        <div class="wl-item-img">
          ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" loading="lazy" />` : '<div class="wl-item-placeholder">💎</div>'}
        </div>
        <div class="wl-item-info">
          <h3 class="wl-item-name">${esc(item.name)}</h3>
          <div class="wl-item-price">${esc(item.price)} ₪</div>
          <button class="wl-item-add" type="button" data-wl-add="${esc(item.id)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span>${esc(tr('wl_add_to_cart','הוספה לסל'))}</span>
          </button>
        </div>
        <button class="wl-item-remove" type="button" data-wl-remove="${esc(item.id)}" aria-label="${esc(tr('wl_remove','הסירי מהרשימה'))}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');

    body.querySelectorAll('[data-wl-add]').forEach(btn => {
      btn.addEventListener('click', () => addToCartFromWishlist(btn.getAttribute('data-wl-add')));
    });
    body.querySelectorAll('[data-wl-remove]').forEach(btn => {
      btn.addEventListener('click', () => remove(btn.getAttribute('data-wl-remove')));
    });
  }

  function open() {
    buildDrawer();
    renderDrawerItems();
    document.getElementById('wl-backdrop').hidden = false;
    document.getElementById('wl-drawer').hidden   = false;
    requestAnimationFrame(() => {
      document.getElementById('wl-backdrop').classList.add('wl-backdrop--open');
      document.getElementById('wl-drawer').classList.add('wl-drawer--open');
    });
    document.body.style.overflow = 'hidden';
    drawerOpen = true;
  }

  function close() {
    const bd = document.getElementById('wl-backdrop');
    const dr = document.getElementById('wl-drawer');
    if (!bd || !dr) return;
    bd.classList.remove('wl-backdrop--open');
    dr.classList.remove('wl-drawer--open');
    drawerOpen = false;
    document.body.style.overflow = '';
    setTimeout(() => { bd.hidden = true; dr.hidden = true; }, 280);
  }

  // ── boot ────────────────────────────────────────────────────────
  function boot() {
    buildDrawer();
    updateBadge();
    syncHearts();
    document.getElementById('nav-wishlist-btn')?.addEventListener('click', e => {
      e.preventDefault();
      open();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // sync across tabs
  window.addEventListener('storage', e => {
    if (e.key === WL_KEY) refreshUI();
    if (e.key === CART_KEY) updateCartBadge();
  });

  // expose to other modules (catalog.js / shop.js)
  window.WishlistAPI = {
    isInWishlist, add, remove, toggle,
    open, close,
    updateBadge, syncHearts, refresh: refreshUI,
  };
})();
