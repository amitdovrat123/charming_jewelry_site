import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, setDoc, getDocs, where, limit, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Environment ────────────────────────────────────────────────
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

// ── Constants ──────────────────────────────────────────────────
const WA_NUMBER           = '972524131991';
const SHIPPING            = 35;
const FREE_SHIP_THRESHOLD = 400;
const COL_PATH            = 'artifacts/charming-3dd6f/public/data/products';
const USERS_ROOT          = 'artifacts/charming-3dd6f/users';
const ORDERS_COL          = 'artifacts/charming-3dd6f/public/data/orders';
const FORM_KEY            = 'charming-checkout-form';

// Shop predefined filter lists
const SHOP_CATEGORIES = ['שרשראות', 'צמידים', 'עגילים', 'טבעות', 'מארזי Charming'];
const SHOP_COLORS     = ['זהב', 'כסף'];

// ── State ──────────────────────────────────────────────────────
let cart                 = loadCart();
let currentUser          = null;
let allProducts          = [];
let productsLoaded       = false;
let currentProduct       = null;
let userProfile          = {};
let checkoutStep         = 1;
let checkoutItems        = [];
let checkoutCartItems    = [];
let checkoutDelivery     = 'delivery';
let isQuickBuy           = false;
let orderIdGenerated     = null;   // set on successful order, used in thank-you view
let pendingCheckoutAfterAuth = false;   // redirect-after-login flag
let _checkoutStartAtStep2   = false;   // skip step-1 init after auth redirect
let _authInitialized        = false;   // true after first onAuthStateChanged fires
let pendingProductId         = null;   // ?product=ID from shop.html card click

// Product gallery
let pvImages   = [];
let pvSlideIdx = 0;

// Shop filters
let shopFilterCat      = '';
let shopFilterColor    = '';
let shopFilterFeatured = false;
let shopFilterSort     = 'default';
let shopFilterPriceMax = 0;    // 0 = no limit; 100 / 250 / 500
let shopFilterOnSale   = false;

// View state
let currentView  = 'home';
let previousView = 'home';

// ── View management ────────────────────────────────────────────
function switchView(view) {
  if (isLocal) console.debug('[switchView]', view);
  previousView = currentView;
  currentView  = view;
  document.querySelectorAll('.v-section').forEach(el => { el.style.display = 'none'; });
  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';
  window.scrollTo(0, 0);
  if (view === 'home')       renderHome();
  if (view === 'shop')       renderShop();
  if (view === 'product')    renderProductView();
  if (view === 'profile')    renderProfileView();
  if (view === 'checkout')   initCheckoutView();
  if (view === 'thank-you')  renderThankYouView();
}

window.switchView = switchView; // expose to HTML event listeners (module scope isolation)

// ── Category navigation helper ─────────────────────────────────
// Resets all filters before switching to shop, optionally pre-applying a category or featured flag.
function goToShop(cat, featured) {
  shopFilterCat      = cat      ?? '';
  shopFilterColor    = '';
  shopFilterFeatured = featured ?? false;
  shopFilterPriceMax = 0;
  shopFilterOnSale   = false;
  switchView('shop');
}
window.goToShop = goToShop;

// ── Cart helpers ───────────────────────────────────────────────
function loadCart() {
  try { return JSON.parse(localStorage.getItem('charming-cart') || '[]'); } catch { return []; }
}
function saveCart() { localStorage.setItem('charming-cart', JSON.stringify(cart)); }

function addToCart(product, customizationNote) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
    if (customizationNote) existing.customizationNote = customizationNote;
  } else {
    cart.push({
      id:               product.id,
      name:             product.data.name,
      price:            sellPrice(product.data),
      imageUrl:         getImages(product.data)[0] || '',
      qty:              1,
      customizationNote: customizationNote || null,
    });
  }
  saveCart();
  updateCartBadge();
  showToast('נוסף לסל!');
}

function getCartSubtotal() { return cart.reduce((s, i) => s + i.price * (i.qty || 1), 0); }
function getCartCount()    { return cart.reduce((s, i) => s + (i.qty  || 1), 0); }

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent   = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── Data helpers ───────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getImages(data) {
  if (Array.isArray(data.images) && data.images.length) return data.images;
  if (data.imageUrl) return [data.imageUrl];
  return [];
}
function getPrice(data)  { return parseInt(data.priceOriginal ?? data.price)    || 0; }
function getSale(data)   { return parseInt(data.priceSale    ?? data.salePrice) || 0; }
function getStock(data)  { return data.stockCount ?? data.stock ?? null; }
function getBadge(data)  { return data.badge || ''; }
function sellPrice(data) { const p = getPrice(data), s = getSale(data); return (s > 0 && s < p) ? s : p; }
function isOOS(data)     { const s = getStock(data); return s !== null && s <= 0; }

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('v7-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'v7-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2c2a29;color:#fff;padding:12px 28px;border-radius:50px;font-size:0.9rem;z-index:9999;opacity:0;transition:opacity 0.25s;pointer-events:none;font-family:Assistant,Heebo,sans-serif;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

// ── Input style helper ─────────────────────────────────────────
const INP = 'width:100%;padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:inherit;font-size:0.9rem;background:var(--sand-light);box-sizing:border-box;';
const LBL = 'display:block;font-size:0.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;';

// ── Card HTML ──────────────────────────────────────────────────
function cardHTML(product) {
  const { data, id } = product;
  const imgs  = getImages(data);
  const price = getPrice(data);
  const sale  = getSale(data);
  const sp    = sellPrice(data);
  const badge = getBadge(data);
  const oos   = isOOS(data);

  const imgHtml = imgs[0]
    ? `<img src="${esc(imgs[0])}" alt="${esc(data.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">💎</div>`;

  const badgeHtml = badge
    ? `<span class="shop-card-badge" style="position:absolute;top:10px;right:10px;">${esc(badge)}</span>` : '';
  const oosHtml = oos
    ? `<span class="shop-card-badge" style="position:absolute;top:10px;right:10px;background:var(--muted);">אזל</span>` : '';

  const priceHtml = (sale > 0 && sale < price)
    ? `<span style="font-weight:700;color:var(--pink-deep);">${sp} ₪</span> <span style="color:var(--muted);text-decoration:line-through;font-size:0.85rem;">${price} ₪</span>`
    : `<span class="shop-card-price">${price} ₪</span>`;

  return `
    <div class="shop-card fadein" data-product-id="${esc(id)}" style="cursor:pointer;" role="button" tabindex="0" aria-label="${esc(data.name)}">
      <div class="shop-card-img" style="position:relative;overflow:hidden;">
        ${imgHtml}${badgeHtml || oosHtml}
      </div>
      <div class="shop-card-body" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;">
        <h3 style="font-size:0.97rem;font-weight:600;color:var(--ink);margin:0;line-height:1.35;">${esc(data.name)}</h3>
        <div style="display:flex;align-items:center;gap:8px;">${priceHtml}</div>
        <button class="btn" style="margin-top:6px;min-height:40px;font-size:0.82rem;pointer-events:none;">צפי במוצר</button>
      </div>
    </div>`;
}

function bindCardClicks(container) {
  container.querySelectorAll('.shop-card').forEach(card => {
    const handler = () => {
      const product = allProducts.find(p => p.id === card.dataset.productId);
      if (product) showProduct(product);
    };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
  });
}

// ── Shop-specific card HTML (larger, with metal chip + add-to-cart) ─────────
function shopCardHTML(product) {
  const { data, id } = product;
  const sid   = esc(id);
  const imgs  = getImages(data);
  const price = getPrice(data);
  const sale  = getSale(data);
  const sp    = sellPrice(data);
  const badge = getBadge(data);
  const oos   = isOOS(data);

  const imgHtml = imgs[0]
    ? `<img src="${esc(imgs[0])}" alt="${esc(data.name)}" loading="lazy" />`
    : `<div class="sp-card-img-placeholder">💎</div>`;

  const badgeHtml = (badge && !oos)
    ? `<span class="sp-card-badge">${esc(badge)}</span>` : '';
  const oosBadge = oos
    ? `<span class="sp-card-badge sp-card-badge--oos">אזל</span>` : '';

  const priceHtml = (sale > 0 && sale < price)
    ? `<span class="sp-card-sale">${sp} ₪</span><span class="sp-card-orig">${price} ₪</span>`
    : `<span class="sp-card-price">${price} ₪</span>`;

  const metalChip = data.color
    ? `<span class="sp-card-metal">${esc(data.color)}</span>` : '';

  const matChip = data.material
    ? `<span class="sp-card-material">${esc(data.material)}</span>` : '';

  const customField = data.isCustomizable ? `
    <div class="sp-custom-field">
      <div class="sp-custom-field-label-row">
        <label class="sp-custom-field-label" for="custom-note-${sid}">התאמה אישית של צ'ארמים <span class="sp-custom-optional">(אופציונלי)</span></label>
        <span class="sp-custom-info-wrap">
          <button type="button" class="sp-custom-info-btn" aria-label="מידע על מספור הצ'ארמים">?</button>
          <span class="sp-custom-tooltip" role="tooltip">הצ'ארם הימני ביותר בתמונה נחשב למספר 1, הבא אחריו למספר 2 וכן הלאה.</span>
        </span>
      </div>
      <textarea id="custom-note-${sid}" class="sp-custom-textarea" dir="rtl" rows="2"
        placeholder="ציינו את מספר הצ'ארם (מימין לשמאל, הימני הוא 1) ואת השינוי. לדוגמה: 2-מזל תאומים"
      ></textarea>
    </div>` : '';

  const actionBtn = oos
    ? `<button class="sp-card-add sp-card-add--oos" disabled>אזל מהמלאי</button>`
    : `<button class="sp-card-add" data-product-id="${sid}">הוסיפי לסל</button>`;

  return `
    <div class="sp-shop-card fadein" data-product-id="${sid}" role="button" tabindex="0" aria-label="${esc(data.name)}">
      <div class="sp-card-img-wrap">
        ${imgHtml}${badgeHtml || oosBadge}
        <button class="sp-card-quickview" data-view-id="${sid}" aria-label="צפייה מהירה">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="sp-card-body">
        <h3 class="sp-card-name">${esc(data.name)}</h3>
        <div class="sp-card-price-row">${priceHtml}${metalChip}${matChip}</div>
        ${actionBtn}
      </div>
      ${customField}
    </div>`;
}

function bindShopCardClicks(container) {
  container.querySelectorAll('.sp-shop-card').forEach(card => {
    const viewHandler = () => {
      const product = allProducts.find(p => p.id === card.dataset.productId);
      if (product) showProduct(product);
    };
    card.addEventListener('click', viewHandler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') viewHandler(); });
  });
  container.querySelectorAll('.sp-card-add:not([disabled])').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const product = allProducts.find(p => p.id === btn.dataset.productId);
      if (product) {
        const card     = btn.closest('.sp-shop-card');
        const textarea = card?.querySelector('.sp-custom-textarea');
        const note     = textarea?.value?.trim() || null;
        addToCart(product, note);
      }
    });
  });
  // Prevent card navigation when interacting with the customization field
  container.querySelectorAll('.sp-custom-field').forEach(field => {
    field.addEventListener('click', e => e.stopPropagation());
  });
  container.querySelectorAll('.sp-card-quickview').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const product = allProducts.find(p => p.id === btn.dataset.viewId);
      if (product) showProduct(product);
    });
  });
}

