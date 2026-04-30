// shop.js — Standalone shop page logic for shop.html
// Imports Firebase, subscribes to Firestore in real-time, manages cart via localStorage.

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Constants ──────────────────────────────────────────────────
const COL_PATH            = 'artifacts/charming-3dd6f/public/data/products';
const CART_KEY            = 'charming-cart';
const FREE_SHIP_THRESHOLD = 400;

const CATEGORIES = ['שרשראות', 'צמידים', 'עגילים', 'טבעות', 'מארזי Charming ביתיים'];
const COLORS     = ['זהב', 'כסף', 'זהב ורוד'];

// ── State ──────────────────────────────────────────────────────
let allProducts    = [];
let productsLoaded = false;

// Pre-filter from URL params (e.g. from category grid on home page)
const _p = new URLSearchParams(location.search);
let filterCat      = _p.get('cat')   || '';
let filterColor    = _p.get('color') || '';
let filterFeatured = _p.has('featured');
let filterSearch   = '';
let filterPriceMax = parseInt(_p.get('price') || '0') || 0;
let filterOnSale   = _p.has('sale');

// ── Cart ───────────────────────────────────────────────────────
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function updateCartBadge() {
  const count = loadCart().reduce((s, i) => s + (i.qty || 1), 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent   = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

window.addToCartShop = function (productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const { data, id } = product;
  const cart     = loadCart();
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id,
      name:     data.name,
      price:    sellPrice(data),
      imageUrl: getImages(data)[0] || '',
      qty:      1,
    });
  }
  saveCart(cart);
  updateCartBadge();
  showToast(t('shop_added_toast', 'נוסף לסל!'));
};

