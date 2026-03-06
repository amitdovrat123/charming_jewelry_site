import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, setDoc, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Constants ─────────────────────────────────────────────────────────────
const WA_NUMBER  = '972524131991';
const SHIPPING   = 35;
const COL_PATH   = 'artifacts/charming-3dd6f/public/data/products';
const USERS_ROOT = 'artifacts/charming-3dd6f/users';

// ── State ─────────────────────────────────────────────────────────────────
let cart             = loadCart();
let currentUser      = null;
let allProducts      = [];
let userAddress      = {};
let cartCheckoutItems = [];
let isQuickBuy       = false;

// Gallery state
let pdmImages   = [];
let pdmSlideIdx = 0;

// ── DOM refs ──────────────────────────────────────────────────────────────
const grid    = document.getElementById('shop-catalog-grid');
const loadEl  = document.getElementById('shop-catalog-loading');
const emptyEl = document.getElementById('shop-catalog-empty');

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getImages(data) {
  if (Array.isArray(data.images) && data.images.length) return data.images;
  if (data.imageUrl) return [data.imageUrl];
  return [];
}

function getPrice(data)  { return parseInt(data.priceOriginal ?? data.price)     || 0; }
function getSale(data)   { return parseInt(data.priceSale     ?? data.salePrice) || 0; }
function getStock(data)  { return data.stockCount ?? data.stock ?? null; }
function getBadge(data)  { return data.badge || null; }

function sellPrice(data) {
  const p = getPrice(data), s = getSale(data);
  return (s > 0 && s < p) ? s : p;
}

// ── Cart persistence ──────────────────────────────────────────────────────
function loadCart() {
  try { return JSON.parse(localStorage.getItem('charming-cart') || '[]'); }
  catch { return []; }
}

function saveCart() {
  localStorage.setItem('charming-cart', JSON.stringify(cart));
  updateCartBadge();
  if (document.getElementById('cart-panel')?.dataset.open === '1') renderCartDrawerItems();
  if (document.getElementById('up-tab-cart')?.dataset.active === '1')  renderUserPanelCart();
}

function addToCart(product) {
  const price  = sellPrice(product);
  const images = getImages(product);
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.qty += 1; }
  else { cart.push({ id: product.id, name: product.name, price, image: images[0] || '', qty: 1 }); }
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
}

function updateCartQty(id, qty) {
  if (qty < 1) { removeFromCart(id); return; }
  const item = cart.find(i => i.id === id);
  if (item) { item.qty = qty; saveCart(); }
}

function getCartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function getCartCount()    { return cart.reduce((s, i) => s + i.qty, 0); }

function updateCartBadge() {
  const n = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'flex' : 'none';
  });
}

// ── Badge HTML ────────────────────────────────────────────────────────────
const BADGE_CLASSES = {
  'חדש':     'bg-[#2c2a29] text-white',
  'בסט-סלר': 'bg-[#a8705a] text-white',
  'מבצע':    'bg-red-600 text-white',
};

function badgeChip(badge) {
  if (!badge) return '';
  const cls = BADGE_CLASSES[badge] ?? 'bg-[#2c2a29] text-white';
  return `<span class="${cls} absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full z-10 tracking-wide pointer-events-none">${esc(badge)}</span>`;
}

// ── Catalog Card Rendering ─────────────────────────────────────────────────
function cardHTML(data, docId) {
  const price   = getPrice(data);
  const sale    = getSale(data);
  const hasSale = sale > 0 && sale < price;
  const images  = getImages(data);
  const badge   = getBadge(data);
  const isOOS   = getStock(data) === 0;

  const priceHTML = hasSale
    ? `<span class="font-black text-xl text-[#a8705a]">${sale} &#8362;</span>
       <span class="text-[#9a8e8a] line-through text-sm mr-1">${price} &#8362;</span>`
    : `<span class="font-black text-xl text-[#a8705a]">${price} &#8362;</span>`;

  return `
<article class="shop-card${isOOS ? ' shop-card--oos' : ''}" data-doc="${esc(docId)}" style="cursor:pointer">
  <div class="shop-card-img relative">
    <img class="product-slide product-slide--active"
         src="${esc(images[0] || '')}"
         alt="${esc(data.name)}"
         loading="lazy" />
    ${badgeChip(badge)}
    ${isOOS ? `<div class="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
      <span class="bg-gray-200 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-full">אזל המלאי</span>
    </div>` : ''}
  </div>
  <div class="shop-card-body">
    <h3 class="shop-card-title">${esc(data.name)}</h3>
    <div class="shop-price-area">${priceHTML}</div>
    <button class="btn shop-order-btn mt-auto w-full text-center text-sm" style="margin-top:auto">
      צפי במוצר
    </button>
  </div>
</article>`;
}

function initCard(card) {
  const docId = card.dataset.doc;
  card.addEventListener('click', () => {
    const product = allProducts.find(p => p.id === docId);
    if (product) showProductDetail(product);
  });
}

