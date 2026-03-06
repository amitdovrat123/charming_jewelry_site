import { db } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const WA_NUMBER = '972524131991';
const SHIPPING  = 35;
const COL_PATH  = 'artifacts/charming-3dd6f/public/data/products';

const grid    = document.getElementById('shop-catalog-grid');
const loadEl  = document.getElementById('shop-catalog-loading');
const emptyEl = document.getElementById('shop-catalog-empty');

let uid = 0;

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Normalize field names — support both old schema (price/stock/salePrice)
// and new admin schema (priceOriginal/stockCount/priceSale)
function getPrice(data)     { return parseInt(data.priceOriginal ?? data.price)     || 0; }
function getSale(data)      { return parseInt(data.priceSale     ?? data.salePrice) || 0; }
function getStock(data)     { return data.stockCount  ?? data.stock  ?? null; }
function getBadgeLabel(data){ return data.badge || null; }

function cardHTML(data, docId) {
  uid++;
  const price     = getPrice(data);
  const sale      = getSale(data);
  const hasSale   = sale > 0 && sale < price;
  const sellPrice = hasSale ? sale : price;
  const isOOS     = getStock(data) === 0;
  const badge     = getBadgeLabel(data);
  const total     = sellPrice + SHIPPING;

  // Badge HTML
  const BADGE_CLASS = {
    'חדש':      'shop-card-badge',
    'בסט-סלר':  'shop-card-badge shop-card-badge--hot',
    'מבצע':     'shop-card-badge shop-card-badge--sale',
  };
  const badgeHTML = badge
    ? `<span class="${BADGE_CLASS[badge] ?? 'shop-card-badge'}">${esc(badge)}</span>`
    : '';

  const priceBlock = hasSale
    ? `<div class="shop-price-area">
         <span class="shop-card-price shop-price-sale">${sale} &#8362;</span>
         <span class="shop-price-original">${price} &#8362;</span>
         <span class="shop-sale-badge">מבצע</span>
       </div>
       <span class="shop-shipping-note">+ 35 &#8362; משלוח (בהתאם לתקנון)</span>`
    : `<div class="shop-price-area">
         <span class="shop-card-price">${price} &#8362;</span>
         <span class="shop-shipping-note">+ 35 &#8362; משלוח (בהתאם לתקנון)</span>
       </div>`;

  const orderBlock = isOOS
    ? `<div class="shop-oos-badge">אזל המלאי — לבירור זמינות צרי קשר</div>
       <button class="btn shop-order-btn shop-order-btn--oos" disabled>אזל המלאי</button>`
    : `<div class="shop-total-line">סה"כ לתשלום: <strong class="js-total-price">${total} &#8362;</strong></div>
       <button class="btn shop-order-btn"
               data-product="${esc(data.name)}" data-price="${sellPrice}">הזמיני עכשיו</button>`;

  const deliveryBlock = isOOS ? '' : `
    <div class="option-group delivery-group">
      <span class="option-label">אופן קבלה:</span>
      <div class="radio-group">
        <label class="radio-pill">
          <input type="radio" name="cat-delivery-${uid}" value="משלוח עד הבית" checked />
          <span>משלוח</span>
        </label>
        <label class="radio-pill">
          <input type="radio" name="cat-delivery-${uid}" value="איסוף עצמי מראשון לציון" />
          <span>איסוף עצמי</span>
        </label>
      </div>
    </div>
    <div class="option-group personalisation-group">
      <label class="option-label" for="cat-personal-${uid}">תוספת אישית:</label>
      <input type="text" class="personal-input" id="cat-personal-${uid}"
             placeholder="אות, מזל, בקשה מיוחדת..." />
    </div>`;

  return `
<article class="shop-card${isOOS ? ' shop-card--oos' : ''}" data-doc="${esc(docId)}">
  <div class="shop-card-img">
    <img class="product-slide product-slide--active"
         src="${esc(data.imageUrl || '')}"
         alt="${esc(data.name)}"
         loading="lazy" />
    ${badgeHTML}
    <button class="img-arrow img-arrow--prev" aria-label="תמונה קודמת">&#8250;</button>
    <button class="img-arrow img-arrow--next" aria-label="תמונה הבאה">&#8249;</button>
  </div>
  <div class="shop-card-body">
    <h3 class="shop-card-title">${esc(data.name)}</h3>
    <p class="shop-card-desc">${esc(data.description || '')}</p>
    ${priceBlock}
    ${deliveryBlock}
    ${orderBlock}
  </div>
</article>`;
}

