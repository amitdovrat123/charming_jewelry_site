import { db } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const BANNER_COL = 'artifacts/charming-3dd6f/public/data/bannerMessages';
const ROTATE_INTERVAL = 5000; // 5 seconds

let messages = [];
let currentIdx = 0;
let rotateTimer = null;

function getLangSafe() {
  return typeof window.getLang === 'function' ? window.getLang() : 'he';
}

function getMessageText(msg) {
  const lang = getLangSafe();
  if (lang === 'en' && msg.textEn) return msg.textEn;
  return msg.text;
}

function rotateBanner() {
  if (messages.length <= 1) return;

  const textEl = document.querySelector('.ticker-bar .announcement-text');
  if (!textEl) return;

  textEl.classList.add('fade-out');

  setTimeout(() => {
    currentIdx = (currentIdx + 1) % messages.length;
    textEl.textContent = getMessageText(messages[currentIdx]);
    textEl.classList.remove('fade-out');
  }, 500);
}

function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);
  if (messages.length > 1) {
    rotateTimer = setInterval(rotateBanner, ROTATE_INTERVAL);
  }
}

function applyMessages() {
  const textEl = document.querySelector('.ticker-bar .announcement-text');
  if (!textEl || messages.length === 0) return;
  currentIdx = 0;
  textEl.textContent = getMessageText(messages[0]);
  startRotation();
}

// Listen for real-time updates from Firestore
try {
  const q = query(collection(db, BANNER_COL), orderBy('order', 'asc'));
  onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false);
    if (docs.length > 0) {
      messages = docs;
      applyMessages();
    }
  }, err => {
    console.warn('[banner] Firestore listen failed, keeping default text.', err);
  });
} catch (e) {
  console.warn('[banner] Init failed:', e);
}

// Re-apply messages when language changes
const origSetLang = window.setLang;
if (origSetLang) {
  window.setLang = function(lang) {
    origSetLang(lang);
    if (messages.length > 0) {
      const textEl = document.querySelector('.ticker-bar .announcement-text');
      if (textEl) textEl.textContent = getMessageText(messages[currentIdx]);
    }
  };
}