// ── Product Detail Modal ───────────────────────────────────────────────────
function injectProductModal() {
  if (document.getElementById('product-detail-modal')) return;
  const el = document.createElement('div');
  el.id = 'product-detail-modal';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;align-items:center;justify-content:center;padding:16px;background:rgba(44,42,41,0.6);backdrop-filter:blur(6px);';
  el.innerHTML = `
    <div id="pdm-inner" dir="rtl"
         style="background:#fff;border-radius:24px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;position:relative;animation:fadein 0.25s ease;">
      <button id="pdm-close" aria-label="סגור"
        style="position:absolute;top:14px;left:14px;z-index:20;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.9);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#6b7280;cursor:pointer;transition:background 0.2s;">✕</button>

      <!-- Gallery -->
      <div style="position:relative;height:340px;border-radius:24px 24px 0 0;overflow:hidden;background:#f5ece7;flex-shrink:0;">
        <div id="pdm-slides" style="position:relative;width:100%;height:100%;"></div>
        <button id="pdm-prev" aria-label="תמונה קודמת"
          style="display:none;position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:10;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:1px solid #e5e7eb;font-size:1.4rem;color:#2c2a29;cursor:pointer;align-items:center;justify-content:center;">›</button>
        <button id="pdm-next" aria-label="תמונה הבאה"
          style="display:none;position:absolute;left:12px;top:50%;transform:translateY(-50%);z-index:10;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:1px solid #e5e7eb;font-size:1.4rem;color:#2c2a29;cursor:pointer;align-items:center;justify-content:center;">‹</button>
        <div id="pdm-dots" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:10;"></div>
      </div>

      <!-- Content -->
      <div style="padding:24px 28px 32px;display:flex;flex-direction:column;gap:16px;" dir="rtl">
        <!-- Title row -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <h2 id="pdm-name" style="font-family:'Heebo',sans-serif;font-size:1.6rem;font-weight:900;color:#2c2a29;margin:0;line-height:1.2;"></h2>
            <p id="pdm-sku" style="display:none;font-size:0.7rem;color:#9a8e8a;font-family:monospace;margin-top:4px;"></p>
          </div>
          <div id="pdm-price-block" style="text-align:left;flex-shrink:0;"></div>
        </div>

        <!-- Meta chips -->
        <div id="pdm-meta" style="display:flex;flex-wrap:wrap;gap:8px;"></div>

        <!-- Description -->
        <p id="pdm-desc" style="display:none;font-size:0.9rem;color:#4a3f3c;line-height:1.75;"></p>

        <!-- Shipping note -->
        <div style="background:#f5ece7;border:1px solid #e8cfc4;border-radius:14px;padding:14px 18px;font-size:0.85rem;color:#4a3f3c;line-height:1.6;">
          🚚 משלוח עד הבית (35 &#8362;) או איסוף עצמי מראשון לציון (חינם) — בחירה בשלב התשלום.
        </div>

        <!-- Action buttons -->
        <div id="pdm-actions" style="display:flex;gap:12px;">
          <button id="pdm-add-cart"
            style="flex:1;background:#2c2a29;color:#fff;border:none;border-radius:50px;padding:14px 20px;font-family:'Assistant',sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;transition:background 0.2s,transform 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            הוספה לסל
          </button>
          <button id="pdm-quick-buy"
            style="flex:1;background:#c9957a;color:#fff;border:none;border-radius:50px;padding:14px 20px;font-family:'Assistant',sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;transition:background 0.2s,transform 0.2s;">
            קנייה מהירה
          </button>
        </div>

        <!-- OOS -->
        <div id="pdm-oos" style="display:none;text-align:center;padding:14px;background:#fef2f2;border-radius:12px;font-size:0.85rem;color:#ef4444;font-weight:600;">
          פריט זה אזל מהמלאי — צרי קשר לבדיקת זמינות
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById('pdm-close').addEventListener('click', hideProductDetail);
  document.getElementById('pdm-prev').addEventListener('click', () => pdmSetSlide(pdmSlideIdx - 1));
  document.getElementById('pdm-next').addEventListener('click', () => pdmSetSlide(pdmSlideIdx + 1));
  el.addEventListener('click', e => { if (e.target === el) hideProductDetail(); });
}

function pdmSetSlide(i) {
  const n = pdmImages.length;
  if (!n) return;
  pdmSlideIdx = ((i % n) + n) % n;
  document.querySelectorAll('#pdm-slides .pdm-slide').forEach((s, idx) => {
    s.style.opacity = idx === pdmSlideIdx ? '1' : '0';
    s.style.zIndex  = idx === pdmSlideIdx ? '1' : '0';
  });
  document.querySelectorAll('#pdm-dots button').forEach((d, idx) => {
    d.style.background = idx === pdmSlideIdx ? '#c9957a' : 'rgba(255,255,255,0.5)';
    d.style.width      = idx === pdmSlideIdx ? '14px' : '8px';
  });
}

function showProductDetail(product) {
  const modal = document.getElementById('product-detail-modal');
  if (!modal) return;

  pdmImages   = getImages(product);
  pdmSlideIdx = 0;

  const price   = getPrice(product);
  const sale    = getSale(product);
  const hasSale = sale > 0 && sale < price;
  const isOOS   = getStock(product) === 0;

  // Gallery
  const slidesEl = document.getElementById('pdm-slides');
  const dotsEl   = document.getElementById('pdm-dots');
  const prevBtn  = document.getElementById('pdm-prev');
  const nextBtn  = document.getElementById('pdm-next');
  slidesEl.innerHTML = '';
  dotsEl.innerHTML   = '';

  if (!pdmImages.length) {
    slidesEl.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;">💎</div>';
  } else {
    pdmImages.forEach((url, i) => {
      const slide = document.createElement('div');
      slide.className = 'pdm-slide';
      slide.style.cssText = `position:absolute;inset:0;transition:opacity 0.3s ease;opacity:${i === 0 ? '1' : '0'};z-index:${i === 0 ? '1' : '0'};`;
      slide.innerHTML = `<img src="${esc(url)}" alt="${esc(product.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />`;
      slidesEl.appendChild(slide);

      const dot = document.createElement('button');
      dot.style.cssText = `width:${i === 0 ? '14px' : '8px'};height:8px;border-radius:50px;border:none;cursor:pointer;transition:all 0.25s;background:${i === 0 ? '#c9957a' : 'rgba(255,255,255,0.5)'};padding:0;`;
      dot.setAttribute('aria-label', `תמונה ${i + 1}`);
      dot.addEventListener('click', () => pdmSetSlide(i));
      dotsEl.appendChild(dot);
    });
  }

  prevBtn.style.display = pdmImages.length > 1 ? 'flex' : 'none';
  nextBtn.style.display = pdmImages.length > 1 ? 'flex' : 'none';

  // Text content
  document.getElementById('pdm-name').textContent = product.name || '';

  const skuEl = document.getElementById('pdm-sku');
  if (product.sku) { skuEl.textContent = `SKU: ${product.sku}`; skuEl.style.display = 'block'; }
  else { skuEl.style.display = 'none'; }

  // Price
  const priceBlock = document.getElementById('pdm-price-block');
  if (hasSale) {
    priceBlock.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:8px;justify-content:flex-end;">
        <span style="font-family:'Heebo',sans-serif;font-size:1.9rem;font-weight:900;color:#a8705a;">${sale} &#8362;</span>
        <span style="text-decoration:line-through;color:#9a8e8a;font-size:1.1rem;">${price} &#8362;</span>
      </div>`;
  } else {
    priceBlock.innerHTML = `<span style="font-family:'Heebo',sans-serif;font-size:1.9rem;font-weight:900;color:#a8705a;">${price} &#8362;</span>`;
  }

  // Meta chips
  const metaEl = document.getElementById('pdm-meta');
  metaEl.innerHTML = '';
  const chipStyle = 'background:#f5ece7;color:#4a3f3c;font-size:0.75rem;font-weight:600;padding:6px 12px;border-radius:50px;border:1px solid #e8cfc4;';
  if (product.material) metaEl.innerHTML += `<span style="${chipStyle}">🪙 ${esc(product.material)}</span>`;
  if (product.category) metaEl.innerHTML += `<span style="${chipStyle}">${esc(product.category)}</span>`;
  if (product.collection) metaEl.innerHTML += `<span style="${chipStyle}">✦ ${esc(product.collection)}</span>`;

  // Description
  const descEl = document.getElementById('pdm-desc');
  if (product.description) { descEl.textContent = product.description; descEl.style.display = 'block'; }
  else { descEl.style.display = 'none'; }

  // Actions
  const actionsEl  = document.getElementById('pdm-actions');
  const oosEl      = document.getElementById('pdm-oos');
  const addCartBtn  = document.getElementById('pdm-add-cart');
  const quickBuyBtn = document.getElementById('pdm-quick-buy');

  if (isOOS) {
    actionsEl.style.display = 'none';
    oosEl.style.display     = 'block';
  } else {
    actionsEl.style.display = 'flex';
    oosEl.style.display     = 'none';
    addCartBtn.onclick = () => {
      addToCart(product);
      hideProductDetail();
      openCartDrawer();
    };
    quickBuyBtn.onclick = () => {
      const sp = sellPrice(product);
      cartCheckoutItems = [{ id: product.id, name: product.name, price: sp, image: pdmImages[0] || '', qty: 1 }];
      isQuickBuy = true;
      hideProductDetail();
      openCheckout();
    };
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideProductDetail() {
  const modal = document.getElementById('product-detail-modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  // Only restore scroll if no other overlay is open
  const cartOpen     = document.getElementById('cart-panel')?.dataset.open === '1';
  const userOpen     = document.getElementById('user-panel-inner')?.dataset.open === '1';
  const checkoutOpen = document.getElementById('checkout-modal')?.style.display === 'flex';
  if (!cartOpen && !userOpen && !checkoutOpen) document.body.style.overflow = '';
}

// ── Cart Drawer ────────────────────────────────────────────────────────────
function injectCartDrawer() {
  if (document.getElementById('cart-drawer')) return;
  const el = document.createElement('div');
  el.id = 'cart-drawer';
  el.innerHTML = `
    <div id="cart-backdrop" style="display:none;position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);transition:opacity 0.3s;"></div>
    <aside id="cart-panel" data-open="0" dir="rtl"
      style="position:fixed;top:0;right:0;height:100%;width:min(380px,92vw);background:#fff;z-index:7001;box-shadow:-8px 0 40px rgba(0,0,0,0.12);display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #f0e6d8;flex-shrink:0;">
        <h2 style="font-family:'Heebo',sans-serif;font-size:1.2rem;font-weight:900;color:#2c2a29;margin:0;">הסל שלי</h2>
        <button id="cart-close" style="width:36px;height:36px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#6b7280;cursor:pointer;" aria-label="סגור">✕</button>
      </div>
      <!-- Items -->
      <div id="cart-items-list" style="flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:10px;"></div>
      <!-- Empty -->
      <div id="cart-empty-state" style="display:none;flex:1;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;">
        <div style="font-size:3.5rem;margin-bottom:14px;">🛍️</div>
        <p style="font-weight:700;color:#4a3f3c;margin:0 0 4px;">הסל שלך ריק</p>
        <p style="font-size:0.85rem;color:#9a8e8a;margin:0;">בחרי מוצר יפה והוסיפי לסל</p>
      </div>
      <!-- Footer -->
      <div id="cart-footer" style="display:none;border-top:1px solid #f0e6d8;padding:18px 22px;flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <span style="font-size:0.85rem;color:#9a8e8a;">סה"כ (לפני משלוח)</span>
          <span id="cart-subtotal" style="font-family:'Heebo',sans-serif;font-size:1.4rem;font-weight:900;color:#a8705a;">0 &#8362;</span>
        </div>
        <button id="cart-checkout-btn" style="width:100%;background:#c9957a;color:#fff;border:none;border-radius:50px;padding:14px;font-family:'Assistant',sans-serif;font-size:0.95rem;font-weight:700;cursor:pointer;transition:background 0.2s,transform 0.2s;margin-bottom:8px;">המשיכי לתשלום</button>
        <button id="cart-continue-btn" style="width:100%;background:transparent;color:#9a8e8a;border:1px solid #e5e7eb;border-radius:50px;padding:12px;font-family:'Assistant',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;transition:border-color 0.2s,color 0.2s;">המשיכי בקניות</button>
      </div>
    </aside>`;
  document.body.appendChild(el);
  document.getElementById('cart-close').addEventListener('click', closeCartDrawer);
  document.getElementById('cart-backdrop').addEventListener('click', closeCartDrawer);
  document.getElementById('cart-continue-btn').addEventListener('click', closeCartDrawer);
  document.getElementById('cart-checkout-btn').addEventListener('click', () => {
    cartCheckoutItems = [];
    isQuickBuy = false;
    closeCartDrawer();
    openCheckout();
  });
}

function openCartDrawer() {
  renderCartDrawerItems();
  document.getElementById('cart-backdrop').style.display = 'block';
  document.getElementById('cart-panel').style.transform = 'translateX(0)';
  document.getElementById('cart-panel').dataset.open = '1';
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  document.getElementById('cart-backdrop').style.display = 'none';
  document.getElementById('cart-panel').style.transform = 'translateX(100%)';
  document.getElementById('cart-panel').dataset.open = '0';
  document.body.style.overflow = '';
}

function renderCartDrawerItems() {
  const listEl     = document.getElementById('cart-items-list');
  const emptyState = document.getElementById('cart-empty-state');
  const footerEl   = document.getElementById('cart-footer');
  const subtotalEl = document.getElementById('cart-subtotal');
  if (!listEl) return;

  if (!cart.length) {
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    emptyState.style.display = 'flex';
    footerEl.style.display   = 'none';
    return;
  }
  emptyState.style.display = 'none';
  footerEl.style.display   = 'block';
  listEl.style.display     = 'flex';

  listEl.innerHTML = cart.map(item => `
    <div style="display:flex;gap:12px;align-items:center;background:#fdf8f5;border-radius:16px;padding:12px;" data-cid="${esc(item.id)}">
      <img src="${esc(item.image)}" alt="${esc(item.name)}"
           style="width:60px;height:60px;border-radius:12px;object-fit:cover;flex-shrink:0;background:#f5ece7;"
           onerror="this.style.display='none'" loading="lazy" />
      <div style="flex:1;min-width:0;">
        <p style="font-weight:600;font-size:0.87rem;color:#2c2a29;margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.name)}</p>
        <p style="font-family:'Heebo',sans-serif;font-weight:900;font-size:1rem;color:#a8705a;margin:0 0 6px;">${item.price * item.qty} &#8362;</p>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="cqty-dec" style="width:24px;height:24px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;font-weight:700;font-size:0.9rem;color:#4a3f3c;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
          <span class="cqty-val" style="font-weight:700;font-size:0.87rem;color:#2c2a29;min-width:16px;text-align:center;">${item.qty}</span>
          <button class="cqty-inc" style="width:24px;height:24px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;font-weight:700;font-size:0.9rem;color:#4a3f3c;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
        </div>
      </div>
      <button class="citem-del" style="width:28px;height:28px;border-radius:50%;border:none;background:transparent;color:#d1d5db;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;" aria-label="הסר">✕</button>
    </div>`).join('');

  subtotalEl.textContent = `${getCartSubtotal()} ₪`;

  listEl.querySelectorAll('[data-cid]').forEach(row => {
    const id = row.dataset.cid;
    row.querySelector('.citem-del').onclick = () => removeFromCart(id);
    row.querySelector('.cqty-inc').onclick  = () => { const it = cart.find(i => i.id === id); if (it) updateCartQty(id, it.qty + 1); };
    row.querySelector('.cqty-dec').onclick  = () => { const it = cart.find(i => i.id === id); if (it) updateCartQty(id, it.qty - 1); };
  });
}

// ── User Panel ─────────────────────────────────────────────────────────────
function injectUserPanel() {
  if (document.getElementById('user-panel')) return;
  const el = document.createElement('div');
  el.id = 'user-panel';
  el.innerHTML = `
    <div id="user-backdrop" style="display:none;position:fixed;inset:0;z-index:7500;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);"></div>
    <aside id="user-panel-inner" data-open="0" dir="rtl"
      style="position:fixed;top:0;right:0;height:100%;width:min(380px,92vw);background:#fff;z-index:7501;box-shadow:-8px 0 40px rgba(0,0,0,0.12);display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #f0e6d8;flex-shrink:0;">
        <div>
          <h2 style="font-family:'Heebo',sans-serif;font-size:1.2rem;font-weight:900;color:#2c2a29;margin:0;">האזור האישי</h2>
          <p id="up-email" style="font-size:0.75rem;color:#9a8e8a;margin:2px 0 0;display:none;"></p>
        </div>
        <button id="user-panel-close" style="width:36px;height:36px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#6b7280;cursor:pointer;" aria-label="סגור">✕</button>
      </div>

      <!-- Not logged in -->
      <div id="up-guest" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;">
        <div style="font-size:4rem;margin-bottom:16px;">👤</div>
        <h3 style="font-weight:900;color:#2c2a29;font-size:1.1rem;margin:0 0 8px;">ברוכה הבאה!</h3>
        <p style="font-size:0.85rem;color:#9a8e8a;margin:0 0 24px;">התחברי כדי לצפות בהזמנות ולשמור פרטים</p>
        <a href="#" id="up-login-link" style="display:block;width:100%;background:#c9957a;color:#fff;text-align:center;border-radius:50px;padding:13px 20px;font-weight:700;font-size:0.9rem;text-decoration:none;transition:background 0.2s;">התחברי / הרשמי</a>
      </div>

      <!-- Logged in -->
      <div id="up-loggedin" style="display:none;flex:1;overflow:hidden;flex-direction:column;">
        <!-- Tabs -->
        <div style="display:flex;border-bottom:1px solid #f0e6d8;flex-shrink:0;">
          <button data-up-tab="cart"    class="up-tab" style="flex:1;padding:12px 6px;font-size:0.77rem;font-weight:700;border:none;background:transparent;cursor:pointer;border-bottom:2px solid #c9957a;color:#c9957a;font-family:'Assistant',sans-serif;">🛍 הסל</button>
          <button data-up-tab="orders"  class="up-tab" style="flex:1;padding:12px 6px;font-size:0.77rem;font-weight:700;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;color:#9a8e8a;font-family:'Assistant',sans-serif;">📦 הזמנות</button>
          <button data-up-tab="profile" class="up-tab" style="flex:1;padding:12px 6px;font-size:0.77rem;font-weight:700;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;color:#9a8e8a;font-family:'Assistant',sans-serif;">👤 פרופיל</button>
        </div>
        <!-- Tab: Cart -->
        <div id="up-tab-cart" data-active="0" style="flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:10px;"></div>
        <!-- Tab: Orders -->
        <div id="up-tab-orders" style="display:none;flex:1;overflow-y:auto;padding:16px 18px;">
          <div id="up-orders-loading" style="text-align:center;padding:32px 0;">
            <div style="width:28px;height:28px;border:3px solid #c9957a;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>
            <p style="font-size:0.85rem;color:#9a8e8a;">טוענת הזמנות...</p>
          </div>
          <div id="up-orders-list" style="display:flex;flex-direction:column;gap:10px;"></div>
          <div id="up-orders-empty" style="display:none;text-align:center;padding:40px 0;">
            <div style="font-size:3rem;margin-bottom:12px;">📦</div>
            <p style="color:#9a8e8a;font-size:0.87rem;">אין הזמנות עדיין</p>
          </div>
        </div>
        <!-- Tab: Profile -->
        <div id="up-tab-profile" style="display:none;flex:1;overflow-y:auto;padding:20px 18px;flex-direction:column;gap:18px;">
          <div id="up-profile-card" style="background:#fdf8f5;border-radius:16px;padding:16px;border:1px solid #f0e6d8;"></div>
          <div>
            <h4 style="font-size:0.7rem;font-weight:700;color:#9a8e8a;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">כתובת למשלוח</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <input id="up-street" type="text" placeholder="רחוב ומספר בית"
                style="width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:0.87rem;font-family:'Assistant',sans-serif;background:#f9fafb;box-sizing:border-box;" />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input id="up-city" type="text" placeholder="עיר"
                  style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:0.87rem;font-family:'Assistant',sans-serif;background:#f9fafb;" />
                <input id="up-zip" type="text" placeholder="מיקוד"
                  style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:0.87rem;font-family:'Assistant',sans-serif;background:#f9fafb;" />
              </div>
              <button id="up-save-addr"
                style="background:#c9957a;color:#fff;border:none;border-radius:50px;padding:12px;font-family:'Assistant',sans-serif;font-size:0.87rem;font-weight:700;cursor:pointer;transition:background 0.2s;">שמרי כתובת</button>
            </div>
          </div>
          <button id="up-logout"
            style="background:transparent;color:#9a8e8a;border:1px solid #e5e7eb;border-radius:50px;padding:12px;font-family:'Assistant',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;transition:border-color 0.2s,color 0.2s;">התנתקי</button>
        </div>
      </div>
    </aside>`;
  document.body.appendChild(el);

  // Close
  document.getElementById('user-backdrop').addEventListener('click', closeUserPanel);
  document.getElementById('user-panel-close').addEventListener('click', closeUserPanel);

  // Login link
  document.getElementById('up-login-link').addEventListener('click', e => {
    e.preventDefault();
    closeUserPanel();
    document.getElementById('auth-nav-btn')?.click();
  });

  // Tabs
  el.querySelectorAll('.up-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.upTab;
      el.querySelectorAll('.up-tab').forEach(t => {
        t.style.borderBottom = '2px solid transparent';
        t.style.color = '#9a8e8a';
      });
      tab.style.borderBottom = '2px solid #c9957a';
      tab.style.color = '#c9957a';
      ['cart','orders','profile'].forEach(n => {
        const tc = document.getElementById(`up-tab-${n}`);
        if (tc) { tc.style.display = n === name ? 'flex' : 'none'; tc.dataset.active = n === name ? '1' : '0'; }
      });
      if (name === 'orders')  loadUserOrders();
      if (name === 'cart')    renderUserPanelCart();
      if (name === 'profile') renderUserProfile();
    });
  });

  // Save address
  document.getElementById('up-save-addr').addEventListener('click', saveUserAddress);

  // Logout
  document.getElementById('up-logout').addEventListener('click', async () => {
    await signOut(auth);
    closeUserPanel();
  });
}

