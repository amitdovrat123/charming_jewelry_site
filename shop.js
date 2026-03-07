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
  showToast('נוסף לסל!');
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

  const imgHtml = imgs[0]
    ? `<img src="${esc(imgs[0])}" alt="${esc(data.name)}" loading="lazy" />`
    : `<div class="sp-card-img-placeholder">💎</div>`;

  const badgeHtml = (badge && !oos) ? `<span class="sp-card-badge">${esc(badge)}</span>` : '';
  const oosBadge  = oos ? `<span class="sp-card-badge sp-card-badge--oos">אזל</span>` : '';

  const priceHtml = (sale > 0 && sale < price)
    ? `<span class="sp-card-sale">${sp} ₪</span><span class="sp-card-orig">${price} ₪</span>`
    : `<span class="sp-card-price">${sp} ₪</span>`;

  const metalChip = data.color ? `<span class="sp-card-metal">${esc(data.color)}</span>` : '';

  const actionBtn = oos
    ? `<button class="sp-card-add sp-card-add--oos" disabled>אזל מהמלאי</button>`
    : `<button class="sp-card-add" data-add-id="${sid}">הוסיפי לסל</button>`;

  return `
    <div class="sp-shop-card fadein" data-view-id="${sid}" role="button" tabindex="0" aria-label="${esc(data.name)}">
      <div class="sp-card-img-wrap">
        ${imgHtml}${badgeHtml || oosBadge}
      </div>
      <div class="sp-card-body">
        <h3 class="sp-card-name">${esc(data.name)}</h3>
        ${data.sku ? `<p class="sp-card-sku">SKU: ${esc(data.sku)}</p>` : ''}
        <div class="sp-card-price-row">${priceHtml}${metalChip}</div>
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

  const hasFilter = filterCat || filterColor || filterFeatured || filterSearch;
  const isAllActive = !filterCat && !filterFeatured;

  // Free-ship banner
  const cartSubtotal = loadCart().reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const freeShipHtml = cartSubtotal >= FREE_SHIP_THRESHOLD
    ? `<div class="sp-freeship sp-freeship--done">✅ מזל טוב! הגעת ל-${FREE_SHIP_THRESHOLD} ₪ — <strong>משלוח חינם!</strong></div>`
    : `<div class="sp-freeship">🚚 משלוח חינם בקנייה מעל <strong>${FREE_SHIP_THRESHOLD} ₪</strong>${cartSubtotal > 0 ? ` — עוד <strong>${FREE_SHIP_THRESHOLD - cartSubtotal} ₪</strong>!` : ''}</div>`;

  // Category pills
  const catPillsHTML = [
    `<button class="sp-pill${isAllActive ? ' sp-pill--active' : ''}" data-filter-cat="" data-filter-feat="false">הכל</button>`,
    ...allCats.map(c =>
      `<button class="sp-pill${filterCat === c && !filterFeatured ? ' sp-pill--active' : ''}" data-filter-cat="${esc(c)}" data-filter-feat="false">${esc(c)}</button>`
    ),
  ].join('');

  // Color pills
  const colorPillsHTML = [
    `<button class="sp-pill${!filterColor ? ' sp-pill--active' : ''}" data-filter-color="">הכל</button>`,
    ...allColors.map(c =>
      `<button class="sp-pill${filterColor === c ? ' sp-pill--active' : ''}" data-filter-color="${esc(c)}">${esc(c)}</button>`
    ),
  ].join('');

  // Grid content
  const gridHtml = !productsLoaded
    ? `<div class="catalog-loading"><div class="catalog-spinner"></div><p>טוענת מוצרים...</p></div>`
    : filtered.length
      ? filtered.map(cardHTML).join('')
      : `<div class="sp-empty"><p>לא נמצאו מוצרים התואמים את הסינון שנבחר</p><button class="btn btn-outline" id="reset-filters-btn">איפוס פילטרים</button></div>`;

  el.innerHTML = `
    <div class="container">

      <div class="sp-hero">
        <span class="section-eyebrow">כל הקולקציה</span>
        <h1 class="sp-title">החנות המלאה</h1>
        <p class="sp-subtitle">כל הפריטים הזמינים — סני לפי קטגוריה, גוון, או מוצרים מומלצים.</p>
      </div>

      ${freeShipHtml}

      <div class="sp-filter-bar">

        <div class="sp-filter-row">
          <div class="sp-pills-row">${catPillsHTML}</div>
          <button class="sp-pill sp-pill--star${filterFeatured ? ' sp-pill--active' : ''}" data-filter-cat="" data-filter-feat="true">מוצרים נבחרים ⭐</button>
        </div>

        <div class="sp-filter-row sp-filter-row--secondary">
          <span class="sp-filter-label">גוון</span>
          <div class="sp-pills-row">${colorPillsHTML}</div>
        </div>

        <div class="sp-filter-row sp-filter-row--secondary">
          <span class="sp-filter-label">חיפוש</span>
          <input
            type="text"
            id="search-input"
            class="sp-search-input"
            placeholder="חפשי לפי שם מוצר או SKU..."
            value="${esc(filterSearch)}"
            autocomplete="off"
          />
        </div>

      </div>

      <div class="sp-results-row">
        <p class="sp-results-count">מציגה <strong>${productsLoaded ? filtered.length : '...'}</strong> מוצרים</p>
        ${hasFilter ? `<button class="sp-clear-btn" id="clear-filters">× נקי פילטרים</button>` : ''}
      </div>

      <div id="shop-grid" class="sp-shop-grid">${gridHtml}</div>

    </div>`;

  // ── Bind events ──────────────────────────────────────────────

  // Category + featured pills
  el.querySelectorAll('[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterCat      = btn.dataset.filterCat;
      filterFeatured = btn.dataset.filterFeat === 'true';
      render();
    });
  });

  // Color pills
  el.querySelectorAll('[data-filter-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterColor = filterColor === btn.dataset.filterColor ? '' : btn.dataset.filterColor;
      render();
    });
  });

  // Search
  el.querySelector('#search-input')?.addEventListener('input', e => {
    filterSearch = e.target.value;
    render();
  });

  // Clear all filters
  el.querySelector('#clear-filters')?.addEventListener('click', () => {
    filterCat = ''; filterColor = ''; filterFeatured = false; filterSearch = '';
    render();
  });
  el.querySelector('#reset-filters-btn')?.addEventListener('click', () => {
    filterCat = ''; filterColor = ''; filterFeatured = false; filterSearch = '';
    render();
  });

  // Card click → product detail on index.html
  el.querySelectorAll('.sp-shop-card').forEach(card => {
    const go = () => {
      window.location.href = 'index.html?product=' + encodeURIComponent(card.dataset.viewId);
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  // Add-to-cart buttons
  el.querySelectorAll('[data-add-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.addToCartShop(btn.dataset.addId);
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

// Initial render (shows loading skeleton while Firestore loads)
document.addEventListener('DOMContentLoaded', () => {
  render();
  updateCartBadge();
});