// ── Free-ship banner helper ────────────────────────────────────
function freeShipBannerHTML(subtotal) {
  if (subtotal >= FREE_SHIP_THRESHOLD) {
    return `<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:10px 16px;text-align:center;font-size:0.85rem;color:#15803d;margin-bottom:16px;">
      ✅ מזל טוב! הגעת ל-${FREE_SHIP_THRESHOLD} ₪ — <strong>משלוח חינם!</strong>
    </div>`;
  }
  return `<div style="background:var(--pink-light);border:1.5px solid var(--sand-dark);border-radius:12px;padding:10px 16px;text-align:center;font-size:0.85rem;color:var(--ink-soft);margin-bottom:16px;">
    🚚 משלוח חינם בקנייה מעל <strong>${FREE_SHIP_THRESHOLD} ₪</strong>${subtotal > 0 ? ` — עוד <strong>${FREE_SHIP_THRESHOLD - subtotal} ₪</strong>!` : ''}
  </div>`;
}

// ── Home view ──────────────────────────────────────────────────
function renderHome() {
  const grid    = document.getElementById('home-catalog-grid');
  const loadEl  = document.getElementById('home-catalog-loading');
  const emptyEl = document.getElementById('home-catalog-empty');
  if (!grid || !productsLoaded) return;

  const featured = allProducts.filter(p => p.data.status === 'published' && p.data.isFeatured).slice(0, 6);
  if (loadEl) loadEl.style.display = 'none';

  if (!featured.length) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  grid.innerHTML = featured.map(cardHTML).join('');
  bindCardClicks(grid);
}

// ── Shop view ──────────────────────────────────────────────────
function renderShop() {
  const el = document.getElementById('view-shop');
  if (!el) return;

  const published = allProducts.filter(p => p.data.status === 'published');

  // Merge predefined lists with any extra values from Firestore data
  const dataCats   = [...new Set(published.map(p => p.data.category).filter(Boolean))];
  const dataColors = [...new Set(published.map(p => p.data.color).filter(Boolean))];
  const allCats    = [...new Set([...SHOP_CATEGORIES, ...dataCats])];
  const allColors  = [...new Set([...SHOP_COLORS, ...dataColors])];

  // Apply filters
  let filtered = published;
  if (shopFilterCat)      filtered = filtered.filter(p => p.data.category === shopFilterCat);
  if (shopFilterColor)    filtered = filtered.filter(p => p.data.color     === shopFilterColor);
  if (shopFilterFeatured) filtered = filtered.filter(p => p.data.isFeatured);
  if (shopFilterPriceMax) filtered = filtered.filter(p => sellPrice(p.data) <= shopFilterPriceMax);
  if (shopFilterOnSale)   filtered = filtered.filter(p => {
    const s = getSale(p.data), pr = getPrice(p.data);
    return s > 0 && s < pr;
  });

  // Sort
  if (shopFilterSort === 'price-asc')  filtered = [...filtered].sort((a, b) => sellPrice(a.data) - sellPrice(b.data));
  if (shopFilterSort === 'price-desc') filtered = [...filtered].sort((a, b) => sellPrice(b.data) - sellPrice(a.data));

  const subtotal = getCartSubtotal();

  // ── Drawer pill HTML ─────────────────────────────────────────
  const isAllActive = !shopFilterCat && !shopFilterFeatured;
  const catPillsHTML = [
    `<button class="sp-pill${isAllActive ? ' sp-pill--active' : ''}" data-filter-cat="" data-filter-feat="false">הכל</button>`,
    ...allCats.map(c =>
      `<button class="sp-pill${shopFilterCat === c ? ' sp-pill--active' : ''}" data-filter-cat="${esc(c)}" data-filter-feat="false">${esc(c)}</button>`
    ),
    `<button class="sp-pill sp-pill--star${shopFilterFeatured ? ' sp-pill--active' : ''}" data-filter-cat="" data-filter-feat="true">מוצרים נבחרים ⭐</button>`,
  ].join('');

  const colorPillsHTML = [
    `<button class="sp-pill${!shopFilterColor ? ' sp-pill--active' : ''}" data-filter-color="">הכל</button>`,
    ...allColors.map(c =>
      `<button class="sp-pill${shopFilterColor === c ? ' sp-pill--active' : ''}" data-filter-color="${esc(c)}">${esc(c)}</button>`
    ),
  ].join('');

  // ── Grid content ──────────────────────────────────────────────
  const gridContent = filtered.length
    ? filtered.map(shopCardHTML).join('')
    : `<div class="sp-empty"><p>לא נמצאו מוצרים התואמים את הסינון שנבחר</p><button class="btn btn-outline sp-reset-btn">איפוס פילטרים</button></div>`;

  const hasActiveFilter = shopFilterCat || shopFilterColor || shopFilterFeatured || shopFilterPriceMax || shopFilterOnSale;
  const freeShipLine = subtotal >= FREE_SHIP_THRESHOLD
    ? `✅ זכאית למשלוח חינם!`
    : `🚚 משלוח חינם בקנייה מעל <strong>${FREE_SHIP_THRESHOLD} ₪</strong>${subtotal > 0 ? ` — עוד <strong>${FREE_SHIP_THRESHOLD - subtotal} ₪</strong>` : ''}`;

  el.innerHTML = `
    <section class="sp-section">
      <div class="container">

        <button id="shop-back-btn" class="sp-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          חזרה לדף הבית
        </button>

        <div class="sp-hero">
          <span class="section-eyebrow">כל הקולקציה</span>
          <h1 class="sp-title">החנות שלנו</h1>
          <p class="sp-subtitle">כל הפריטים הזמינים — סני לפי קטגוריה, גוון, או מוצרים מומלצים.</p>
        </div>

        <div class="sp-freeship-slim">${freeShipLine}</div>

        <div class="sp-filter-trigger-row">
          <button id="sp-filter-btn" class="sp-filter-trigger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            סינון ומיון
          </button>
          <p class="sp-results-count">מציגה <strong>${filtered.length}</strong> מוצרים${hasActiveFilter ? ` &nbsp;<button class="sp-clear-btn" id="shop-clear-filters">× נקי</button>` : ''}</p>
        </div>

        <div id="sp-backdrop" class="sp-drawer-backdrop"></div>
        <aside id="sp-drawer" class="sp-drawer" role="dialog" aria-label="פילטרים">
          <div class="sp-drawer-header">
            <h3>סינון ומיון</h3>
            <button id="sp-drawer-close" class="sp-drawer-close-btn" aria-label="סגור">✕</button>
          </div>
          <div class="sp-drawer-body">
            <div class="sp-drawer-section">
              <h4 class="sp-drawer-section-title">קטגוריה</h4>
              <div class="sp-pills-row">${catPillsHTML}</div>
            </div>
            <div class="sp-drawer-section">
              <h4 class="sp-drawer-section-title">גוון</h4>
              <div class="sp-pills-row">${colorPillsHTML}</div>
            </div>
            <div class="sp-drawer-section">
              <h4 class="sp-drawer-section-title">מחיר</h4>
              <div class="sp-pills-row">
                ${[0, 100, 250, 500].map(v =>
                  `<button class="sp-pill${shopFilterPriceMax === v ? ' sp-pill--active' : ''}" data-filter-price="${v}">${v === 0 ? 'הכל' : `עד ${v} ₪`}</button>`
                ).join('')}
              </div>
            </div>
            <div class="sp-drawer-section">
              <h4 class="sp-drawer-section-title">מבצעים</h4>
              <button class="sp-pill${shopFilterOnSale ? ' sp-pill--active' : ''}" id="shop-sale-toggle">מוצרים במבצע</button>
            </div>
            <div class="sp-drawer-footer">
              <button class="btn btn-outline" id="shop-drawer-reset" style="flex:1;">איפוס</button>
              <button class="btn" id="shop-drawer-apply" style="flex:2;">הצגי תוצאות (${filtered.length})</button>
            </div>
          </div>
        </aside>

        <div id="shop-grid" class="sp-shop-grid">${gridContent}</div>

      </div>
    </section>`;

  // ── Event listeners ───────────────────────────────────────────
  el.querySelector('#shop-back-btn').addEventListener('click', () => switchView('home'));

  const openDrawer  = () => {
    el.querySelector('#sp-drawer').classList.add('sp-drawer--open');
    el.querySelector('#sp-backdrop').classList.add('sp-drawer-backdrop--open');
  };
  const closeDrawer = () => {
    el.querySelector('#sp-drawer').classList.remove('sp-drawer--open');
    el.querySelector('#sp-backdrop').classList.remove('sp-drawer-backdrop--open');
  };

  el.querySelector('#sp-filter-btn').addEventListener('click', openDrawer);
  el.querySelector('#sp-drawer-close').addEventListener('click', closeDrawer);
  el.querySelector('#sp-backdrop').addEventListener('click', closeDrawer);
  el.querySelector('#shop-drawer-apply').addEventListener('click', closeDrawer);

  el.querySelectorAll('[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      shopFilterCat      = btn.dataset.filterCat;
      shopFilterFeatured = btn.dataset.filterFeat === 'true';
      renderShop();
    });
  });

  el.querySelectorAll('[data-filter-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      shopFilterColor = shopFilterColor === btn.dataset.filterColor ? '' : btn.dataset.filterColor;
      renderShop();
    });
  });

  el.querySelectorAll('[data-filter-price]').forEach(btn => {
    btn.addEventListener('click', () => {
      shopFilterPriceMax = parseInt(btn.dataset.filterPrice) || 0;
      renderShop();
    });
  });

  el.querySelector('#shop-sale-toggle')?.addEventListener('click', () => {
    shopFilterOnSale = !shopFilterOnSale;
    renderShop();
  });

  const resetAll = () => {
    shopFilterCat = ''; shopFilterColor = ''; shopFilterFeatured = false;
    shopFilterPriceMax = 0; shopFilterOnSale = false;
    renderShop();
  };

  el.querySelector('#shop-clear-filters')?.addEventListener('click', resetAll);
  el.querySelector('#shop-drawer-reset')?.addEventListener('click', resetAll);
  el.querySelector('.sp-reset-btn')?.addEventListener('click', resetAll);

  const shopGrid = el.querySelector('#shop-grid');
  if (shopGrid) bindShopCardClicks(shopGrid);
}