function openUserPanel() {
  renderUserPanelState();
  document.getElementById('user-backdrop').style.display = 'block';
  document.getElementById('user-panel-inner').style.transform = 'translateX(0)';
  document.getElementById('user-panel-inner').dataset.open = '1';
  // Show cart tab content
  const cartTab = document.getElementById('up-tab-cart');
  if (cartTab) { cartTab.style.display = 'flex'; cartTab.dataset.active = '1'; }
  document.body.style.overflow = 'hidden';
}

function closeUserPanel() {
  document.getElementById('user-backdrop').style.display = 'none';
  document.getElementById('user-panel-inner').style.transform = 'translateX(100%)';
  document.getElementById('user-panel-inner').dataset.open = '0';
  document.body.style.overflow = '';
}

function renderUserPanelState() {
  const guestEl   = document.getElementById('up-guest');
  const loggedEl  = document.getElementById('up-loggedin');
  const emailEl   = document.getElementById('up-email');
  if (currentUser) {
    guestEl.style.display   = 'none';
    loggedEl.style.display  = 'flex';
    loggedEl.style.flexDirection = 'column';
    emailEl.textContent     = currentUser.displayName || currentUser.email || '';
    emailEl.style.display   = 'block';
    renderUserPanelCart();
  } else {
    guestEl.style.display   = 'flex';
    loggedEl.style.display  = 'none';
    emailEl.style.display   = 'none';
  }
}