// ── Helpers ────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getImages(data) {
  if (Array.isArray(data.images) && data.images.length) return data.images;
  if (data.imageUrl) return [data.imageUrl];
  return [];
}
function getPrice(data)  { return parseInt(data.priceOriginal ?? data.price)    || 0; }
function getSale(data)   { return parseInt(data.priceSale    ?? data.salePrice) || 0; }
function sellPrice(data) { const p = getPrice(data), s = getSale(data); return (s > 0 && s < p) ? s : p; }
function isOOS(data)     { const s = data.stockCount ?? data.stock ?? null; return s !== null && s <= 0; }

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('sp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sp-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2c2a29;color:#fff;padding:12px 28px;border-radius:50px;font-size:0.9rem;z-index:9999;opacity:0;transition:opacity 0.25s;pointer-events:none;font-family:Assistant,Heebo,sans-serif;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

// ── Bilingual helpers ──────────────────────────────────────────
function localName(data) {
  if (typeof getLang === 'function' && getLang() === 'en' && data.nameEn) return data.nameEn;
  return data.name;
}

const _catMap = {
  'שרשראות': '_cat_necklaces', 'צמידים': '_cat_bracelets', 'עגילים': '_cat_earrings',
  'טבעות': '_cat_rings', 'מארזי Charming': '_cat_charming_sets', 'מארזי Charming ביתיים': '_cat_charming_sets',
};
const _badgeMap = { 'בסט-סלר': '_badge_bestseller', 'חדש': '_badge_new', 'מבצע': '_badge_sale', 'מהדורה מוגבלת': '_badge_limited' };
const _colorMap = { 'זהב': '_color_gold', 'כסף': '_color_silver', 'זהב ורוד': '_color_rosegold' };
const _matMap   = { 'פלדת אל-חלד': '_mat_stainless' };
function localCat(v)      { return (typeof t === 'function' && _catMap[v])   ? t(_catMap[v], v)   : v; }
function localBadge(v)    { return (typeof t === 'function' && _badgeMap[v]) ? t(_badgeMap[v], v) : v; }
function localColor(v)    { return (typeof t === 'function' && _colorMap[v]) ? t(_colorMap[v], v) : v; }
function localMaterial(v) { return (typeof t === 'function' && _matMap[v])   ? t(_matMap[v], v)   : v; }

// ── Card HTML ──────────────────────────────────────────────────
function cardHTML(product) {
  const { data, id } = product;
  const imgs  = getImages(data);
  const price = getPrice(data);
  const sale  = getSale(data);
  const sp    = sellPrice(data);
  const badge = data.badge || '';
  const oos   = isOOS(data);
  const sid   = esc(id);

  const imgHtml = imgs.length
    ? imgs.map((src, i) =>
        `<img class="sp-slide${i === 0 ? ' sp-slide--active' : ''}" src="${esc(src)}" alt="${esc(data.name)}" loading="${i === 0 ? 'eager' : 'lazy'}" />`
      ).join('')
    : `<div class="sp-card-img-placeholder">💎</div>`;

  const arrowsHtml = imgs.length > 1
    ? `<button class="sp-img-arrow sp-img-arrow--prev" aria-label="תמונה קודמת">‹</button><button class="sp-img-arrow sp-img-arrow--next" aria-label="תמונה הבאה">›</button><div class="sp-img-dots">${imgs.map((_, i) => `<span class="sp-img-dot${i === 0 ? ' sp-img-dot--active' : ''}" data-dot="${i}"></span>`).join('')}</div>`
    : '';

  const badgeHtml = (badge && !oos) ? `<span class="sp-card-badge">${esc(localBadge(badge))}</span>` : '';
  const oosBadge  = oos ? `<span class="sp-card-badge sp-card-badge--oos">${t('shop_oos_badge', 'אזל')}</span>` : '';

  const priceHtml = (sale > 0 && sale < price)
    ? `<span class="sp-card-sale">${sp} ₪</span><span class="sp-card-orig">${price} ₪</span>`
    : `<span class="sp-card-price">${sp} ₪</span>`;

  const customBadge  = data.isCustomizable
    ? `<div class="sp-custom-badge">${t('shop_customizable', '✦ ניתן להתאמה אישית — ציינו את בחירתכם בהזמנה')}</div>` : '';

  const actionBtn = oos
    ? `<button class="sp-card-add sp-card-add--oos" disabled>${t('shop_oos', 'אזל מהמלאי')}</button>`
    : `<button class="sp-card-add" data-add-id="${sid}">${t('shop_add_to_cart', 'הוסיפי לסל')}</button>`;

  const pName = localName(data);
  return `
    <div class="sp-shop-card fadein" data-view-id="${sid}" role="button" tabindex="0" aria-label="${esc(pName)}">
      <div class="sp-card-img-wrap">
        ${imgHtml}${arrowsHtml}${badgeHtml || oosBadge}
        <button class="sp-card-quickview" data-view-id="${sid}" aria-label="${t('shop_quickview', 'צפייה מהירה')}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="sp-card-body">
        <h3 class="sp-card-name">${esc(pName)}</h3>
        <div class="sp-card-price-row">${priceHtml}</div>
        ${customBadge}
        ${actionBtn}
      </div>
    </div>`;
}

// ── Main render ────────────────────────────────────────────────
function render() {
  const el = document.getElementById('shop-main');
  if (!el) return;

  const published = allProducts.filter(p => p.data.status === 'published');

  // Merge predefined lists with any categories/colors found in Firestore
  const dataCats   = [...new Set(published.map(p => p.data.category).filter(Boolean))];
  const dataColors = [...new Set(published.map(p => p.data.color).filter(Boolean))];
  const allCats    = [...new Set([...CATEGORIES, ...dataCats])];
  const allColors  = [...new Set([...COLORS, ...dataColors])];

  // Apply all active filters
  let filtered = published;
  if (filterCat)      filtered = filtered.filter(p => p.data.category === filterCat);
  if (filterColor)    filtered = filtered.filter(p => p.data.color    === filterColor);
  if (filterFeatured) filtered = filtered.filter(p => p.data.isFeatured);
  if (filterSearch) {
    const s = filterSearch.toLowerCase();
    filtered = filtered.filter(p =>
      (p.data.name || '').toLowerCase().includes(s) ||
      (p.data.sku  || '').toLowerCase().includes(s)
    );
  }
  if (filterPriceMax) filtered = filtered.filter(p => sellPrice(p.data) <= filterPriceMax);
  if (filterOnSale)   filtered = filtered.filter(p => {
    const s = getSale(p.data), pr = getPrice(p.data);
    return s > 0 && s < pr;
  });

  const hasFilter   = filterCat || filterColor || filterFeatured || filterSearch || filterPriceMax || filterOnSale;
  const isAllActive = !filterCat && !filterFeatured;

  // Free-ship bar (slim)
  const cartSubtotal = loadCart().reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const freeShipLine = cartSubtotal >= FREE_SHIP_THRESHOLD
    ? t('shop_freeship_eligible', '✅ זכאית למשלוח חינם!')
    : `${t('shop_freeship_over', '🚚 משלוח חינם בקנייה מעל')} <strong>${FREE_SHIP_THRESHOLD} ₪</strong>${cartSubtotal > 0 ? ` — ${t('shop_freeship_more', 'עוד')} <strong>${FREE_SHIP_THRESHOLD - cartSubtotal} ₪</strong>` : ''}`;

  // Category pills — top bar (outside drawer)
  const catPillsHTML = [
    `<button class="sp-cat-pill${isAllActive ? ' sp-cat-pill--active' : ''}" data-filter-cat="" data-filter-feat="false">${t('shop_all', 'הכל')}</button>`,
    ...allCats.map(c =>
      `<button class="sp-cat-pill${filterCat === c && !filterFeatured ? ' sp-cat-pill--active' : ''}" data-filter-cat="${esc(c)}" data-filter-feat="false">${esc(localCat(c))}</button>`
    ),
    `<button class="sp-cat-pill${filterFeatured ? ' sp-cat-pill--active' : ''}" data-filter-cat="" data-filter-feat="true">${t('shop_featured_pill', 'מוצרים נבחרים ⭐')}</button>`,
  ].join('');

  // Color pills for drawer
  const colorPillsHTML = [
    `<button class="sp-pill${!filterColor ? ' sp-pill--active' : ''}" data-filter-color="">${t('shop_all', 'הכל')}</button>`,
    ...allColors.map(c =>
      `<button class="sp-pill${filterColor === c ? ' sp-pill--active' : ''}" data-filter-color="${esc(c)}">${esc(localColor(c))}</button>`
    ),
  ].join('');

  // Grid content
  const gridHtml = !productsLoaded
    ? `<div class="catalog-loading"><div class="catalog-spinner"></div><p>${t('shop_loading_js', 'טוענת מוצרים...')}</p></div>`
    : filtered.length
      ? filtered.map(cardHTML).join('')
      : `<div class="sp-empty"><p>${t('shop_no_results', 'לא נמצאו מוצרים התואמים את הסינון שנבחר')}</p><button class="btn btn-outline" id="reset-filters-btn">${t('shop_reset_filters', 'איפוס פילטרים')}</button></div>`;

  el.innerHTML = `
    <div class="container">

      <div class="sp-hero">
        <span class="section-eyebrow">${t('shop_hero_eyebrow_js', 'כל הקולקציה')}</span>
        <h1 class="sp-title">${t('shop_hero_title_js', 'החנות שלנו')}</h1>
        <p class="sp-subtitle">${t('shop_hero_sub_js', 'כל הפריטים הזמינים — סני לפי קטגוריה, גוון, או מוצרים מומלצים.')}</p>
      </div>

      <div class="sp-freeship-slim">${freeShipLine}</div>

      <div class="sp-cat-bar">${catPillsHTML}</div>

      <div class="sp-filter-trigger-row">
        <button id="sp-filter-btn" class="sp-filter-trigger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          ${t('shop_filter_btn', 'סינון ומיון')}
        </button>
        <p class="sp-results-count">${t('shop_showing', 'מציגה')} <strong>${productsLoaded ? filtered.length : '...'}</strong> ${t('shop_products', 'מוצרים')}${hasFilter ? ` &nbsp;<button class="sp-clear-btn" id="clear-filters">× ${t('shop_clear_filter', 'נקי')}</button>` : ''}</p>
      </div>

      <div id="sp-backdrop" class="sp-drawer-backdrop"></div>
      <aside id="sp-drawer" class="sp-drawer" role="dialog" aria-label="${t('shop_drawer_title', 'סינון ומיון')}">
        <div class="sp-drawer-header">
          <h3>${t('shop_drawer_title', 'סינון ומיון')}</h3>
          <button id="sp-drawer-close" class="sp-drawer-close-btn" aria-label="סגור">✕</button>
        </div>
        <div class="sp-drawer-body">
          <div class="sp-drawer-section">
            <h4 class="sp-drawer-section-title">${t('shop_color_title', 'גוון')}</h4>
            <div class="sp-pills-row" id="drawer-color-pills">${colorPillsHTML}</div>
          </div>
          <div class="sp-drawer-section">
            <h4 class="sp-drawer-section-title">${t('shop_search_title', 'חיפוש')}</h4>
            <div class="sp-search-row">
              <input type="text" id="search-input" class="sp-search-input" placeholder="${t('shop_search_ph', 'חפשי לפי שם מוצר או SKU...')}" value="${esc(filterSearch)}" autocomplete="off" />
            </div>
          </div>
          <div class="sp-drawer-section">
            <h4 class="sp-drawer-section-title">${t('shop_price_title', 'מחיר')}</h4>
            <div class="sp-pills-row" id="drawer-price-pills">
              ${[0, 100, 250, 500].map(v =>
                `<button class="sp-pill${filterPriceMax === v ? ' sp-pill--active' : ''}" data-filter-price="${v}">${v === 0 ? t('shop_price_all', 'הכל') : `${t('shop_price_up_to', 'עד')} ${v} ₪`}</button>`
              ).join('')}
            </div>
          </div>
          <div class="sp-drawer-section">
            <h4 class="sp-drawer-section-title">${t('shop_sales_title', 'מבצעים')}</h4>
            <button class="sp-pill${filterOnSale ? ' sp-pill--active' : ''}" id="shop-sale-toggle">${t('shop_sale_toggle', 'מוצרים במבצע')}</button>
          </div>
          <div class="sp-drawer-footer">
            <button class="btn btn-outline" id="shop-drawer-reset" style="flex:1;">${t('shop_reset', 'איפוס')}</button>
            <button class="btn" id="shop-drawer-apply" style="flex:2;">${t('shop_show_results', 'הצגי תוצאות')}</button>
          </div>
        </div>
      </aside>

      <div id="shop-grid" class="sp-shop-grid">${gridHtml}</div>

    </div>`;

  // Apply language translations to any data-i18n attributes
  if (typeof applyLang === 'function') applyLang();

  // ── Bind events ──────────────────────────────────────────────

  const openDrawer  = () => { el.querySelector('#sp-drawer').classList.add('sp-drawer--open'); el.querySelector('#sp-backdrop').classList.add('sp-drawer-backdrop--open'); };
  const closeDrawer = () => { el.querySelector('#sp-drawer').classList.remove('sp-drawer--open'); el.querySelector('#sp-backdrop').classList.remove('sp-drawer-backdrop--open'); };

  el.querySelector('#sp-filter-btn').addEventListener('click', openDrawer);
  el.querySelector('#sp-drawer-close').addEventListener('click', closeDrawer);
  el.querySelector('#sp-backdrop').addEventListener('click', closeDrawer);

  // "הצגי תוצאות" — apply pending drawer filters & close
  el.querySelector('#shop-drawer-apply').addEventListener('click', () => {
    // Read pending search text
    const si = el.querySelector('#search-input');
    if (si) filterSearch = si.value.trim();
    closeDrawer();
    render();
  });

  // ── Category top bar — immediate filter ──
  el.querySelectorAll('[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterCat      = btn.dataset.filterCat;
      filterFeatured = btn.dataset.filterFeat === 'true';
      render();
    });
  });

  // ── Drawer pills — toggle visually in-place, no render ──

  // Color pills (toggle active class only)
  el.querySelectorAll('[data-filter-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.filterColor;
      filterColor = filterColor === val ? '' : val;
      el.querySelectorAll('[data-filter-color]').forEach(b =>
        b.classList.toggle('sp-pill--active', (filterColor === '' && b.dataset.filterColor === '') || b.dataset.filterColor === filterColor));
    });
  });

  // Price pills (toggle active class only)
  el.querySelectorAll('[data-filter-price]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterPriceMax = parseInt(btn.dataset.filterPrice) || 0;
      el.querySelectorAll('[data-filter-price]').forEach(b =>
        b.classList.toggle('sp-pill--active', parseInt(b.dataset.filterPrice || '0') === filterPriceMax));
    });
  });

  // Sale toggle (toggle active class only)
  el.querySelector('#shop-sale-toggle')?.addEventListener('click', () => {
    filterOnSale = !filterOnSale;
    el.querySelector('#shop-sale-toggle')?.classList.toggle('sp-pill--active', filterOnSale);
  });

  // Search — Enter applies immediately
  const searchInput = el.querySelector('#search-input');
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      filterSearch = (searchInput.value || '').trim();
      closeDrawer();
      render();
    }
  });

  // Clear all filters
  const resetAll = () => {
    filterCat = ''; filterColor = ''; filterFeatured = false;
    filterSearch = ''; filterPriceMax = 0; filterOnSale = false;
    render();
  };
  el.querySelector('#clear-filters')?.addEventListener('click', resetAll);
  el.querySelector('#shop-drawer-reset')?.addEventListener('click', () => {
    filterColor = ''; filterSearch = ''; filterPriceMax = 0; filterOnSale = false;
    // Update drawer UI without closing
    el.querySelectorAll('[data-filter-color]').forEach(b =>
      b.classList.toggle('sp-pill--active', b.dataset.filterColor === ''));
    el.querySelectorAll('[data-filter-price]').forEach(b =>
      b.classList.toggle('sp-pill--active', parseInt(b.dataset.filterPrice || '0') === 0));
    el.querySelector('#shop-sale-toggle')?.classList.remove('sp-pill--active');
    const si = el.querySelector('#search-input');
    if (si) si.value = '';
  });
  el.querySelector('#reset-filters-btn')?.addEventListener('click', resetAll);

  // Card click → product detail on index.html
  el.querySelectorAll('.sp-shop-card').forEach(card => {
    const go = () => {
      window.location.href = 'index.html?product=' + encodeURIComponent(card.dataset.viewId);
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  // Quick-view (same navigation as card click)
  el.querySelectorAll('.sp-card-quickview').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = 'index.html?product=' + encodeURIComponent(btn.dataset.viewId);
    });
  });

  // Add-to-cart buttons
  el.querySelectorAll('[data-add-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.addToCartShop(btn.dataset.addId);
    });
  });

  // Image slide arrows
  el.querySelectorAll('.sp-img-arrow').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wrap = btn.closest('.sp-card-img-wrap');
      const slides = wrap.querySelectorAll('.sp-slide');
      const dots = wrap.querySelectorAll('.sp-img-dot');
      if (slides.length < 2) return;
      const cur = wrap.querySelector('.sp-slide--active');
      const idx = [...slides].indexOf(cur);
      const dir = btn.classList.contains('sp-img-arrow--next') ? 1 : -1;
      const next = (idx + dir + slides.length) % slides.length;
      cur.classList.remove('sp-slide--active');
      slides[next].classList.add('sp-slide--active');
      dots.forEach((d, i) => d.classList.toggle('sp-img-dot--active', i === next));
    });
  });

  // Image dots
  el.querySelectorAll('.sp-img-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const wrap = dot.closest('.sp-card-img-wrap');
      const slides = wrap.querySelectorAll('.sp-slide');
      const dots = wrap.querySelectorAll('.sp-img-dot');
      const target = parseInt(dot.dataset.dot);
      slides.forEach((s, i) => s.classList.toggle('sp-slide--active', i === target));
      dots.forEach((d, i) => d.classList.toggle('sp-img-dot--active', i === target));
    });
  });
}

// ── Firestore real-time subscription ──────────────────────────
const q = query(collection(db, COL_PATH), orderBy('createdAt', 'desc'));
onSnapshot(q, snap => {
  allProducts    = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  productsLoaded = true;
  render();
  updateCartBadge();
}, err => {
  console.error('[shop.js] Firestore error:', err);
  productsLoaded = true;
  render();
});

// Re-render when language changes (bilingual product names)
window._rerenderProducts = function() { render(); };

// Initial render (shows loading skeleton while Firestore loads)
document.addEventListener('DOMContentLoaded', () => {
  render();
  updateCartBadge();
});