// ── Product view ───────────────────────────────────────────────
function showProduct(product) {
  currentProduct = product;
  switchView('product');
}

function renderProductView() {
  const el = document.getElementById('view-product');
  if (!el || !currentProduct) return;

  const { data, id } = currentProduct;
  pvImages   = getImages(data);
  pvSlideIdx = 0;

  const price = getPrice(data);
  const sale  = getSale(data);
  const sp    = sellPrice(data);
  const oos   = isOOS(data);
  const badge = getBadge(data);

  const priceHtml = (sale > 0 && sale < price)
    ? `<span style="font-size:1.6rem;font-weight:700;color:var(--pink-deep);">${sp} ₪</span>
       <span style="font-size:1rem;color:var(--muted);text-decoration:line-through;">${price} ₪</span>
       <span style="background:#fef2f2;color:#ef4444;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:50px;">-${Math.round((1 - sp / price) * 100)}%</span>`
    : `<span style="font-size:1.6rem;font-weight:700;color:var(--ink);">${price} ₪</span>`;

  const metaChips = [
    data.category && `<span style="background:var(--pink-light);color:var(--pink-deep);font-size:0.78rem;font-weight:600;padding:4px 12px;border-radius:50px;">${esc(data.category)}</span>`,
    data.material && `<span style="background:var(--sand);border:1px solid var(--sand-dark);color:var(--ink-soft);font-size:0.78rem;font-weight:600;padding:4px 12px;border-radius:50px;">${esc(data.material)}</span>`,
    data.color    && `<span style="background:var(--sand);border:1px solid var(--sand-dark);color:var(--ink-soft);font-size:0.78rem;font-weight:600;padding:4px 12px;border-radius:50px;">${esc(data.color)}</span>`,
    badge         && `<span style="background:var(--pink);color:#fff;font-size:0.78rem;font-weight:700;padding:4px 12px;border-radius:50px;">${esc(badge)}</span>`,
  ].filter(Boolean).join('');

  const mainImg = pvImages[0]
    ? `<img id="pv-main-img-el" src="${esc(pvImages[0])}" style="width:100%;height:100%;object-fit:cover;" alt="${esc(data.name)}" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;">💎</div>`;

  const navArrows = pvImages.length > 1 ? `
    <button id="pv-prev" aria-label="תמונה קודמת" style="position:absolute;top:50%;transform:translateY(-50%);right:12px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;z-index:2;">›</button>
    <button id="pv-next" aria-label="תמונה הבאה" style="position:absolute;top:50%;transform:translateY(-50%);left:12px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;z-index:2;">‹</button>` : '';

  const thumbnails = pvImages.length > 1 ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      ${pvImages.map((img, i) =>
        `<div class="pv-thumb" data-pv-thumb="${i}" style="width:60px;height:60px;border-radius:8px;overflow:hidden;cursor:pointer;border:2px solid ${i === 0 ? 'var(--pink)' : 'var(--sand-dark)'};flex-shrink:0;transition:.2s;">
          <img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
        </div>`
      ).join('')}
    </div>` : '';

  const actionHtml = oos
    ? `<div style="padding:14px 18px;background:#fef2f2;border-radius:12px;border:1px solid #fecaca;font-size:0.9rem;color:#b91c1c;text-align:center;">המוצר אזל מהמלאי — חיזרי בקרוב</div>`
    : `<div style="display:flex;flex-direction:column;gap:12px;">
        <button id="pv-add-cart" class="btn" style="min-height:48px;font-size:0.97rem;">🛒 הוספה לסל</button>
        <button id="pv-quick-buy" class="btn btn-outline" style="min-height:48px;font-size:0.97rem;">קנייה מהירה</button>
       </div>`;

  el.innerHTML = `
    <section style="min-height:80vh;padding:80px 0 110px;background:var(--sand);">
      <div class="container">
        <button id="pv-back-btn" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.88rem;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:32px;">
          ← חזרה ${previousView === 'shop' ? 'לחנות' : 'לדף הבית'}
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start;" class="pv-layout">
          <div>
            <div style="aspect-ratio:1;border-radius:20px;overflow:hidden;background:var(--pink-light);position:relative;">${mainImg}${navArrows}</div>
            ${thumbnails}
          </div>
          <div style="display:flex;flex-direction:column;gap:18px;">
            ${data.sku ? `<p style="font-size:0.75rem;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin:0;">SKU: ${esc(data.sku)}</p>` : ''}
            <h1 style="font-size:1.75rem;font-weight:700;color:var(--ink);margin:0;line-height:1.25;">${esc(data.name)}</h1>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">${priceHtml}</div>
            ${metaChips ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${metaChips}</div>` : ''}
            ${data.description ? `<p style="font-size:0.97rem;color:var(--ink-soft);line-height:1.75;margin:0;">${esc(data.description)}</p>` : ''}
            ${actionHtml}
          </div>
        </div>
      </div>
    </section>`;

  el.querySelector('#pv-back-btn').addEventListener('click', () => switchView(previousView));

  if (!oos) {
    el.querySelector('#pv-add-cart').addEventListener('click', () => { addToCart(currentProduct); });
    el.querySelector('#pv-quick-buy').addEventListener('click', () => {
      isQuickBuy    = true;
      checkoutItems = [{ id, name: data.name, price: sellPrice(data), imageUrl: pvImages[0] || '', qty: 1 }];
      // Quick buy also requires login — handled in initCheckoutView / step1 next handler
      switchView('checkout');
    });
  }

  if (pvImages.length > 1) {
    el.querySelector('#pv-prev').addEventListener('click', () => pvSetSlide((pvSlideIdx - 1 + pvImages.length) % pvImages.length));
    el.querySelector('#pv-next').addEventListener('click', () => pvSetSlide((pvSlideIdx + 1) % pvImages.length));
    el.querySelectorAll('[data-pv-thumb]').forEach(t => t.addEventListener('click', () => pvSetSlide(parseInt(t.dataset.pvThumb))));
  }
}

function pvSetSlide(idx) {
  pvSlideIdx = idx;
  const imgEl = document.getElementById('pv-main-img-el');
  if (imgEl) imgEl.src = pvImages[idx];
  document.querySelectorAll('.pv-thumb').forEach((t, i) => {
    t.style.borderColor = i === idx ? 'var(--pink)' : 'var(--sand-dark)';
  });
}

// ── Profile view ───────────────────────────────────────────────
function renderProfileView() {
  const el = document.getElementById('view-profile');
  if (!el) return;

  if (!currentUser) {
    el.innerHTML = `
      <section style="min-height:80vh;padding:80px 0;display:flex;align-items:center;justify-content:center;background:var(--sand);">
        <div style="text-align:center;max-width:360px;padding:0 20px;">
          <div style="font-size:4rem;margin-bottom:20px;">🔐</div>
          <h2 style="font-size:1.4rem;font-weight:700;color:var(--ink);margin:0 0 10px;">נדרשת התחברות</h2>
          <p style="color:var(--muted);font-size:0.9rem;margin:0 0 28px;">התחברי לחשבונך לצפייה בהזמנות ועריכת פרטים אישיים.</p>
          <button id="profile-login-btn" class="btn">התחברות / הרשמה</button>
          <button id="profile-back-btn" style="display:block;margin:16px auto 0;background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.88rem;">← חזרה לקניות</button>
        </div>
      </section>`;
    el.querySelector('#profile-login-btn').addEventListener('click', () => document.getElementById('auth-nav-btn')?.click());
    el.querySelector('#profile-back-btn').addEventListener('click', () => switchView(previousView || 'home'));
    return;
  }

  el.innerHTML = `
    <section style="min-height:80vh;padding:80px 0 110px;background:var(--sand);">
      <div class="container" style="max-width:680px;">
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">האזור האישי שלי</h2>
        <div style="display:flex;gap:0;border-bottom:2px solid var(--sand-dark);margin-bottom:32px;">
          <button class="profile-tab" data-tab="info" style="background:none;border:none;border-bottom:3px solid var(--pink);margin-bottom:-2px;padding:10px 22px;font-size:0.95rem;font-weight:600;cursor:pointer;color:var(--ink);transition:.2s;">פרטים אישיים</button>
          <button class="profile-tab" data-tab="orders" style="background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:10px 22px;font-size:0.95rem;font-weight:600;cursor:pointer;color:var(--muted);transition:.2s;">הזמנות שלי</button>
        </div>

        <div id="profile-pane-orders" style="display:none;">
          <div id="orders-loading" style="text-align:center;padding:40px 0;color:var(--muted);">טוענת הזמנות...</div>
          <div id="orders-list" style="display:flex;flex-direction:column;gap:14px;"></div>
          <div id="orders-empty" style="display:none;text-align:center;padding:60px 0;">
            <div style="font-size:3rem;margin-bottom:14px;">📦</div>
            <p style="color:var(--muted);">אין הזמנות עדיין. <a href="#" id="go-shop-link" style="color:var(--pink-deep);">לקניות</a></p>
          </div>
        </div>

        <div id="profile-pane-info" style="display:flex;flex-direction:column;gap:18px;">
          <div style="padding:16px 20px;background:var(--pink-light);border-radius:14px;border:1px solid var(--sand-dark);">
            <p style="margin:0 0 4px;font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;">חשבון</p>
            <p style="margin:0;font-size:0.97rem;color:var(--ink);font-weight:600;">${esc(currentUser.displayName || '')}</p>
            <p style="margin:4px 0 0;font-size:0.88rem;color:var(--muted);">${esc(currentUser.email || '')}</p>
          </div>
          <div>
            <label style="${LBL}">שם מלא</label>
            <input id="prof-name" type="text" value="${esc(userProfile.fullName || currentUser.displayName || '')}" style="${INP}" />
          </div>
          <div>
            <label style="${LBL}">טלפון</label>
            <input id="prof-phone" type="tel" value="${esc(userProfile.phone || '')}" placeholder="05X-XXXXXXX" style="${INP}" />
          </div>
          <div>
            <label style="${LBL}">כתובת למשלוח</label>
            <input id="prof-street" type="text" placeholder="רחוב ומספר" value="${esc(userProfile.street || '')}" style="${INP}margin-bottom:8px;" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <input id="prof-floor" type="text" placeholder="קומה" value="${esc(userProfile.floor || '')}" style="padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:inherit;font-size:0.9rem;background:var(--sand-light);" />
              <input id="prof-apt"   type="text" placeholder="דירה / מס' בית" value="${esc(userProfile.apt || '')}" style="padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:inherit;font-size:0.9rem;background:var(--sand-light);" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <input id="prof-city" type="text" placeholder="עיר"   value="${esc(userProfile.city || '')}" style="padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:inherit;font-size:0.9rem;background:var(--sand-light);" />
              <input id="prof-zip"  type="text" placeholder="מיקוד" value="${esc(userProfile.zip  || '')}" style="padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:inherit;font-size:0.9rem;background:var(--sand-light);" />
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="prof-save-btn" class="btn">שמרי פרטים</button>
            <button id="prof-logout-btn" class="btn btn-outline" style="color:var(--muted);border-color:var(--sand-dark);">התנתקי</button>
          </div>
          <p id="prof-save-msg" style="text-align:center;font-size:0.85rem;color:var(--pink-deep);min-height:1.2rem;"></p>
        </div>
      </div>
    </section>`;

  // Tabs
  el.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.profile-tab').forEach(t => {
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--muted)';
      });
      tab.style.borderBottomColor = 'var(--pink)';
      tab.style.color = 'var(--ink)';
      el.querySelector('#profile-pane-orders').style.display = tab.dataset.tab === 'orders' ? '' : 'none';
      el.querySelector('#profile-pane-info').style.display   = tab.dataset.tab === 'info'   ? 'flex' : 'none';
      if (tab.dataset.tab === 'orders') loadOrders();
    });
  });

  el.querySelector('#profile-back-btn').addEventListener('click', () => switchView(previousView || 'home'));
  el.querySelector('#go-shop-link')?.addEventListener('click', e => { e.preventDefault(); switchView('shop'); });

  el.querySelector('#prof-save-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#prof-save-btn');
    const msg = el.querySelector('#prof-save-msg');
    btn.disabled = true;
    const profileData = {
      fullName: el.querySelector('#prof-name').value.trim(),
      phone:    el.querySelector('#prof-phone').value.trim(),
      street:   el.querySelector('#prof-street').value.trim(),
      floor:    el.querySelector('#prof-floor').value.trim(),
      apt:      el.querySelector('#prof-apt').value.trim(),
      city:     el.querySelector('#prof-city').value.trim(),
      zip:      el.querySelector('#prof-zip').value.trim(),
      email:    currentUser.email,
    };
    try {
      await setDoc(doc(db, USERS_ROOT, currentUser.uid), profileData, { merge: true });
      userProfile = { ...userProfile, ...profileData };
      msg.textContent = '✓ הפרטים נשמרו בהצלחה';
    } catch {
      msg.textContent = 'שגיאה בשמירה. נסי שנית.';
    } finally {
      btn.disabled = false;
      setTimeout(() => { msg.textContent = ''; }, 3000);
    }
  });

  el.querySelector('#prof-logout-btn').addEventListener('click', () => {
    signOut(auth);
    switchView('home');
  });

  function loadOrders() {
    const loadingEl = el.querySelector('#orders-loading');
    const listEl    = el.querySelector('#orders-list');
    const emptyEl   = el.querySelector('#orders-empty');
    if (!loadingEl) return;
    loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    emptyEl.style.display = 'none';
    getDocs(collection(db, `${USERS_ROOT}/${currentUser.uid}/orders`))
      .then(snap => {
        loadingEl.style.display = 'none';
        if (snap.empty) { emptyEl.style.display = 'block'; return; }
        const orders = [];
        snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        listEl.innerHTML = orders.map(order => {
          const date         = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('he-IL') : '';
          const itemsSummary = (order.items || []).map(i => `${i.name} ×${i.qty || 1}`).join(', ');
          const dlvLabel     = order.delivery === 'delivery' ? 'משלוח עד הבית' : 'איסוף עצמי';
          return `
            <div style="border:1px solid var(--sand-dark);border-radius:14px;padding:16px 20px;background:var(--sand-light);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <span style="font-size:0.8rem;color:var(--muted);">${date}</span>
                <span style="font-weight:700;color:var(--ink-soft);">${order.total || 0} ₪</span>
              </div>
              <p style="margin:0 0 4px;font-size:0.9rem;color:var(--ink-soft);">${itemsSummary}</p>
              <p style="margin:0;font-size:0.8rem;color:var(--muted);">${dlvLabel}</p>
            </div>`;
        }).join('');
      })
      .catch(() => {
        if (loadingEl) loadingEl.style.display = 'none';
        listEl.innerHTML = '<p style="color:var(--muted);text-align:center;padding:30px 0;">שגיאה בטעינת הזמנות.</p>';
      });
  }
}

