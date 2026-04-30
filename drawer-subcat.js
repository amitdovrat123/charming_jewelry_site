// Dynamically populates the side drawer's sub-category lists from Firestore products.
// For each main category, finds unique `collection` values across published products
// and inserts them as links into the matching <ul.nav-sublist>.

import { db } from './firebase-config.js';
import {
  collection, query, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const COL_PATH = 'artifacts/charming-3dd6f/public/data/products';

function findExpandableForCategory(catName) {
  const buttons = document.querySelectorAll('.nav-expand-btn');
  for (const btn of buttons) {
    const span = btn.querySelector('span');
    if (span && span.textContent.trim() === catName) {
      return btn.parentElement;
    }
  }
  return null;
}

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

const q = query(collection(db, COL_PATH));
onSnapshot(q, (snap) => {
  const subsByCat = new Map();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.status !== 'published') return;
    const cat = d.category;
    const sub = (d.collection || '').trim();
    if (!cat || !sub) return;
    if (!subsByCat.has(cat)) subsByCat.set(cat, new Set());
    subsByCat.get(cat).add(sub);
  });

  document.querySelectorAll('.nav-item-expandable').forEach(li => {
    const span = li.querySelector('.nav-expand-btn span');
    if (!span) return;
    const catName = span.textContent.trim();
    const subs = [...(subsByCat.get(catName) || [])].sort();
    renderSublist(li, catName, subs);
  });
}, (err) => {
  console.warn('[drawer-subcat] Firestore subscription failed:', err);
});