function initCard(card) {
  const imgBox  = card.querySelector('.shop-card-img');
  const btn     = card.querySelector('.shop-order-btn');
  const noteEl  = card.querySelector('.shop-shipping-note');
  const totalEl = card.querySelector('.js-total-price');
  const prevBtn = imgBox && imgBox.querySelector('.img-arrow--prev');
  const nextBtn = imgBox && imgBox.querySelector('.img-arrow--next');
  const isOOS   = card.classList.contains('shop-card--oos');

  // Single-image: hide arrows
  const slides = imgBox ? imgBox.querySelectorAll('.product-slide') : [];
  if (prevBtn) prevBtn.hidden = slides.length <= 1;
  if (nextBtn) nextBtn.hidden = slides.length <= 1;

  // Lightbox
  if (imgBox) {
    imgBox.addEventListener('click', function (e) {
      if (e.target.classList.contains('img-arrow')) return;
      const lightbox    = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightboxImg');
      if (!lightbox || !lightboxImg) return;
      const active = imgBox.querySelector('.product-slide--active');
      if (active) { lightboxImg.src = active.src; lightboxImg.alt = active.alt || ''; }
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }

  if (isOOS || !btn) return;

  const basePrice = parseInt(btn.dataset.price) || 0;

  function updatePrice() {
    const checked  = card.querySelector('.delivery-group input[type="radio"]:checked');
    const isPickup = checked && checked.value.includes('איסוף');
    const total    = isPickup ? basePrice : basePrice + SHIPPING;
    if (noteEl)  noteEl.textContent  = isPickup ? '(איסוף עצמי — חינם)' : `+ 35 ₪ משלוח (בהתאם לתקנון)`;
    if (totalEl) totalEl.textContent = total + ' ₪';
  }

  card.querySelectorAll('.delivery-group input[type="radio"]').forEach(r => {
    r.addEventListener('change', updatePrice);
  });

  btn.addEventListener('click', function () {
    const product  = btn.dataset.product || '';
    const price    = parseInt(btn.dataset.price) || 0;
    const checked  = card.querySelector('.delivery-group input[type="radio"]:checked');
    const isPickup = checked && checked.value.includes('איסוף');
    const delivery = isPickup
      ? 'איסוף עצמי מראשון לציון (חינם)'
      : 'משלוח עד הבית (+35 ש"ח)';
    const total    = isPickup ? price : price + SHIPPING;
    const personal = (card.querySelector('.personal-input') || {}).value?.trim() || '';

    let msg = `היי ויק, הגעתי אלייך דרך האתר ואני מעוניינת להזמין את *${product}*:\n\n`;
    if (personal) msg += `בחירה אישית: ${personal}\n`;
    msg += `\nאופן קבלה: ${delivery}`;
    msg += `\n\nסה"כ לתשלום: ${total} ש"ח`;

    window.open(
      'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg),
      '_blank', 'noopener,noreferrer'
    );
  });
}

// ── Real-time Firestore subscription ──────────────────────────────
const q = query(collection(db, COL_PATH), orderBy('createdAt', 'desc'));

onSnapshot(q, snapshot => {
  if (loadEl) loadEl.style.display = 'none';

  // Filter: only show published products
  const visible = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.status || p.status === 'published');

  if (!visible.length) {
    if (emptyEl) emptyEl.style.display = '';
    if (grid)    grid.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  uid = 0;
  if (grid) {
    grid.innerHTML = visible.map(p => cardHTML(p, p.id)).join('');
    grid.querySelectorAll('.shop-card').forEach(initCard);
  }
}, err => {
  console.error('Catalog load error:', err);
  if (loadEl)  loadEl.style.display  = 'none';
  if (emptyEl) {
    emptyEl.style.display = '';
    const p = emptyEl.querySelector('p');
    if (p) p.textContent = 'שגיאה בטעינת המוצרים. נסי לרענן את העמוד.';
  }
});
