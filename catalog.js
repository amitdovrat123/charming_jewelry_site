import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, setDoc, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Constants ──────────────────────────────────────────────────
const WA_NUMBER           = '972524131991';
const SHIPPING            = 35;
const FREE_SHIP_THRESHOLD = 400;
const COL_PATH            = 'artifacts/charming-3dd6f/public/data/products';
const USERS_ROOT          = 'artifacts/charming-3dd6f/users';

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
let pendingCheckoutAfterAuth = false;   // redirect-after-login flag
let _checkoutStartAtStep2   = false;   // skip step-1 init after auth redirect

// Product gallery
let pvImages   = [];
let pvSlideIdx = 0;

// Shop filters
let shopFilterCat      = '';
let shopFilterColor    = '';
let shopFilterFeatured = false;

// View state
let currentView  = 'home';
let previousView = 'home';

// ── View management ────────────────────────────────────────────
function switchView(view) {
  previousView = currentView;
  currentView  = view;
  document.querySelectorAll('.v-section').forEach(el => { el.style.display = 'none'; });
  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';
  window.scrollTo(0, 0);
  if (view === 'home')     renderHome();
  if (view === 'shop')     renderShop();
  if (view === 'product')  renderProductView();
  if (view === 'profile')  renderProfileView();
  if (view === 'checkout') initCheckoutView();
}

// ── Cart helpers ───────────────────────────────────────────────
function loadCart() {
  try { return JSON.parse(localStorage.getItem('charming-cart') || '[]'); } catch { return []; }
}
function saveCart() { localStorage.setItem('charming-cart', JSON.stringify(cart)); }

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id:       product.id,
      name:     product.data.name,
      price:    sellPrice(product.data),
      imageUrl: getImages(product.data)[0] || '',
      qty:      1,
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

  const published  = allProducts.filter(p => p.data.status === 'published');
  const categories = [...new Set(published.map(p => p.data.category).filter(Boolean))];
  const colors     = [...new Set(published.map(p => p.data.color).filter(Boolean))];

  const subtotal = getCartSubtotal();
  const bannerHtml = freeShipBannerHTML(subtotal);

  const catPills = [
    `<button class="shop-filter-pill${!shopFilterCat ? ' active' : ''}" data-filter-cat="">הכל</button>`,
    ...categories.map(c => `<button class="shop-filter-pill${shopFilterCat === c ? ' active' : ''}" data-filter-cat="${esc(c)}">${esc(c)}</button>`),
  ].join('');

  const colorPills = colors.map(c =>
    `<button class="shop-filter-pill${shopFilterColor === c ? ' active' : ''}" data-filter-color="${esc(c)}">${esc(c)}</button>`
  ).join('');

  const featPill = `<button class="shop-filter-pill${shopFilterFeatured ? ' active' : ''}" data-filter-featured="${!shopFilterFeatured}">⭐ מומלצים</button>`;

  let filtered = published;
  if (shopFilterCat)      filtered = filtered.filter(p => p.data.category === shopFilterCat);
  if (shopFilterColor)    filtered = filtered.filter(p => p.data.color     === shopFilterColor);
  if (shopFilterFeatured) filtered = filtered.filter(p => p.data.isFeatured);

  const gridContent = filtered.length
    ? filtered.map(cardHTML).join('')
    : `<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:60px 0;font-size:0.95rem;">אין מוצרים לפי הסינון הנוכחי.</p>`;

  el.innerHTML = `
    <section style="min-height:80vh;padding:80px 0 110px;background:var(--sand);">
      <div class="container">
        <button id="shop-back-btn" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.88rem;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:20px;">← חזרה לדף הבית</button>
        <span class="section-eyebrow">כל הקולקציה</span>
        <h2 class="section-title" style="margin-bottom:8px;">החנות שלנו</h2>
        <p class="section-desc" style="margin-bottom:28px;">כל הפריטים הזמינים — סנני לפי קטגוריה, גוון, או מוצרים מומלצים.</p>
        ${bannerHtml}
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px;align-items:center;">
          ${catPills}
          ${colors.length ? `<div style="width:1px;height:24px;background:var(--sand-dark);flex-shrink:0;"></div>${colorPills}` : ''}
          <div style="margin-right:auto;">${featPill}</div>
        </div>
        <div id="shop-grid" class="shop-grid">${gridContent}</div>
      </div>
    </section>`;

  el.querySelector('#shop-back-btn').addEventListener('click', () => switchView('home'));

  el.querySelectorAll('[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', () => { shopFilterCat = btn.dataset.filterCat; renderShop(); });
  });
  el.querySelectorAll('[data-filter-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      shopFilterColor = shopFilterColor === btn.dataset.filterColor ? '' : btn.dataset.filterColor;
      renderShop();
    });
  });
  el.querySelectorAll('[data-filter-featured]').forEach(btn => {
    btn.addEventListener('click', () => { shopFilterFeatured = btn.dataset.filterFeatured === 'true'; renderShop(); });
  });
  const shopGrid = el.querySelector('#shop-grid');
  if (shopGrid) bindCardClicks(shopGrid);
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
            <div style="padding:12px 16px;background:var(--sand-light);border-radius:12px;border:1px solid var(--sand-dark);font-size:0.85rem;color:var(--ink-soft);line-height:1.6;">
              🚚 משלוח עד הבית (35 ₪) — תוך 3–5 ימי עסקים. איסוף עצמי מראשון לציון בחינם — בתיאום מראש.
            </div>
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
        <button id="profile-back-btn" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.88rem;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:32px;">← חזרה</button>
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">האזור האישי שלי</h2>
        <div style="display:flex;gap:0;border-bottom:2px solid var(--sand-dark);margin-bottom:32px;">
          <button class="profile-tab" data-tab="orders" style="background:none;border:none;border-bottom:3px solid var(--pink);margin-bottom:-2px;padding:10px 22px;font-size:0.95rem;font-weight:600;cursor:pointer;color:var(--ink);transition:.2s;">הזמנות שלי</button>
          <button class="profile-tab" data-tab="info" style="background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:10px 22px;font-size:0.95rem;font-weight:600;cursor:pointer;color:var(--muted);transition:.2s;">פרטים אישיים</button>
        </div>

        <div id="profile-pane-orders">
          <div id="orders-loading" style="text-align:center;padding:40px 0;color:var(--muted);">טוענת הזמנות...</div>
          <div id="orders-list" style="display:flex;flex-direction:column;gap:14px;"></div>
          <div id="orders-empty" style="display:none;text-align:center;padding:60px 0;">
            <div style="font-size:3rem;margin-bottom:14px;">📦</div>
            <p style="color:var(--muted);">אין הזמנות עדיין. <a href="#" id="go-shop-link" style="color:var(--pink-deep);">לקניות</a></p>
          </div>
        </div>

        <div id="profile-pane-info" style="display:none;flex-direction:column;gap:18px;">
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

  loadOrders();

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
  else if (checkoutStep === 2) renderCheckoutStep2(el);
  else if (checkoutStep === 3) renderCheckoutStep3(el);
}