// ── Checkout view ──────────────────────────────────────────────
// Guest users can browse step 1 (cart review) freely.
// Login is required only when proceeding to step 2 (shipping details).
function initCheckoutView() {
  const el = document.getElementById('view-checkout');
  if (!el) return;

  if (!isQuickBuy) {
    checkoutCartItems = cart.map(i => ({ ...i, _selected: true }));
  }
  // After auth redirect: jump directly to step 2
  if (_checkoutStartAtStep2) {
    _checkoutStartAtStep2 = false;
    checkoutStep = 2;
  } else {
    checkoutStep = 1;
  }
  checkoutDelivery = 'delivery';
  renderCheckoutStep(el);
}

function renderCheckoutStep(el) {
  if (checkoutStep === 1) renderCheckoutStep1(el);
  else if (checkoutStep === 2) renderCheckoutForm(el);
}

function stepIndicator(active, total = 2) {
  const steps = total === 2
    ? ['עגלת קניות', 'פרטי תשלום']
    : ['עגלת קניות', 'פרטי משלוח', 'אישור הזמנה'];
  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:36px;" role="list" aria-label="שלבי תשלום">
      ${steps.map((label, i) => {
        const n = i + 1;
        const done   = n < active;
        const isAct  = n === active;
        return `
          <div style="display:flex;align-items:center;" role="listitem">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="width:32px;height:32px;border-radius:50%;background:${done || isAct ? 'var(--pink)' : 'var(--sand-dark)'};color:${done || isAct ? '#fff' : 'var(--muted)'};display:flex;align-items:center;justify-content:center;font-size:0.82rem;font-weight:700;" aria-current="${isAct ? 'step' : false}">${done ? '✓' : n}</div>
              <span style="font-size:0.7rem;color:${isAct ? 'var(--ink)' : 'var(--muted)'};white-space:nowrap;">${label}</span>
            </div>
            ${i < steps.length - 1 ? `<div style="width:40px;height:2px;background:${n < active ? 'var(--pink)' : 'var(--sand-dark)'};margin-bottom:22px;margin-inline:8px;" aria-hidden="true"></div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

function renderCheckoutStep1(el) {
  const items = isQuickBuy ? checkoutItems : checkoutCartItems;

  if (!items.length) {
    el.innerHTML = `
      <section style="min-height:80vh;padding:80px 0;display:flex;align-items:center;justify-content:center;background:var(--sand);">
        <div style="text-align:center;max-width:360px;padding:0 20px;">
          <div style="font-size:3.5rem;margin-bottom:16px;">🛒</div>
          <h2 style="font-size:1.3rem;font-weight:700;color:var(--ink);margin:0 0 10px;">העגלה ריקה</h2>
          <p style="color:var(--muted);margin:0 0 28px;font-size:0.9rem;">הוסיפי פריטים מהחנות כדי לבצע הזמנה.</p>
          <button id="co-go-shop" class="btn">לחנות שלנו</button>
        </div>
      </section>`;
    el.querySelector('#co-go-shop').addEventListener('click', () => switchView('shop'));
    return;
  }

  const selItems = isQuickBuy ? items : items.filter(i => i._selected !== false);
  const subtotal = selItems.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const bannerHtml = freeShipBannerHTML(subtotal);

  const itemsHtml = items.map((item, idx) => `
    <div style="display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--sand-dark);">
      ${!isQuickBuy ? `<input type="checkbox" class="co-check" data-idx="${idx}" ${item._selected !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--pink);cursor:pointer;flex-shrink:0;" aria-label="בחרי פריט ${esc(item.name)}" />` : ''}
      <div style="width:60px;height:60px;border-radius:10px;overflow:hidden;background:var(--pink-light);flex-shrink:0;">
        ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" style="width:100%;height:100%;object-fit:cover;" alt="${esc(item.name)}" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">💎</div>'}
      </div>
      <div style="flex:1;min-width:0;">
        <p style="margin:0 0 4px;font-size:0.92rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.name)}</p>
        <p style="margin:0;font-size:0.82rem;color:var(--muted);">${item.price} ₪</p>
        ${item.customizationNote ? `<p style="margin:3px 0 0;font-size:0.78rem;font-style:italic;color:var(--pink-deep);">בקשת התאמה: ${esc(item.customizationNote)}</p>` : ''}
      </div>
      ${!isQuickBuy ? `
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="co-minus" data-idx="${idx}" aria-label="הפחיתי כמות" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--sand-dark);background:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">−</button>
          <span style="font-size:0.9rem;font-weight:600;min-width:18px;text-align:center;" aria-live="polite">${item.qty || 1}</span>
          <button class="co-plus"  data-idx="${idx}" aria-label="הוסיפי כמות" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--sand-dark);background:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>
          <button class="co-remove" data-idx="${idx}" aria-label="הסירי פריט" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.8rem;padding:4px 6px;border-radius:6px;flex-shrink:0;">הסר</button>
        </div>
      ` : `<span style="font-size:0.9rem;font-weight:600;flex-shrink:0;">× ${item.qty || 1}</span>`}
    </div>`).join('');

  el.innerHTML = `
    <section style="padding:80px 0 110px;background:var(--sand);">
      <div class="container" style="max-width:640px;">
        <button id="co-back1" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.88rem;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:32px;">← המשיכי בקניות</button>
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">העגלה שלי</h2>
        ${stepIndicator(1, 2)}
        ${bannerHtml}
        <div>${itemsHtml}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0 0;">
          <span style="font-size:0.97rem;color:var(--ink-soft);">סה"כ (${selItems.length} פריטים)</span>
          <span id="co-subtotal" style="font-size:1.2rem;font-weight:700;color:var(--ink);">${subtotal} ₪</span>
        </div>
        <button id="co-next1" class="btn" style="width:100%;margin-top:18px;min-height:50px;font-size:1rem;${!selItems.length ? 'opacity:0.5;' : ''}">מעבר לתשלום →</button>
      </div>
    </section>`;

  const nextBtn = el.querySelector('#co-next1');
  nextBtn.disabled = !selItems.length;

  el.querySelector('#co-back1').addEventListener('click', () => {
    isQuickBuy = false;
    switchView(previousView || 'shop');
  });

  nextBtn.addEventListener('click', () => {
    if (!isQuickBuy) {
      checkoutItems = checkoutCartItems
        .filter(i => i._selected !== false)
        .map(i => ({ id: i.id, name: i.name, price: i.price, imageUrl: i.imageUrl, qty: i.qty || 1, customizationNote: i.customizationNote || null }));
    }
    if (!checkoutItems.length) { showToast('יש לבחור לפחות פריט אחד'); return; }

    // Login wall: only at the transition to checkout details
    if (!currentUser) {
      pendingCheckoutAfterAuth = true;
      document.getElementById('auth-nav-btn')?.click();
      return;
    }
    checkoutStep = 2;
    renderCheckoutStep(el);
  });

  if (!isQuickBuy) {
    el.querySelectorAll('.co-check').forEach(chk => {
      chk.addEventListener('change', () => {
        checkoutCartItems[parseInt(chk.dataset.idx)]._selected = chk.checked;
        const sel = checkoutCartItems.filter(i => i._selected !== false);
        const sub = sel.reduce((s, i) => s + i.price * (i.qty || 1), 0);
        const subtotalEl = el.querySelector('#co-subtotal');
        if (subtotalEl) subtotalEl.textContent = sub + ' ₪';
        nextBtn.disabled = !sel.length;
        nextBtn.style.opacity = sel.length ? '1' : '0.5';
      });
    });

    el.querySelectorAll('.co-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const newQty = (checkoutCartItems[idx]?.qty || 1) - 1;
        if (newQty < 1) {
          checkoutCartItems.splice(idx, 1);
          cart.splice(idx, 1);
        } else {
          checkoutCartItems[idx].qty = newQty;
          if (cart[idx]) cart[idx].qty = newQty;
        }
        saveCart(); updateCartBadge();
        renderCheckoutStep1(el);
      });
    });

    el.querySelectorAll('.co-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        checkoutCartItems[idx].qty = (checkoutCartItems[idx]?.qty || 1) + 1;
        if (cart[idx]) cart[idx].qty = checkoutCartItems[idx].qty;
        saveCart();
        renderCheckoutStep1(el);
      });
    });

    el.querySelectorAll('.co-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        checkoutCartItems.splice(idx, 1);
        cart.splice(idx, 1);
        saveCart(); updateCartBadge();
        renderCheckoutStep1(el);
      });
    });
  }
}

// ── Form persistence ───────────────────────────────────────────
function saveFormToStorage() {
  const d = {
    name:   document.getElementById('co-name')?.value   || '',
    email:  document.getElementById('co-email')?.value  || '',
    phone:  document.getElementById('co-phone')?.value  || '',
    city:   document.getElementById('co-city')?.value   || '',
    street: document.getElementById('co-street')?.value || '',
    house:  document.getElementById('co-house')?.value  || '',
    apt:    document.getElementById('co-apt')?.value    || '',
    ship:   document.querySelector('[name="co-ship"]:checked')?.value || 'delivery',
  };
  localStorage.setItem(FORM_KEY, JSON.stringify(d));
}
function loadFormFromStorage() {
  try { return JSON.parse(localStorage.getItem(FORM_KEY) || '{}'); } catch { return {}; }
}
function clearFormStorage() { localStorage.removeItem(FORM_KEY); }

// ── Order ID generator ─────────────────────────────────────────
function generateOrderId() {
  const now   = new Date();
  const dd    = String(now.getDate()).padStart(2, '0');
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand  = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CH-${dd}${mm}-${rand}`;
}

// ── V15.3 New checkout form (step 2) ──────────────────────────
function renderCheckoutForm(el) {
  const saved = loadFormFromStorage();
  const pre = {
    name:   saved.name   || userProfile.fullName || currentUser?.displayName || '',
    email:  saved.email  || userProfile.email    || currentUser?.email        || '',
    phone:  saved.phone  || userProfile.phone    || '',
    city:   saved.city   || userProfile.city     || '',
    street: saved.street || userProfile.street   || '',
    house:  saved.house  || '',
    apt:    saved.apt    || userProfile.apt       || '',
    ship:   saved.ship   || 'delivery',
  };

  const subtotal = checkoutItems.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const isFreeInit  = pre.ship === 'pickup' || subtotal >= FREE_SHIP_THRESHOLD;
  const shipInit    = (pre.ship === 'delivery' && !isFreeInit) ? SHIPPING : 0;
  const totalInit   = subtotal + shipInit;

  const itemsSummaryHtml = checkoutItems.map(item => `
    <div class="co-summary-item">
      <div class="co-summary-item-img">
        ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" />` : ''}
        <span class="co-summary-item-qty">${item.qty || 1}</span>
      </div>
      <div class="co-summary-item-info">
        <span class="co-summary-item-name">${esc(item.name)}</span>
        ${item.customizationNote ? `<span class="co-summary-item-note">${esc(item.customizationNote)}</span>` : ''}
      </div>
      <span class="co-summary-item-price">${item.price * (item.qty || 1)} ₪</span>
    </div>`).join('');

  el.innerHTML = `
    <section class="co-section">
      <div class="container">
        <button id="co-back2" class="sp-back-btn">← חזרה לעגלה</button>

        <div class="co-secure-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          רכישה מאובטחת
        </div>

        <div class="co-form-layout">

          <!-- LEFT PANEL: Form -->
          <div class="co-form-panel">

            <div class="co-field-group">
              <div class="co-section-title">אופן קבלה</div>
              <div class="co-delivery-selector">
                <label class="co-delivery-option${pre.ship === 'delivery' ? ' co-delivery-option--active' : ''}">
                  <input type="radio" name="co-ship" value="delivery" ${pre.ship === 'delivery' ? 'checked' : ''} />
                  <span class="co-delivery-name">משלוח עד הבית</span>
                  <span class="co-delivery-cost" id="co-dlv-cost">${isFreeInit && pre.ship === 'delivery' ? 'חינם ✅' : pre.ship === 'delivery' ? `${SHIPPING} ₪` : `${SHIPPING} ₪`}</span>
                </label>
                <label class="co-delivery-option${pre.ship === 'pickup' ? ' co-delivery-option--active' : ''}">
                  <input type="radio" name="co-ship" value="pickup" ${pre.ship === 'pickup' ? 'checked' : ''} />
                  <span class="co-delivery-name">איסוף עצמי מהסטודיו</span>
                  <span class="co-delivery-cost co-free-badge">חינם</span>
                </label>
              </div>
            </div>

            <div class="co-field-group">
              <div class="co-section-title">פרטים אישיים</div>
              <div class="co-field">
                <label class="co-label" for="co-name">שם מלא *</label>
                <input id="co-name" class="co-input" type="text" value="${esc(pre.name)}" autocomplete="name" />
              </div>
              <div class="co-field">
                <label class="co-label" for="co-email">אימייל *</label>
                <input id="co-email" class="co-input" type="email" value="${esc(pre.email)}" autocomplete="email" />
              </div>
              <div class="co-field">
                <label class="co-label" for="co-phone">טלפון (10 ספרות) *</label>
                <input id="co-phone" class="co-input" type="tel" value="${esc(pre.phone)}" autocomplete="tel" inputmode="numeric" />
              </div>
            </div>

            <div class="co-field-group" id="co-addr-group"${pre.ship === 'pickup' ? ' style="display:none;"' : ''}>
              <div class="co-section-title">כתובת למשלוח</div>
              <div class="co-field">
                <label class="co-label" for="co-city">עיר *</label>
                <input id="co-city" class="co-input" type="text" value="${esc(pre.city)}" autocomplete="address-level2" />
              </div>
              <div class="co-fields-row">
                <div class="co-field">
                  <label class="co-label" for="co-street">רחוב *</label>
                  <input id="co-street" class="co-input" type="text" value="${esc(pre.street)}" autocomplete="street-address" />
                </div>
                <div class="co-field co-field--narrow">
                  <label class="co-label" for="co-house">מספר *</label>
                  <input id="co-house" class="co-input" type="text" value="${esc(pre.house)}" />
                </div>
              </div>
              <div class="co-field">
                <label class="co-label" for="co-apt">קומה / דירה</label>
                <input id="co-apt" class="co-input" type="text" value="${esc(pre.apt)}" />
              </div>
            </div>

            <div class="co-terms-row">
              <input type="checkbox" id="co-terms" />
              <label for="co-terms">קראתי ואני מסכימה ל<a href="terms.html" target="_blank">תנאי השימוש</a></label>
            </div>

            <p id="co-form-err" class="co-form-err" aria-live="polite"></p>

            <button id="co-submit" class="btn co-submit-btn">
              <span id="co-submit-label">אשרי הזמנה</span>
              <span id="co-submit-spinner" style="display:none;" aria-label="טוענת...">שולחת...</span>
            </button>

            <div class="co-trust-icons">
              <span class="co-trust-badge">Visa</span>
              <span class="co-trust-badge">Mastercard</span>
              <span class="co-trust-badge">Bit</span>
              <span class="co-trust-badge">🔒 מאובטח</span>
            </div>
          </div>

          <!-- RIGHT PANEL: Sticky Order Summary -->
          <aside class="co-summary-panel">
            <div class="co-summary-header">סיכום הזמנה</div>
            <div class="co-summary-items">${itemsSummaryHtml}</div>
            <div class="co-summary-totals">
              <div class="co-summary-row">
                <span>מוצרים</span>
                <span>${subtotal} ₪</span>
              </div>
              <div class="co-summary-row" id="co-ship-row">
                <span>משלוח</span>
                <span id="co-ship-cost-el">${shipInit === 0 ? 'חינם' : shipInit + ' ₪'}</span>
              </div>
              <div class="co-summary-divider"></div>
              <div class="co-summary-row co-summary-total">
                <span>סה"כ לתשלום</span>
                <span id="co-grand-total-el">${totalInit} ₪</span>
              </div>
            </div>
            <div id="co-freeship-note" class="co-freeship-note"${pre.ship === 'delivery' && subtotal < FREE_SHIP_THRESHOLD ? '' : ' style="display:none;"'}>
              ${pre.ship === 'delivery' && subtotal < FREE_SHIP_THRESHOLD ? `🚚 עוד ${FREE_SHIP_THRESHOLD - subtotal} ₪ למשלוח חינם!` : ''}
            </div>
          </aside>

        </div>
      </div>
    </section>`;

  // Dynamic pricing update
  function updateSummaryPricing() {
    const ship      = document.querySelector('[name="co-ship"]:checked')?.value || 'delivery';
    checkoutDelivery = ship;
    const isFree    = ship === 'pickup' || subtotal >= FREE_SHIP_THRESHOLD;
    const shipCost  = (ship === 'delivery' && !isFree) ? SHIPPING : 0;
    const total     = subtotal + shipCost;

    el.querySelectorAll('.co-delivery-option').forEach(opt => {
      opt.classList.toggle('co-delivery-option--active', opt.querySelector('input').value === ship);
    });

    const dlvCostEl = document.getElementById('co-dlv-cost');
    if (dlvCostEl) dlvCostEl.textContent = ship === 'pickup' ? 'חינם' : (isFree ? 'חינם ✅' : `${SHIPPING} ₪`);

    const shipEl = document.getElementById('co-ship-cost-el');
    if (shipEl) shipEl.textContent = shipCost === 0 ? 'חינם' : `${shipCost} ₪`;

    const totalEl = document.getElementById('co-grand-total-el');
    if (totalEl) totalEl.textContent = `${total} ₪`;

    const noteEl = document.getElementById('co-freeship-note');
    if (noteEl) {
      if (ship === 'delivery' && subtotal < FREE_SHIP_THRESHOLD) {
        noteEl.textContent = `🚚 עוד ${FREE_SHIP_THRESHOLD - subtotal} ₪ למשלוח חינם!`;
        noteEl.style.display = '';
      } else {
        noteEl.style.display = 'none';
      }
    }

    const addrGroup = document.getElementById('co-addr-group');
    if (addrGroup) addrGroup.style.display = ship === 'delivery' ? '' : 'none';

    saveFormToStorage();
  }

  // Radio change listeners
  el.querySelectorAll('[name="co-ship"]').forEach(r => {
    r.addEventListener('change', updateSummaryPricing);
  });

  // Input persistence
  ['co-name', 'co-email', 'co-phone', 'co-city', 'co-street', 'co-house', 'co-apt'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveFormToStorage);
  });

  // Back button
  el.querySelector('#co-back2').addEventListener('click', () => { checkoutStep = 1; renderCheckoutStep(el); });

  // Submit
  el.querySelector('#co-submit').addEventListener('click', async () => {
    const errEl  = document.getElementById('co-form-err');
    const btn    = document.getElementById('co-submit');
    const label  = document.getElementById('co-submit-label');
    const spinner = document.getElementById('co-submit-spinner');

    const ship   = document.querySelector('[name="co-ship"]:checked')?.value || 'delivery';
    const name   = document.getElementById('co-name').value.trim();
    const email  = document.getElementById('co-email').value.trim();
    const phone  = document.getElementById('co-phone').value.trim();
    const terms  = document.getElementById('co-terms').checked;

    // Validate
    if (!name)                              { errEl.textContent = 'יש למלא שם מלא.'; return; }
    if (!email || !email.includes('@') || !email.includes('.'))
                                            { errEl.textContent = 'יש למלא כתובת אימייל תקינה.'; return; }
    if (!/^\d{10}$/.test(phone))            { errEl.textContent = 'יש למלא מספר טלפון בן 10 ספרות.'; return; }
    if (ship === 'delivery') {
      const city   = document.getElementById('co-city')?.value.trim()   || '';
      const street = document.getElementById('co-street')?.value.trim() || '';
      const house  = document.getElementById('co-house')?.value.trim()  || '';
      if (!city || !street || !house) { errEl.textContent = 'יש למלא עיר, רחוב ומספר בית.'; return; }
    }
    if (!terms) { errEl.textContent = 'יש לאשר את תנאי השימוש.'; return; }
    errEl.textContent = '';

    // Anti-double-click
    btn.disabled    = true;
    label.style.display   = 'none';
    spinner.style.display = '';

    try {
      const city   = document.getElementById('co-city')?.value.trim()   || '';
      const street = document.getElementById('co-street')?.value.trim() || '';
      const house  = document.getElementById('co-house')?.value.trim()  || '';
      const apt    = document.getElementById('co-apt')?.value.trim()    || '';

      const isFree2   = ship === 'pickup' || subtotal >= FREE_SHIP_THRESHOLD;
      const shipCost2 = (ship === 'delivery' && !isFree2) ? SHIPPING : 0;
      const total2    = subtotal + shipCost2;
      const orderId   = generateOrderId();

      // Public orders collection (for Make.com)
      await setDoc(doc(db, ORDERS_COL, orderId), {
        orderId,
        status:            'pending_payment',
        isProcessedByMake: false,
        customer: {
          name, email, phone,
          address:        { city, street, house, apt },
          shippingMethod: ship,
        },
        items: checkoutItems.map(i => ({
          productId:         i.id,
          name:              i.name,
          price:             i.price,
          quantity:          i.qty || 1,
          customizationNote: i.customizationNote || null,
          image:             i.imageUrl || '',
        })),
        summary: { subtotal, shipping: shipCost2, total: total2, currency: 'ILS' },
        timestamp: serverTimestamp(),
      });

      // User-scoped orders (for profile "My Orders" tab)
      if (currentUser) {
        await addDoc(collection(db, `${USERS_ROOT}/${currentUser.uid}/orders`), {
          orderId,
          items:    checkoutItems,
          delivery: ship,
          total:    total2,
          fullName: name,
          phone,
          createdAt: serverTimestamp(),
        });
      }

      // Cleanup
      cart = []; saveCart(); updateCartBadge();
      isQuickBuy = false; checkoutItems = [];
      clearFormStorage();
      orderIdGenerated = orderId;

      switchView('thank-you');
    } catch (ex) {
      console.error('Order submit failed:', ex);
      errEl.textContent = 'שגיאה בשליחת ההזמנה. נסי שוב.';
      btn.disabled    = false;
      label.style.display   = '';
      spinner.style.display = 'none';
    }
  });
}

// ── Thank-you view ─────────────────────────────────────────────
function renderThankYouView() {
  const el = document.getElementById('view-thank-you');
  if (!el) return;

  const oid   = orderIdGenerated || '—';
  const waMsg = encodeURIComponent(`היי ויק! ביצעתי הזמנה באתר שמספרה ${oid}. מחכה לעדכון!`);

  el.innerHTML = `
    <section class="co-ty-section">
      <div class="co-ty-confetti" aria-hidden="true">
        ${Array.from({length: 12}, (_, i) => `<span class="co-confetti-piece co-confetti-${i+1}"></span>`).join('')}
      </div>
      <div class="co-ty-wrap">
        <div class="co-ty-checkmark" aria-hidden="true">✓</div>
        <h2 class="co-ty-title">ההזמנה התקבלה!</h2>
        <p class="co-ty-subtitle">תודה רבה. נציגה תיצור איתך קשר בהקדם לתיאום פרטי התשלום.</p>
        <div class="co-ty-order-id">
          מספר הזמנה: <strong>${esc(oid)}</strong>
        </div>
        <a href="https://wa.me/${WA_NUMBER}?text=${waMsg}"
           target="_blank" rel="noopener noreferrer"
           class="btn btn-whatsapp co-ty-wa-btn">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          עדכני את ויק בוואטסאפ על ההזמנה
        </a>
        <button class="btn btn-outline co-ty-shop-btn" onclick="window.switchView('shop')">
          המשיכי בקניות
        </button>
      </div>
    </section>`;
}

// ── (Old step 2 & 3 removed in V15.3 — replaced by renderCheckoutForm) ────
function _unused_renderCheckoutStep2(el) {
  const addr = userProfile || {};
  el.innerHTML = `
    <section style="padding:80px 0 110px;background:var(--sand);">
      <div class="container" style="max-width:640px;">
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">פרטי משלוח</h2>
        ${stepIndicator(2, 3)}

        <!-- Shipping method -->
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px;" role="radiogroup" aria-label="אופן קבלת ההזמנה">
          <label style="display:flex;align-items:center;gap:14px;padding:16px 18px;border:2px solid ${checkoutDelivery === 'delivery' ? 'var(--pink)' : 'var(--sand-dark)'};border-radius:14px;cursor:pointer;transition:.2s;">
            <input type="radio" name="co-ship" value="delivery" ${checkoutDelivery === 'delivery' ? 'checked' : ''} style="accent-color:var(--pink);width:18px;height:18px;" />
            <div>
              <p style="margin:0 0 2px;font-size:0.95rem;font-weight:600;color:var(--ink);">משלוח עד הבית</p>
              <p style="margin:0;font-size:0.82rem;color:var(--muted);">תוך 3–5 ימי עסקים | 35 ₪ (חינם מ-400 ₪)</p>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:14px;padding:16px 18px;border:2px solid ${checkoutDelivery === 'pickup' ? 'var(--pink)' : 'var(--sand-dark)'};border-radius:14px;cursor:pointer;transition:.2s;">
            <input type="radio" name="co-ship" value="pickup" ${checkoutDelivery === 'pickup' ? 'checked' : ''} style="accent-color:var(--pink);width:18px;height:18px;" />
            <div>
              <p style="margin:0 0 2px;font-size:0.95rem;font-weight:600;color:var(--ink);">איסוף עצמי — ראשון לציון</p>
              <p style="margin:0;font-size:0.82rem;color:var(--muted);">בתיאום מראש | חינם</p>
            </div>
          </label>
        </div>

        <!-- Contact info -->
        <div style="margin-bottom:20px;">
          <p style="font-size:0.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">פרטי יצירת קשר</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label for="co-name" style="${LBL}">שם מלא *</label>
              <input id="co-name" type="text" value="${esc(addr.fullName || currentUser?.displayName || '')}" placeholder="שם פרטי ושם משפחה" style="${INP}" autocomplete="name" />
            </div>
            <div>
              <label for="co-phone" style="${LBL}">טלפון *</label>
              <input id="co-phone" type="tel" value="${esc(addr.phone || '')}" placeholder="05X-XXXXXXX" style="${INP}" autocomplete="tel" />
            </div>
          </div>
        </div>

        <!-- Delivery address (shown only for home delivery) -->
        <div id="co-addr" style="${checkoutDelivery === 'delivery' ? 'display:flex;' : 'display:none;'}flex-direction:column;gap:12px;margin-bottom:24px;">
          <p style="font-size:0.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:0;">כתובת למשלוח</p>
          <div>
            <label for="co-street" style="${LBL}">רחוב ומספר *</label>
            <input id="co-street" type="text" value="${esc(addr.street || '')}" placeholder="רחוב הרצל 10" style="${INP}" autocomplete="street-address" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label for="co-floor" style="${LBL}">קומה</label>
              <input id="co-floor" type="text" value="${esc(addr.floor || '')}" placeholder="3" style="${INP}" />
            </div>
            <div>
              <label for="co-apt" style="${LBL}">דירה / מספר בית</label>
              <input id="co-apt" type="text" value="${esc(addr.apt || '')}" placeholder="12" style="${INP}" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label for="co-city" style="${LBL}">עיר *</label>
              <input id="co-city" type="text" value="${esc(addr.city || '')}" placeholder="תל אביב" style="${INP}" autocomplete="address-level2" />
            </div>
            <div>
              <label for="co-zip" style="${LBL}">מיקוד</label>
              <input id="co-zip" type="text" value="${esc(addr.zip || '')}" placeholder="12345" style="${INP}" autocomplete="postal-code" />
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;color:var(--ink-soft);">
            <input type="checkbox" id="co-save-addr" checked style="accent-color:var(--pink);" /> שמרי פרטים לפעם הבאה
          </label>
        </div>

        <!-- Shipping & Returns note -->
        <div style="padding:12px 16px;background:var(--sand-light);border-radius:12px;border:1px solid var(--sand-dark);font-size:0.82rem;color:var(--muted);line-height:1.65;margin-bottom:20px;">
          <strong style="color:var(--ink-soft);">משלוחים והחזרות:</strong> משלוח בדואר רשום תוך 3–5 ימי עסקים.
          החזרה/החלפה תוך 14 יום מקבלת הפריט — בתיאום מראש בלבד.
          לפריטים בהזמנה אישית אין אפשרות ביטול.
        </div>

        <p id="co-step2-err" style="color:#ef4444;font-size:0.85rem;min-height:1.2rem;margin-bottom:12px;" role="alert" aria-live="assertive"></p>
        <div style="display:flex;gap:12px;">
          <button id="co-back2" class="btn btn-outline" style="flex:1;min-height:50px;">← חזרה</button>
          <button id="co-next2" class="btn" style="flex:2;min-height:50px;font-size:1rem;">המשיכי לסיכום →</button>
        </div>
      </div>
    </section>`;

  el.querySelectorAll('input[name="co-ship"]').forEach(radio => {
    radio.addEventListener('change', () => {
      checkoutDelivery = radio.value;
      const addrDiv = el.querySelector('#co-addr');
      if (addrDiv) addrDiv.style.display = checkoutDelivery === 'delivery' ? 'flex' : 'none';
      el.querySelectorAll('label').forEach(lbl => {
        const r = lbl.querySelector('input[name="co-ship"]');
        if (r) lbl.style.borderColor = r.checked ? 'var(--pink)' : 'var(--sand-dark)';
      });
    });
  });

  el.querySelector('#co-back2').addEventListener('click', () => { checkoutStep = 1; renderCheckoutStep(el); });

  el.querySelector('#co-next2').addEventListener('click', async () => {
    const err   = el.querySelector('#co-step2-err');
    const name  = el.querySelector('#co-name').value.trim();
    const phone = el.querySelector('#co-phone').value.trim();

    if (!name)  { err.textContent = 'יש למלא שם מלא.';  return; }
    if (!phone) { err.textContent = 'יש למלא מספר טלפון.'; return; }

    if (checkoutDelivery === 'delivery') {
      const street = el.querySelector('#co-street').value.trim();
      const city   = el.querySelector('#co-city').value.trim();
      if (!street || !city) { err.textContent = 'יש למלא רחוב ועיר.'; return; }
    }

    const addrData = {
      fullName: name,
      phone,
      email:  currentUser.email,
      street: checkoutDelivery === 'delivery' ? el.querySelector('#co-street').value.trim() : (addr.street || ''),
      floor:  checkoutDelivery === 'delivery' ? el.querySelector('#co-floor').value.trim()  : (addr.floor  || ''),
      apt:    checkoutDelivery === 'delivery' ? el.querySelector('#co-apt').value.trim()    : (addr.apt    || ''),
      city:   checkoutDelivery === 'delivery' ? el.querySelector('#co-city').value.trim()   : (addr.city   || ''),
      zip:    checkoutDelivery === 'delivery' ? el.querySelector('#co-zip').value.trim()    : (addr.zip    || ''),
    };

    if (el.querySelector('#co-save-addr')?.checked) {
      try { await setDoc(doc(db, USERS_ROOT, currentUser.uid), addrData, { merge: true }); } catch {}
    }
    userProfile = { ...userProfile, ...addrData };

    err.textContent = '';
    checkoutStep = 3;
    renderCheckoutStep(el);
  });
}

function _unused_renderCheckoutStep3(el) {
  const itemsSubtotal = checkoutItems.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const freeShipping  = checkoutDelivery === 'delivery' && itemsSubtotal >= FREE_SHIP_THRESHOLD;
  const shippingCost  = checkoutDelivery === 'delivery' ? (freeShipping ? 0 : SHIPPING) : 0;
  const total         = itemsSubtotal + shippingCost;

  const itemsHtml = checkoutItems.map(item => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--sand-dark);">
      <div style="width:50px;height:50px;border-radius:8px;overflow:hidden;background:var(--pink-light);flex-shrink:0;">
        ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" style="width:100%;height:100%;object-fit:cover;" alt="${esc(item.name)}" />` : '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:1.3rem;">💎</div>'}
      </div>
      <div style="flex:1;">
        <p style="margin:0 0 2px;font-size:0.9rem;font-weight:600;color:var(--ink);">${esc(item.name)}</p>
        ${item.customizationNote ? `<p style="margin:2px 0;font-size:0.76rem;font-style:italic;color:var(--pink-deep);">בקשת התאמה: ${esc(item.customizationNote)}</p>` : ''}
        <p style="margin:0;font-size:0.8rem;color:var(--muted);">× ${item.qty || 1}</p>
      </div>
      <span style="font-size:0.92rem;font-weight:600;color:var(--ink-soft);flex-shrink:0;">${item.price * (item.qty || 1)} ₪</span>
    </div>`).join('');

  el.innerHTML = `
    <section style="padding:80px 0 110px;background:var(--sand);">
      <div class="container" style="max-width:640px;">
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">סיכום הזמנה</h2>
        ${stepIndicator(3)}
        <div style="border:1px solid var(--sand-dark);border-radius:16px;padding:20px 22px;margin-bottom:20px;background:var(--sand-light);">
          ${itemsHtml}
          <div style="display:flex;justify-content:space-between;padding:14px 0 6px;">
            <span style="color:var(--ink-soft);">מוצרים</span>
            <span style="font-weight:600;">${itemsSubtotal} ₪</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="color:var(--ink-soft);">${checkoutDelivery === 'delivery' ? 'משלוח' : 'איסוף עצמי'}</span>
            <span style="font-weight:600;color:${shippingCost === 0 ? '#16a34a' : 'var(--ink)'};">${shippingCost === 0 ? 'חינם' : shippingCost + ' ₪'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:14px 0 0;border-top:2px solid var(--sand-dark);margin-top:8px;">
            <span style="font-size:1rem;font-weight:700;color:var(--ink);">סה"כ לתשלום</span>
            <span style="font-size:1.2rem;font-weight:700;color:var(--pink-deep);">${total} ₪</span>
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <label for="co-note" style="display:block;font-size:0.82rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;">הערה אישית (לא חובה)</label>
          <textarea id="co-note" rows="3" placeholder="הוסיפי הערה על ההזמנה..." style="width:100%;padding:12px 14px;border:1.5px solid var(--sand-dark);border-radius:12px;font-family:inherit;font-size:0.9rem;resize:none;background:var(--sand-light);box-sizing:border-box;direction:rtl;"></textarea>
        </div>
        <div style="display:flex;gap:12px;">
          <button id="co-back3" class="btn btn-outline" style="flex:1;min-height:50px;">← חזרה</button>
          <button id="co-submit" class="btn btn-whatsapp" style="flex:2;min-height:50px;font-size:0.97rem;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            אשרי ושלחי בוואצאפ
          </button>
        </div>
      </div>
    </section>`;

  el.querySelector('#co-back3').addEventListener('click', () => { checkoutStep = 2; renderCheckoutStep(el); });

  el.querySelector('#co-submit').addEventListener('click', async () => {
    const note = el.querySelector('#co-note').value.trim();
    const btn  = el.querySelector('#co-submit');
    btn.disabled = true;

    const itemsText    = checkoutItems.map(i => {
      const noteLine = i.customizationNote ? `\n  התאמה: ${i.customizationNote}` : '';
      return `• ${i.name} × ${i.qty || 1} — ${i.price * (i.qty || 1)} ₪${noteLine}`;
    }).join('\n');
    const deliveryTxt  = checkoutDelivery === 'delivery'
      ? `משלוח עד הבית (+${shippingCost === 0 ? '0 ₪ — משלוח חינם!' : shippingCost + ' ₪'})`
      : 'איסוף עצמי מראשון לציון (חינם)';

    const addrParts = [
      userProfile.street,
      userProfile.floor ? `קומה ${userProfile.floor}` : '',
      userProfile.apt   ? `דירה ${userProfile.apt}`   : '',
      userProfile.city,
      userProfile.zip   || '',
    ].filter(Boolean);
    const addrLine = (checkoutDelivery === 'delivery' && userProfile.street)
      ? `\nכתובת: ${addrParts.join(', ')}` : '';

    const contactLine = [
      userProfile.fullName ? `שם: ${userProfile.fullName}` : '',
      userProfile.phone    ? `טלפון: ${userProfile.phone}` : '',
    ].filter(Boolean).join(' | ');

    const waMsg = `היי ויק, הגעתי דרך האתר ואני מעוניינת להזמין:\n\n${itemsText}\n\nאופן קבלה: ${deliveryTxt}${addrLine}\n\n${contactLine}\n\nסה"כ לתשלום: *${total} ₪*${note ? '\n\nהערה: ' + note : ''}`;

    if (currentUser) {
      try {
        await addDoc(collection(db, `${USERS_ROOT}/${currentUser.uid}/orders`), {
          items:    checkoutItems,
          delivery: checkoutDelivery,
          total,
          note:     note || null,
          fullName: userProfile.fullName || '',
          phone:    userProfile.phone    || '',
          createdAt: serverTimestamp(),
        });
      } catch (ex) { console.error('Order save failed:', ex); }
    }

    if (!isQuickBuy) { cart = []; saveCart(); updateCartBadge(); }
    isQuickBuy    = false;
    checkoutItems = [];

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`, '_blank');
    switchView('home');
    showToast('ההזמנה נשלחה בוואצאפ!');
  });
}

// ── Firestore subscription ─────────────────────────────────────
function subscribeProducts() {
  const q = query(collection(db, COL_PATH), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    productsLoaded = true;
    allProducts    = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    // Handle ?product=ID redirect from shop.html
    if (pendingProductId) {
      const _pending = allProducts.find(p => p.id === pendingProductId);
      pendingProductId = null;
      if (_pending) { showProduct(_pending); return; }
    }
    if      (currentView === 'home')                        renderHome();
    else if (currentView === 'shop')                        renderShop();
    else if (currentView === 'product' && currentProduct) {
      const updated = allProducts.find(p => p.id === currentProduct.id);
      if (updated) currentProduct = updated;
    }
  });
}

// ── Auth subscription ──────────────────────────────────────────
function subscribeAuth() {
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    const navBtn = document.getElementById('nav-user-btn');
    if (navBtn) navBtn.setAttribute('data-logged-in', user ? '1' : '0');

    // Admin link: only reveal for the admin email
    const adminLink = document.querySelector('.footer-admin-link');
    if (adminLink) {
      const isAdmin = user && user.email === 'amitdovrat123@gmail.com';
      adminLink.classList.toggle('footer-admin-link--visible', isAdmin);
    }

    if (user) {
      try {
        const snap = await getDoc(doc(db, USERS_ROOT, user.uid));
        if (snap.exists()) userProfile = snap.data();
      } catch {}

      // Bug 1: re-render profile view if already open (profile data now loaded)
      if (currentView === 'profile') renderProfileView();

      // After login: proceed to checkout step 2 if the user was blocked
      if (pendingCheckoutAfterAuth) {
        pendingCheckoutAfterAuth = false;
        _checkoutStartAtStep2    = true;
        if (currentView === 'checkout') {
          initCheckoutView();   // re-init in place; reads _checkoutStartAtStep2
        } else {
          switchView('checkout');
        }
      } else if (_authInitialized) {
        // Bug 2: actual new login with no pending checkout → navigate to profile
        switchView('profile');
      }
    } else {
      userProfile = {};
      if (currentView === 'profile') renderProfileView();
    }

    _authInitialized = true;
  });
}

// ── Navigation setup ───────────────────────────────────────────
function setupNav() {
  document.getElementById('nav-cart-btn')?.addEventListener('click', () => switchView('checkout'));
  document.getElementById('nav-user-btn')?.addEventListener('click', () => switchView('profile'));


  document.querySelector('.logo')?.addEventListener('click', e => {
    if (currentView !== 'home') { e.preventDefault(); switchView('home'); }
  });

  document.querySelector('.nav-links a[href="index.html"]')?.addEventListener('click', e => {
    if (window.location.pathname.match(/index\.html$|\/$/) ) { e.preventDefault(); switchView('home'); }
  });

  // Footer SPA links — navigate without full page reload
  document.querySelectorAll('a[href="index.html#shop"]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); goToShop(); });
  });
  document.querySelectorAll('.footer-links a[href="index.html"]').forEach(a => {
    a.addEventListener('click', e => {
      if (window.location.pathname.match(/index\.html$|\/$/) || window.location.pathname === '/') {
        e.preventDefault(); switchView('home');
      }
    });
  });
}

// ── Promo Popup (Welcome Banner) ───────────────────────────────
function injectPromoPopup() {
  const KEY      = 'charming-promo-v9';
  const INTERVAL = 7 * 24 * 60 * 60 * 1000;
  const last     = parseInt(localStorage.getItem(KEY) || '0');
  if (Date.now() - last < INTERVAL) return;
  if (document.getElementById('promo-popup')) return;

  const popup = document.createElement('div');
  popup.id = 'promo-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'promo-title');
  popup.setAttribute('dir', 'rtl');
  popup.innerHTML = `
    <div class="promo-backdrop" aria-hidden="true"></div>
    <div class="promo-card">
      <button id="promo-close" class="promo-close-btn" aria-label="סגרי חלון">×</button>
      <div class="promo-deco" aria-hidden="true">💎</div>
      <h2 id="promo-title" class="promo-title">משהו צ'ארמינג מחכה לך...</h2>
      <p class="promo-sub">הצטרפי למועדון הלקוחות שלנו עכשיו וקבלי <strong>10% הנחה</strong> על הקנייה הראשונה שלך!</p>
      <button id="promo-cta" class="btn promo-cta-btn">להרשמה וקבלת ההטבה ✨</button>
      <button id="promo-later" class="promo-later-btn" type="button">אולי מאוחר יותר</button>
    </div>`;
  document.body.appendChild(popup);

  function closePopup() {
    localStorage.setItem(KEY, String(Date.now()));
    popup.classList.remove('promo-visible');
    document.body.style.overflow = '';
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 420);
  }

  function escHandler(e) {
    if (e.key === 'Escape') { closePopup(); document.removeEventListener('keydown', escHandler); }
  }

  popup.querySelector('.promo-backdrop').addEventListener('click', closePopup);
  popup.querySelector('#promo-close').addEventListener('click', closePopup);
  popup.querySelector('#promo-later').addEventListener('click', closePopup);
  document.addEventListener('keydown', escHandler);

  popup.querySelector('#promo-cta').addEventListener('click', () => {
    closePopup();
    if (currentUser) {
      switchView('profile');
    } else {
      switchView('profile');
      setTimeout(() => document.getElementById('auth-nav-btn')?.click(), 120);
    }
  });

  requestAnimationFrame(() => {
    popup.classList.add('promo-visible');
    document.body.style.overflow = 'hidden';
    popup.querySelector('#promo-close').focus();
  });
}

// ── Inject views ───────────────────────────────────────────────
function injectViews() {
  // Insert inside #main-wrapper (not body) so CSS filter on wrapper
  // does not break fixed-position elements outside of it.
  const wrapper = document.getElementById('main-wrapper') || document.body;
  const footer  = wrapper.querySelector('footer');
  ['shop', 'product', 'profile', 'checkout', 'thank-you'].forEach(v => {
    const div     = document.createElement('div');
    div.id        = 'view-' + v;
    div.className = 'v-section';
    div.style.display = 'none';
    if (footer) wrapper.insertBefore(div, footer);
    else        wrapper.appendChild(div);
  });
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  injectViews();
  setupNav();
  updateCartBadge();
  const homeEl = document.getElementById('view-home');
  if (homeEl) homeEl.style.display = 'block';
  subscribeProducts();
  subscribeAuth();

  // Handle redirect from other pages: index.html?view=profile / checkout / shop
  const _params    = new URLSearchParams(window.location.search);
  const _viewParam = _params.get('view');
  if (_viewParam && ['shop', 'profile', 'checkout'].includes(_viewParam)) {
    window.history.replaceState({}, '', window.location.pathname);
    switchView(_viewParam);
  }

  // Handle ?product=ID redirect from shop.html card click
  const _productParam = _params.get('product');
  if (_productParam) {
    window.history.replaceState({}, '', window.location.pathname);
    pendingProductId = _productParam;
    // Products may not be loaded yet — subscribeProducts will resolve it
    // If already loaded, try immediately
    if (productsLoaded) {
      const _p = allProducts.find(p => p.id === _productParam);
      if (_p) { pendingProductId = null; showProduct(_p); }
    }
  }

  // Promotional popup — 5 s delay, once per 7 days
  setTimeout(injectPromoPopup, 5000);
}

init();

// ── Coupon & Inquiry helpers (exposed to window for HTML event handlers) ──

const COUPONS_COL_PATH   = 'artifacts/charming-3dd6f/public/data/coupons';
const INQUIRIES_COL_PATH = 'artifacts/charming-3dd6f/public/data/inquiries';

/**
 * validateCoupon(code, subtotal) → Promise<{ valid, discount, type, value, docId } | { valid: false, reason }>
 * Validates a coupon code against Firestore. Does NOT redeem it.
 */
async function validateCoupon(code, subtotal) {
  if (!code || typeof code !== 'string') return { valid: false, reason: 'קוד קופון חסר.' };
  const normalized = code.trim().toUpperCase();
  try {
    const snap = await getDocs(
      query(collection(db, COUPONS_COL_PATH), where('code', '==', normalized), limit(1))
    );
    if (snap.empty) return { valid: false, reason: 'קוד קופון לא נמצא.' };

    const docSnap = snap.docs[0];
    const c = docSnap.data();

    if (c.expiryDate?.seconds && c.expiryDate.seconds * 1000 < Date.now())
      return { valid: false, reason: 'תוקף הקופון פג.' };

    if (c.usageLimit != null && (c.usedCount || 0) >= c.usageLimit)
      return { valid: false, reason: 'הקופון הגיע למגבלת השימוש.' };

    const discount = c.type === 'percent'
      ? Math.round(subtotal * c.value / 100)
      : Math.min(c.value, subtotal);

    return { valid: true, discount, type: c.type, value: c.value, docId: docSnap.id };
  } catch (ex) {
    console.error('[validateCoupon]', ex);
    return { valid: false, reason: 'שגיאה בבדיקת הקופון.' };
  }
}
window.validateCoupon = validateCoupon;

/**
 * redeemCoupon(docId) → Promise<void>
 * Increments usedCount by 1. Call once at order submission.
 */
async function redeemCoupon(docId) {
  if (!docId) return;
  try {
    const ref = doc(db, COUPONS_COL_PATH, docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, { usedCount: (snap.data().usedCount || 0) + 1 });
  } catch (ex) {
    console.error('[redeemCoupon]', ex);
  }
}
window.redeemCoupon = redeemCoupon;

/**
 * submitInquiry({ name, phone, message }) → Promise<void>
 * Writes a new inquiry to Firestore with status 'new'.
 */
async function submitInquiry({ name, phone, message }) {
  if (!name && !message) throw new Error('שם או הודעה נדרשים.');
  await addDoc(collection(db, INQUIRIES_COL_PATH), {
    name:      name    || '',
    phone:     phone   || '',
    message:   message || '',
    status:    'new',
    createdAt: serverTimestamp(),
  });
}
window.submitInquiry = submitInquiry;
