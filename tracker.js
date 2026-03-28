// tracker.js — Lightweight site-wide event tracking for analytics
// Include on every page: <script type="module" src="tracker.js"></script>

import { db } from './firebase-config.js';
import {
  collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth } from './firebase-config.js';

const TRAFFIC_COL = 'artifacts/charming-3dd6f/public/data/site_traffic';

// ── Session ID (persists per tab session) ────────────────────
const _sid = sessionStorage.getItem('charming_sid') || crypto.randomUUID();
sessionStorage.setItem('charming_sid', _sid);

function _detectDevice() {
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

function _detectSource() {
  const params = new URLSearchParams(window.location.search);
  const utm = params.get('utm_source');
  if (utm) return utm;
  const ref = document.referrer;
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace('www.', '');
    if (host.includes('google'))    return 'google';
    if (host.includes('facebook') || host.includes('fb')) return 'facebook';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('tiktok'))    return 'tiktok';
    return host;
  } catch { return 'direct'; }
}

// ── Page name from pathname ──────────────────────────────────
function _pageName() {
  const p = window.location.pathname;
  if (p.endsWith('shop.html'))      return 'shop';
  if (p.endsWith('workshops.html')) return 'workshops';
  if (p.endsWith('legal.html'))     return 'legal';
  if (p.endsWith('terms.html'))     return 'terms';
  if (p.endsWith('admin.html'))     return 'admin';
  return 'home';
}

// ── Rate limiting — max events per session ──────────────────
const MAX_EVENTS_PER_SESSION = 200;
let _eventCount = 0;

/**
 * Fire-and-forget event tracking (rate-limited).
 * @param {string} event  - Event name (page_view, add_to_cart, etc.)
 * @param {object} meta   - Additional metadata
 */
export function trackEvent(event, meta = {}) {
  if (++_eventCount > MAX_EVENTS_PER_SESSION) return;
  addDoc(collection(db, TRAFFIC_COL), {
    sessionId: _sid,
    event,
    page: meta.view || meta.page || _pageName(),
    referrer: document.referrer || '',
    source: _detectSource(),
    device: _detectDevice(),
    screenW: window.innerWidth,
    uid: auth.currentUser?.uid || null,
    meta,
    timestamp: serverTimestamp(),
  }).catch(() => {});
}

// ── Auto page-view on load ───────────────────────────────────
trackEvent('page_view', { page: _pageName() });

// ── Session ping every 30s ───────────────────────────────────
setInterval(() => trackEvent('session_ping'), 30000);
