import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Dynamic Testimonials from Firestore ──
const tstTrack = document.getElementById('testimonialsTrack');
if (tstTrack) {
  try {
    const tstCol = collection(db,'artifacts/charming-3dd6f/public/data/testimonials');
    const tstSnap = await getDocs(query(tstCol, orderBy('order','asc')));
    if (tstSnap.size > 0) {
      const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
      function tstOptimize(url) {
        if (url.includes('/upload/') && !url.includes('q_auto')) {
          return url.replace('/upload/', '/upload/q_auto,f_auto/');
        }
        return url;
      }
      const cards = tstSnap.docs.map(d => {
        const t = d.data();
        return '<div class="testimonial-card testimonial-card--img"><img src="' + esc(tstOptimize(t.url)) + '" alt="' + esc(t.name || 'המלצת לקוחה') + '" loading="lazy" decoding="async" /></div>';
      }).join('');
      tstTrack.innerHTML = cards + cards;
    }
  } catch(e) { console.warn('Testimonials load fallback to static:', e); }
}

const grid = document.getElementById('collage-grid');
if (grid) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const col = collection(db,'artifacts/charming-3dd6f/public/data/workshopGallery');

  function renderGallery(docs) {
    if (!docs.length) {
      grid.innerHTML = '<div class="collage-item" style="grid-column:1/-1;text-align:center;padding:60px 0;color:#9a8e8a;">\u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05D4\u05D5\u05E2\u05DC\u05D5 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05D2\u05DC\u05E8\u05D9\u05D4</div>';
      return;
    }
    grid.innerHTML = docs.map(d => {
      const img = d.data ? d.data() : d;
      const cls = img.layout === 'tall' ? ' collage-item--tall' : img.layout === 'wide' ? ' collage-item--wide' : '';
      return '<div class="collage-item' + cls + '"><img src="' + esc(img.url) + '" alt="' + esc(img.alt || '\u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05D4\u05E1\u05D3\u05E0\u05D4') + '" loading="lazy" decoding="async" /></div>';
    }).join('');
  }

  try {
    const snap = await getDocs(query(col, orderBy('order','asc')));
    renderGallery(snap.docs);
  } catch(e) {
    try {
      const snap = await getDocs(col);
      const sorted = snap.docs.sort((a,b) => (a.data().order||0) - (b.data().order||0));
      renderGallery(sorted);
    } catch(e2) {
      console.error('Gallery load failed:', e2);
      grid.innerHTML = '<div class="collage-item" style="grid-column:1/-1;text-align:center;padding:60px 0;color:#9a8e8a;">\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05D0\u05EA \u05D4\u05D2\u05DC\u05E8\u05D9\u05D4 \u05DB\u05E8\u05D2\u05E2</div>';
    }
  }
}
