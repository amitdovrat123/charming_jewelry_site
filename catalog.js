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

function cardHTML(data, docId) {
  uid++;
  const price    = parseInt(data.price) || 0;
  const hasSale  = data.salePrice && data.salePrice > 0 && data.salePrice < price;
  const sellPrice = hasSale ? parseInt(data.salePrice) : price;
  const isOOS    = data.stock === 0;
  const total    = sellPrice + SHIPPING;

  const priceBlock = hasSale
    ? `<div class="shop-price-area">
         <span class="shop-card-price shop-price-sale">${data.salePrice} &#8362;</span>
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
       <button class="btn shop-order-btn shop-order-btn--oos"
               data-product="${esc(data.name)}" data-price="${sellPrice}" disabled>אזל המלאי</button>`
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

  if (prevBtn) prevBtn.hidden = true;
  if (nextBtn) nextBtn.hidden = true;

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

  if (isOOS || !btn) return; // out-of-stock: no pricing/order logic needed

  const basePrice = parseInt(btn.dataset.price) || 0;

  function updatePrice() {
    const checked  = card.querySelector('.delivery-group input[type="radio"]:checked');
    const isPickup = checked && checked.value.includes('איסוף');
    const total    = isPickup ? basePrice : basePrice + SHIPPING;
    if (noteEl)  noteEl.textContent  = isPickup ? '(איסוף עצמי — חינם)' : `+ 35 \u20aa משלוח (בהתאם לתקנון)`;
    if (totalEl) totalEl.textContent = total + ' \u20aa';
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
      ? `\u05d0\u05d9\u05e1\u05d5\u05e3 \u05e2\u05e6\u05de\u05d9 \u05de\u05e8\u05d0\u05e9\u05d5\u05df \u05dc\u05e6\u05d9\u05d5\u05df (\u05d7\u05d9\u05e0\u05dd)`
      : `\u05de\u05e9\u05dc\u05d5\u05d7 \u05e2\u05d3 \u05d4\u05d1\u05d9\u05ea (+35 \u05e9"\u05d7)`;
    const total    = isPickup ? price : price + SHIPPING;
    const personal = (card.querySelector('.personal-input') || {}).value?.trim() || '';

    let msg = `\u05d4\u05d9\u05d9 \u05d5\u05d9\u05e7, \u05d4\u05d2\u05e2\u05ea\u05d9 \u05d0\u05dc\u05d9\u05d9\u05da \u05d3\u05e8\u05da \u05d4\u05d0\u05ea\u05e8 \u05d5\u05d0\u05e0\u05d9 \u05de\u05e2\u05d5\u05e0\u05d9\u05d9\u05e0\u05ea \u05dc\u05d4\u05d6\u05de\u05d9\u05df \u05d0\u05ea *${product}*:\n\n`;
    if (personal) msg += `\u05d1\u05d7\u05d9\u05e8\u05d4 \u05d0\u05d9\u05e9\u05d9\u05ea: ${personal}\n`;
    msg += `\n\u05d0\u05d5\u05e4\u05df \u05e7\u05d1\u05dc\u05d4: ${delivery}`;
    msg += `\n\n\u05e1\u05d4"\u05db \u05dc\u05ea\u05e9\u05dc\u05d5\u05dd: ${total} \u05e9"\u05d7`;

    window.open(
      'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg),
      '_blank', 'noopener,noreferrer'
    );
  });
}

// ── Real-time Firestore subscription ──────────────────────────────────────────
const q = query(collection(db, COL_PATH), orderBy('createdAt', 'desc'));

onSnapshot(q, snapshot => {
  if (loadEl) loadEl.style.display = 'none';

  if (snapshot.empty) {
    if (emptyEl) emptyEl.style.display = '';
    if (grid)    grid.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  uid = 0;
  if (grid) {
    grid.innerHTML = snapshot.docs.map(d => cardHTML(d.data(), d.id)).join('');
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
