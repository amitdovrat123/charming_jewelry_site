// Dynamically populates the side drawer's sub-category lists.
// Source of truth: the `categoriesConfig` doc in Firestore, which the admin
// manages via the "ערוך תתי קטגוריות לקטגוריה זו" button in the product form.

import { db } from './firebase-config.js';
import {
  doc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SUBCAT_DOC_PATH = 'artifacts/charming-3dd6f/public/data/settings/categoriesConfig';

function renderSublist(li, catName, subCats) {
  const sublist = li.querySelector('.nav-sublist');
  if (!sublist) return;
  const catEnc = encodeURIComponent(catName);
  const items = [
    `<li><a href="shop.html?cat=${catEnc}">כל ה${catName}</a></li>`,
    ...subCats.map(s =>
      `<li><a href="shop.html?cat=${catEnc}&subCat=${encodeURIComponent(s)}">${s}</a></li>`
    ),
    `<li><a href="shop.html?cat=${catEnc}&sale=1">${catName} במבצע</a></li>`,
  ];
  sublist.innerHTML = items.join('');
}

function applyConfig(subCatsByCat) {
  document.querySelectorAll('.nav-item-expandable').forEach(li => {
    const span = li.querySelector('.nav-expand-btn span');
    if (!span) return;
    const catName = span.textContent.trim();
    const subs = Array.isArray(subCatsByCat[catName]) ? subCatsByCat[catName] : [];
    renderSublist(li, catName, subs);
  });
}

onSnapshot(doc(db, SUBCAT_DOC_PATH), (snap) => {
  const cfg = (snap.exists() && snap.data()?.subCategories) || {};
  applyConfig(cfg);
}, (err) => {
  console.warn('[drawer-subcat] subscription failed:', err);
  // Render with empty config so the static "all" + "sale" links still appear
  applyConfig({});
});