function stepIndicator(active) {
  const steps = ['עגלת קניות', 'פרטי משלוח', 'אישור הזמנה'];
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
        ${stepIndicator(1)}
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
        .map(i => ({ id: i.id, name: i.name, price: i.price, imageUrl: i.imageUrl, qty: i.qty || 1 }));
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

function renderCheckoutStep2(el) {
  const addr = userProfile || {};
  el.innerHTML = `
    <section style="padding:80px 0 110px;background:var(--sand);">
      <div class="container" style="max-width:640px;">
        <h2 style="font-size:1.6rem;font-weight:700;color:var(--ink);margin:0 0 28px;">פרטי משלוח</h2>
        ${stepIndicator(2)}

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

function renderCheckoutStep3(el) {
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

    const itemsText    = checkoutItems.map(i => `• ${i.name} × ${i.qty || 1} — ${i.price * (i.qty || 1)} ₪`).join('\n');
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

      // After login: proceed to checkout step 2 if the user was blocked
      if (pendingCheckoutAfterAuth) {
        pendingCheckoutAfterAuth = false;
        _checkoutStartAtStep2    = true;
        if (currentView === 'checkout') {
          initCheckoutView();   // re-init in place; reads _checkoutStartAtStep2
        } else {
          switchView('checkout');
        }
      }
    } else {
      userProfile = {};
      if (currentView === 'profile') renderProfileView();
    }
  });
}

// ── Navigation setup ───────────────────────────────────────────
function setupNav() {
  document.getElementById('nav-cart-btn')?.addEventListener('click', () => switchView('checkout'));
  document.getElementById('nav-user-btn')?.addEventListener('click', () => switchView('profile'));

  document.querySelector('[data-view="shop"]')?.addEventListener('click', e => {
    e.preventDefault();
    switchView('shop');
  });

  document.querySelector('.logo')?.addEventListener('click', e => {
    if (currentView !== 'home') { e.preventDefault(); switchView('home'); }
  });

  document.querySelector('.nav-links a[href="index.html"]')?.addEventListener('click', e => {
    if (window.location.pathname.match(/index\.html$|\/$/) ) { e.preventDefault(); switchView('home'); }
  });

  document.getElementById('home-all-products-btn')?.addEventListener('click', () => switchView('shop'));

  // Footer SPA links — navigate without full page reload
  document.querySelectorAll('a[href="#shop"], a[href="index.html#shop"]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); switchView('shop'); });
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
  ['shop', 'product', 'profile', 'checkout'].forEach(v => {
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
  const _viewParam = new URLSearchParams(window.location.search).get('view');
  if (_viewParam && ['shop', 'profile', 'checkout'].includes(_viewParam)) {
    window.history.replaceState({}, '', window.location.pathname);
    switchView(_viewParam);
  }

  // Promotional popup — 5 s delay, once per 7 days
  setTimeout(injectPromoPopup, 5000);
}

init();