function renderUserPanelCart() {
  const el = document.getElementById('up-tab-cart');
  if (!el) return;
  if (!cart.length) {
    el.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;">
        <div style="font-size:3rem;margin-bottom:12px;">🛍️</div>
        <p style="font-weight:700;color:#4a3f3c;margin:0 0 4px;">הסל ריק</p>
        <p style="font-size:0.82rem;color:#9a8e8a;margin:0;">הוסיפי מוצרים מהחנות</p>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
      ${cart.map(item => `
        <div style="display:flex;gap:10px;align-items:center;background:#fdf8f5;border-radius:14px;padding:10px;">
          <img src="${esc(item.image)}" alt="${esc(item.name)}"
               style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#f5ece7;"
               onerror="this.style.display='none'" loading="lazy" />
          <div style="flex:1;min-width:0;">
            <p style="font-weight:600;font-size:0.83rem;color:#2c2a29;margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.name)}</p>
            <p style="font-weight:900;color:#a8705a;margin:0;font-size:0.95rem;">${item.price * item.qty} &#8362;</p>
            <p style="font-size:0.75rem;color:#9a8e8a;margin:0;">כמות: ${item.qty}</p>
          </div>
        </div>`).join('')}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid #f0e6d8;margin-top:4px;">
        <span style="font-size:0.85rem;color:#9a8e8a;">סה"כ</span>
        <span style="font-family:'Heebo',sans-serif;font-weight:900;font-size:1.2rem;color:#a8705a;">${getCartSubtotal()} &#8362;</span>
      </div>
      <button id="up-to-checkout"
        style="background:#c9957a;color:#fff;border:none;border-radius:50px;padding:13px;font-family:'Assistant',sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;transition:background 0.2s;margin-top:4px;">
        המשיכי לתשלום
      </button>
    </div>`;
  document.getElementById('up-to-checkout')?.addEventListener('click', () => {
    cartCheckoutItems = [];
    isQuickBuy = false;
    closeUserPanel();
    openCheckout();
  });
}

async function loadUserOrders() {
  if (!currentUser) return;
  const listEl    = document.getElementById('up-orders-list');
  const emptyEl2  = document.getElementById('up-orders-empty');
  const loadingEl = document.getElementById('up-orders-loading');
  if (!listEl) return;

  loadingEl.style.display = 'block';
  listEl.innerHTML = '';
  emptyEl2.style.display = 'none';

  try {
    const ordersRef = collection(db, `${USERS_ROOT}/${currentUser.uid}/orders`);
    const snap      = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));
    loadingEl.style.display = 'none';
    if (snap.empty) { emptyEl2.style.display = 'block'; return; }
    listEl.innerHTML = snap.docs.map(d => {
      const o    = d.data();
      const date = o.createdAt?.toDate?.()?.toLocaleDateString('he-IL') ?? '';
      const items = (o.items || []).map(i => `${i.name} ×${i.qty}`).join(' • ');
      const del  = o.delivery === 'pickup' ? 'איסוף עצמי' : 'משלוח עד הבית';
      return `
        <div style="background:#fdf8f5;border-radius:14px;padding:14px;border:1px solid #f0e6d8;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.75rem;color:#9a8e8a;">${date}</span>
            <span style="font-family:'Heebo',sans-serif;font-weight:900;color:#a8705a;font-size:1rem;">${o.total ?? 0} &#8362;</span>
          </div>
          <p style="font-size:0.83rem;font-weight:600;color:#2c2a29;margin:0 0 4px;line-height:1.4;">${items}</p>
          <p style="font-size:0.75rem;color:#9a8e8a;margin:0;">${del}</p>
        </div>`;
    }).join('');
  } catch (err) {
    loadingEl.style.display = 'none';
    listEl.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:0.85rem;padding:24px 0;">שגיאה בטעינת הזמנות</p>';
    console.error('Orders load error:', err);
  }
}

function renderUserProfile() {
  const card = document.getElementById('up-profile-card');
  if (!card || !currentUser) return;
  card.innerHTML = `
    <p style="font-weight:700;font-size:0.95rem;color:#2c2a29;margin:0 0 2px;">${esc(currentUser.displayName || 'משתמשת')}</p>
    <p style="font-size:0.8rem;color:#9a8e8a;margin:0;">${esc(currentUser.email || '')}</p>`;
  if (userAddress.street) {
    const s = document.getElementById('up-street');
    const c = document.getElementById('up-city');
    const z = document.getElementById('up-zip');
    if (s) s.value = userAddress.street || '';
    if (c) c.value = userAddress.city   || '';
    if (z) z.value = userAddress.zip    || '';
  }
}

async function saveUserAddress() {
  if (!currentUser) return;
  const street = document.getElementById('up-street')?.value.trim() || '';
  const city   = document.getElementById('up-city')?.value.trim()   || '';
  const zip    = document.getElementById('up-zip')?.value.trim()    || '';
  userAddress  = { street, city, zip };
  try {
    await setDoc(doc(db, `${USERS_ROOT}/${currentUser.uid}`), { address: { street, city, zip }, updatedAt: serverTimestamp() }, { merge: true });
    const btn = document.getElementById('up-save-addr');
    if (btn) { btn.textContent = '✓ נשמר!'; setTimeout(() => { btn.textContent = 'שמרי כתובת'; }, 2200); }
  } catch (err) {
    console.error('Address save error:', err);
  }
}

// ── Checkout Modal ─────────────────────────────────────────────────────────
function injectCheckoutModal() {
  if (document.getElementById('checkout-modal')) return;
  const el = document.createElement('div');
  el.id = 'checkout-modal';
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;align-items:center;justify-content:center;padding:16px;background:rgba(44,42,41,0.65);backdrop-filter:blur(6px);';
  el.innerHTML = `
    <div dir="rtl" style="background:#fff;border-radius:24px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;animation:fadein 0.25s ease;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f0e6d8;position:sticky;top:0;background:#fff;border-radius:24px 24px 0 0;z-index:10;">
        <h2 style="font-family:'Heebo',sans-serif;font-size:1.2rem;font-weight:900;color:#2c2a29;margin:0;">סיכום והזמנה</h2>
        <button id="checkout-close" style="width:36px;height:36px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#6b7280;cursor:pointer;" aria-label="סגור">✕</button>
      </div>

      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:22px;">
        <!-- Order summary -->
        <div>
          <h3 style="font-size:0.7rem;font-weight:700;color:#9a8e8a;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">פריטים</h3>
          <div id="co-items" style="display:flex;flex-direction:column;gap:10px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #f0e6d8;margin-top:10px;">
            <span style="font-size:0.85rem;color:#9a8e8a;">סה"כ מוצרים</span>
            <span id="co-items-total" style="font-weight:700;color:#2c2a29;">0 &#8362;</span>
          </div>
        </div>

        <!-- Delivery -->
        <div>
          <h3 style="font-size:0.7rem;font-weight:700;color:#9a8e8a;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">אופן קבלה</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <label id="co-del-delivery-lbl" style="display:flex;align-items:center;gap:14px;background:#fdf8f5;border:2px solid #c9957a;border-radius:16px;padding:14px 16px;cursor:pointer;transition:border-color 0.2s;">
              <input type="radio" name="co-delivery" value="delivery" checked style="accent-color:#c9957a;width:16px;height:16px;flex-shrink:0;" />
              <div style="flex:1;">
                <p style="font-weight:700;font-size:0.9rem;color:#2c2a29;margin:0 0 2px;">📦 משלוח עד הבית</p>
                <p style="font-size:0.77rem;color:#9a8e8a;margin:0;">תוך 3 ימי עסקים</p>
              </div>
              <span style="font-weight:900;color:#a8705a;font-size:0.9rem;flex-shrink:0;">35 &#8362;</span>
            </label>
            <label id="co-del-pickup-lbl" style="display:flex;align-items:center;gap:14px;background:#fdf8f5;border:2px solid transparent;border-radius:16px;padding:14px 16px;cursor:pointer;transition:border-color 0.2s;">
              <input type="radio" name="co-delivery" value="pickup" style="accent-color:#c9957a;width:16px;height:16px;flex-shrink:0;" />
              <div style="flex:1;">
                <p style="font-weight:700;font-size:0.9rem;color:#2c2a29;margin:0 0 2px;">🏪 איסוף עצמי</p>
                <p style="font-size:0.77rem;color:#9a8e8a;margin:0;">ראשון לציון — בתיאום מראש</p>
              </div>
              <span style="font-weight:900;color:#16a34a;font-size:0.9rem;flex-shrink:0;">חינם</span>
            </label>
          </div>
        </div>

        <!-- Grand total -->
        <div style="background:#fdf8f5;border-radius:16px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border:1px solid #f0e6d8;">
          <span style="font-weight:700;color:#2c2a29;">סה"כ לתשלום</span>
          <span id="co-grand-total" style="font-family:'Heebo',sans-serif;font-weight:900;font-size:1.6rem;color:#a8705a;">0 &#8362;</span>
        </div>

        <!-- Note -->
        <div>
          <label style="font-size:0.7rem;font-weight:700;color:#9a8e8a;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:8px;">הערה אישית (אופציונלי)</label>
          <textarea id="co-note" rows="2" placeholder="בקשה מיוחדת, חריטה, שם..."
            style="width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:0.87rem;font-family:'Assistant',sans-serif;background:#f9fafb;resize:none;box-sizing:border-box;direction:rtl;"></textarea>
        </div>

        <!-- Submit -->
        <button id="co-submit"
          style="width:100%;background:#25D366;color:#fff;border:none;border-radius:50px;padding:16px;font-family:'Assistant',sans-serif;font-size:1rem;font-weight:700;cursor:pointer;transition:background 0.2s,transform 0.2s;display:flex;align-items:center;justify-content:center;gap:10px;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          שלחי הזמנה בוואצאפ
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('checkout-close').addEventListener('click', closeCheckout);
  el.addEventListener('click', e => { if (e.target === el) closeCheckout(); });
  el.querySelectorAll('input[name="co-delivery"]').forEach(r => r.addEventListener('change', onDeliveryChange));
  document.getElementById('co-submit').addEventListener('click', submitCheckout);
}

function onDeliveryChange() {
  const isPickup = document.querySelector('input[name="co-delivery"]:checked')?.value === 'pickup';
  const delLbl   = document.getElementById('co-del-delivery-lbl');
  const pickLbl  = document.getElementById('co-del-pickup-lbl');
  if (delLbl)  delLbl.style.borderColor  = !isPickup ? '#c9957a' : 'transparent';
  if (pickLbl) pickLbl.style.borderColor = isPickup  ? '#c9957a' : 'transparent';
  updateCheckoutTotal();
}

function updateCheckoutTotal() {
  const items      = isQuickBuy ? cartCheckoutItems : cart;
  const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const isPickup   = document.querySelector('input[name="co-delivery"]:checked')?.value === 'pickup';
  const total      = itemsTotal + (isPickup ? 0 : SHIPPING);
  const itEl = document.getElementById('co-items-total');
  const gtEl = document.getElementById('co-grand-total');
  if (itEl) itEl.textContent = `${itemsTotal} ₪`;
  if (gtEl) gtEl.textContent = `${total} ₪`;
}

function openCheckout() {
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;
  const items = isQuickBuy ? cartCheckoutItems : cart;

  // Populate items
  const coItemsEl = document.getElementById('co-items');
  if (coItemsEl) {
    coItemsEl.innerHTML = items.map(item => `
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${esc(item.image)}" alt="${esc(item.name)}"
             style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#f5ece7;"
             onerror="this.style.display='none'" loading="lazy" />
        <div style="flex:1;min-width:0;">
          <p style="font-size:0.87rem;font-weight:600;color:#2c2a29;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.name)}</p>
          <p style="font-size:0.77rem;color:#9a8e8a;margin:0;">כמות: ${item.qty}</p>
        </div>
        <span style="font-weight:700;font-size:0.9rem;color:#2c2a29;flex-shrink:0;">${item.price * item.qty} &#8362;</span>
      </div>`).join('');
  }

  // Reset delivery to "delivery" (checked)
  const deliveryRadio = modal.querySelector('input[name="co-delivery"][value="delivery"]');
  if (deliveryRadio) deliveryRadio.checked = true;
  const delLbl  = document.getElementById('co-del-delivery-lbl');
  const pickLbl = document.getElementById('co-del-pickup-lbl');
  if (delLbl)  delLbl.style.borderColor  = '#c9957a';
  if (pickLbl) pickLbl.style.borderColor = 'transparent';
  updateCheckoutTotal();

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;
  modal.style.display = 'none';
  if (!isQuickBuy) { /* keep cart */ }
  cartCheckoutItems = [];
  isQuickBuy = false;
  const noteEl = document.getElementById('co-note');
  if (noteEl) noteEl.value = '';
  document.body.style.overflow = '';
}

async function submitCheckout() {
  const items    = isQuickBuy ? cartCheckoutItems : [...cart];
  const isPickup = document.querySelector('input[name="co-delivery"]:checked')?.value === 'pickup';
  const note     = document.getElementById('co-note')?.value.trim() || '';
  const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping   = isPickup ? 0 : SHIPPING;
  const total      = itemsTotal + shipping;
  const delivery   = isPickup ? 'pickup' : 'delivery';

  // Save order to Firestore if logged in
  if (currentUser) {
    try {
      await addDoc(collection(db, `${USERS_ROOT}/${currentUser.uid}/orders`), {
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        delivery, shipping, total,
        note: note || null,
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error('Order save failed:', err); }
  }

  // Clear full cart (not quick buy)
  if (!isQuickBuy) { cart = []; saveCart(); }

  // Build WhatsApp message
  const lines    = items.map(i => `*${i.name}* ×${i.qty} — ${i.price * i.qty} ₪`).join('\n');
  const delLine  = isPickup ? 'איסוף עצמי מראשון לציון (חינם)' : `משלוח עד הבית (+${SHIPPING} ₪)`;
  let msg = `היי ויק, הגעתי אלייך דרך האתר ואני מעוניינת להזמין:\n\n${lines}`;
  if (note) msg += `\n\nהערה: ${note}`;
  msg += `\n\nאופן קבלה: ${delLine}`;
  msg += `\n\nסה"כ לתשלום: *${total} ₪*`;

  closeCheckout();
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

// ── Nav button wiring ──────────────────────────────────────────────────────
function setupNavButtons() {
  document.getElementById('nav-cart-btn')?.addEventListener('click', openCartDrawer);
  document.getElementById('nav-user-btn')?.addEventListener('click', openUserPanel);
  document.getElementById('cart-fab')?.addEventListener('click', openCartDrawer);
}

// ── Auth listener ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  const navUser = document.getElementById('nav-user-btn');
  if (navUser) {
    navUser.title = user ? (user.displayName || user.email || 'פרופיל') : 'אזור אישי';
    navUser.dataset.loggedIn = user ? '1' : '0';
  }
  if (user) {
    try {
      const uDoc = await getDoc(doc(db, `${USERS_ROOT}/${user.uid}`));
      if (uDoc.exists() && uDoc.data().address) userAddress = uDoc.data().address;
    } catch { /* silent */ }
  }
});

// ── Firestore subscription ─────────────────────────────────────────────────
const q = query(collection(db, COL_PATH), orderBy('createdAt', 'desc'));

onSnapshot(q, snapshot => {
  if (loadEl) loadEl.style.display = 'none';
  const visible = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.status || p.status === 'published');
  allProducts = visible;

  if (!visible.length) {
    if (emptyEl) emptyEl.style.display = '';
    if (grid)    grid.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (grid) {
    grid.innerHTML = visible.map(p => cardHTML(p, p.id)).join('');
    grid.querySelectorAll('.shop-card').forEach(initCard);
  }
}, err => {
  console.error('Catalog error:', err);
  if (loadEl) loadEl.style.display = 'none';
  if (emptyEl) {
    emptyEl.style.display = '';
    const p = emptyEl.querySelector('p');
    if (p) p.textContent = 'שגיאה בטעינת המוצרים. נסי לרענן.';
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  injectProductModal();
  injectCartDrawer();
  injectUserPanel();
  injectCheckoutModal();
  setupNavButtons();
  updateCartBadge();
}
init();
