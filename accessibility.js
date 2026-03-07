// accessibility.js — Standalone Accessibility Widget
// Israeli Standard 5568 / WCAG 2.0 AA — 16 features in 4 sections

const A11Y_SECTIONS = [
  {
    key: 'text', label: 'טקסט',
    features: [
      { key: 'text-larger',    label: 'הגדלת טקסט',   icon: 'A+' },
      { key: 'text-smaller',   label: 'הקטנת טקסט',   icon: 'A−' },
      { key: 'line-height',    label: 'ריווח שורות',  icon: '↕'  },
      { key: 'letter-spacing', label: 'ריווח אותיות', icon: 'A↔' },
      { key: 'readable-font',  label: 'פונט קריא',    icon: 'Aa' },
    ],
  },
  {
    key: 'visual', label: 'ויזואלי',
    features: [
      { key: 'grayscale',         label: 'גווני אפור',     icon: '◑' },
      { key: 'high-contrast',     label: 'ניגודיות גבוהה', icon: '◐' },
      { key: 'negative-contrast', label: 'ניגודיות הפוכה', icon: '●' },
      { key: 'light-background',  label: 'רקע בהיר',       icon: '☀' },
      { key: 'pause-animations',  label: 'עצירת אנימציות', icon: '⏸' },
    ],
  },
  {
    key: 'markers', label: 'סמנים',
    features: [
      { key: 'highlight-links',    label: 'הדגשת קישורים', icon: '🔗' },
      { key: 'highlight-headings', label: 'הדגשת כותרות',  icon: 'H'  },
    ],
  },
  {
    key: 'helpers', label: 'עזרים',
    features: [
      { key: 'big-cursor-white', label: 'סמן לבן גדול',  icon: '➤' },
      { key: 'big-cursor-black', label: 'סמן שחור גדול', icon: '➤' },
      { key: 'reading-guide',    label: 'קו קריאה',       icon: '━' },
      { key: 'reading-mask',     label: 'מסיכת קריאה',    icon: '▬' },
    ],
  },
];

const MUTEX_GROUPS = [
  ['text-larger', 'text-smaller'],
  ['grayscale', 'high-contrast', 'negative-contrast', 'light-background'],
  ['big-cursor-white', 'big-cursor-black'],
];

// Keys applied to <body>, not #main-wrapper, to avoid CSS filter/fixed-position bugs
const BODY_KEYS = new Set(['pause-animations', 'big-cursor-white', 'big-cursor-black']);

const ALL_FEATURES = A11Y_SECTIONS.flatMap(s => s.features);

function getTarget(key) {
  return BODY_KEYS.has(key)
    ? document.body
    : (document.getElementById('main-wrapper') || document.body);
}

function getSettings() {
  return JSON.parse(localStorage.getItem('a11y-settings') || '{}');
}

function saveSettings(settings) {
  localStorage.setItem('a11y-settings', JSON.stringify(settings));
}

function applyTextScale(settings) {
  if (settings['text-larger'])       document.documentElement.style.fontSize = '112%';
  else if (settings['text-smaller']) document.documentElement.style.fontSize = '88%';
  else                               document.documentElement.style.fontSize = '';
}

// ── Reading guide (fixed horizontal line follows cursor) ─────────────────

let readingGuideEl = null;

function onMoveGuide(e) { if (readingGuideEl) readingGuideEl.style.top = e.clientY + 'px'; }

function createReadingGuide() {
  if (readingGuideEl) return;
  readingGuideEl = document.createElement('div');
  readingGuideEl.id = 'a11y-reading-guide';
  document.body.appendChild(readingGuideEl);
  document.addEventListener('mousemove', onMoveGuide);
}

function destroyReadingGuide() {
  if (!readingGuideEl) return;
  document.removeEventListener('mousemove', onMoveGuide);
  readingGuideEl.remove();
  readingGuideEl = null;
}

// ── Reading mask (two panels dim content above/below a reading band) ──────

let maskTop = null, maskBottom = null;

function onMoveMask(e) {
  const band = 60, y = e.clientY;
  if (maskTop)    { maskTop.style.top = '0'; maskTop.style.height = Math.max(0, y - band) + 'px'; }
  if (maskBottom) { maskBottom.style.top = (y + band) + 'px'; maskBottom.style.height = Math.max(0, window.innerHeight - y - band) + 'px'; }
}

function createReadingMask() {
  if (maskTop) return;
  maskTop    = document.createElement('div');
  maskBottom = document.createElement('div');
  maskTop.className = maskBottom.className = 'a11y-reading-mask-panel';
  document.body.appendChild(maskTop);
  document.body.appendChild(maskBottom);
  document.addEventListener('mousemove', onMoveMask);
  onMoveMask({ clientY: window.innerHeight / 2 });
}

function destroyReadingMask() {
  if (!maskTop) return;
  document.removeEventListener('mousemove', onMoveMask);
  maskTop.remove();    maskTop    = null;
  maskBottom.remove(); maskBottom = null;
}

function handleHelperEffect(key, isActive) {
  if      (key === 'reading-guide') isActive ? createReadingGuide() : destroyReadingGuide();
  else if (key === 'reading-mask')  isActive ? createReadingMask()  : destroyReadingMask();
}

// ── Feature activation ────────────────────────────────────────────────────

function applyFeature(key, isActive) {
  if (isActive) {
    for (const group of MUTEX_GROUPS) {
      if (!group.includes(key)) continue;
      group.filter(k => k !== key).forEach(k => {
        getTarget(k).classList.remove('a11y-' + k);
        handleHelperEffect(k, false);
        const b = document.querySelector(`[data-a11y="${k}"]`);
        if (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }
      });
      break;
    }
  }
  getTarget(key).classList.toggle('a11y-' + key, isActive);
  handleHelperEffect(key, isActive);
  const settings = getSettings();
  settings[key] = isActive;
  saveSettings(settings);
  if (key === 'text-larger' || key === 'text-smaller') applyTextScale(settings);
}

function restoreSettings() {
  const saved = getSettings();
  ALL_FEATURES.forEach(f => {
    if (!saved[f.key]) return;
    getTarget(f.key).classList.add('a11y-' + f.key);
    handleHelperEffect(f.key, true);
  });
  applyTextScale(saved);
}

// ── HTML building ─────────────────────────────────────────────────────────

const A11Y_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M256 48a208 208 0 1 1 0 416A208 208 0 0 1 256 48zm0-48C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm0 128a48 48 0 1 0 0-96 48 48 0 0 0 0 96zm-32 32c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32h8v80c0 13.3 10.7 24 24 24s24-10.7 24-24v-80h8v80c0 13.3 10.7 24 24 24s24-10.7 24-24v-80h8c17.7 0 32-14.3 32-32V240c0-17.7-14.3-32-32-32H224z"/></svg>`;

function buildMenuHTML(saved) {
  return A11Y_SECTIONS.map(section => `
    <div class="a11y-section">
      <div class="a11y-section-label">${section.label}</div>
      <div class="a11y-section-grid">
        ${section.features.map(f => `
          <button class="a11y-btn${saved[f.key] ? ' active' : ''}"
            data-a11y="${f.key}"
            aria-pressed="${saved[f.key] ? 'true' : 'false'}"
            type="button">
            <span class="a11y-btn-icon" aria-hidden="true">${f.icon}</span>
            <span class="a11y-btn-label">${f.label}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
}

// ── Widget injection ──────────────────────────────────────────────────────

function injectWidget() {
  const saved = getSettings();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="a11y-widget" dir="rtl">
      <button id="a11y-toggle"
        aria-label="פתחי תפריט נגישות"
        aria-expanded="false"
        aria-controls="a11y-menu"
        aria-haspopup="dialog">
        ${A11Y_ICON}
      </button>
      <div id="a11y-menu"
        role="dialog"
        aria-labelledby="a11y-dialog-title"
        aria-hidden="true"
        hidden>
        <div class="a11y-header">
          <h3 class="a11y-title" id="a11y-dialog-title">הגדרות נגישות</h3>
          <button id="a11y-close" aria-label="סגרי תפריט נגישות">×</button>
        </div>
        <div class="a11y-body">
          ${buildMenuHTML(saved)}
        </div>
        <div class="a11y-footer">
          <button id="a11y-reset" type="button">איפוס הכל</button>
          <button id="a11y-statement-btn" type="button">הצהרת נגישות</button>
        </div>
      </div>
    </div>`);

  const toggle = document.getElementById('a11y-toggle');
  const menu   = document.getElementById('a11y-menu');
  const close  = document.getElementById('a11y-close');

  function openMenu() {
    menu.hidden = false;
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    close.focus();
  }

  function closeMenu() {
    menu.hidden = true;
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
  close.addEventListener('click',  closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });

  // Focus trap
  menu.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('button, a[href]')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  });

  // Feature toggles
  menu.querySelectorAll('.a11y-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key      = btn.dataset.a11y;
      const isActive = !btn.classList.contains('active');
      applyFeature(key, isActive);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  });

  // Reset all
  document.getElementById('a11y-reset').addEventListener('click', () => {
    const mw = document.getElementById('main-wrapper') || document.body;
    ALL_FEATURES.forEach(f => {
      mw.classList.remove('a11y-' + f.key);
      document.body.classList.remove('a11y-' + f.key);
      handleHelperEffect(f.key, false);
      const btn = menu.querySelector(`[data-a11y="${f.key}"]`);
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
    });
    document.documentElement.style.fontSize = '';
    localStorage.removeItem('a11y-settings');
  });

  // Accessibility statement
  document.getElementById('a11y-statement-btn').addEventListener('click', () => {
    closeMenu();
    showStatement();
  });
}

// ── Accessibility Statement modal ─────────────────────────────────────────

function showStatement() {
  let modal = document.getElementById('a11y-statement-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'a11y-statement-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'הצהרת נגישות');
    modal.setAttribute('dir', 'rtl');
    modal.innerHTML = `
      <div class="a11y-statement-overlay"></div>
      <div class="a11y-statement-content">
        <button class="a11y-statement-close" aria-label="סגרי הצהרת נגישות" type="button">×</button>
        <h2 style="font-size:1.3rem;font-weight:700;color:var(--ink);margin:0 0 16px;">הצהרת נגישות</h2>
        <p style="color:var(--ink-soft);line-height:1.75;font-size:0.9rem;margin:0 0 10px;">
          אתר <strong>Charming by Vik</strong> מחויב לנגישות דיגיטלית לאנשים עם מוגבלויות.
          אנו פועלים בהתאם לתקן הישראלי 5568 ולהנחיות WCAG 2.0 ברמה AA.
        </p>
        <p style="color:var(--ink-soft);line-height:1.75;font-size:0.9rem;margin:0 0 10px;">
          האתר כולל: ניווט מקלדת מלא, תגיות ARIA לקוראי מסך, יחס ניגודיות עומד בתקן, ואפשרויות נגישות מתכווננות.
        </p>
        <p style="color:var(--ink-soft);line-height:1.75;font-size:0.9rem;margin:0;">
          לפרטים ולדיווח על בעיות נגישות:
          <a href="mailto:charming.by.vik@gmail.com" style="color:var(--pink-deep);">charming.by.vik@gmail.com</a>
        </p>
      </div>`;
    document.body.appendChild(modal);
    const closeStmt = () => { modal.hidden = true; document.body.style.overflow = ''; };
    modal.querySelector('.a11y-statement-overlay').addEventListener('click', closeStmt);
    modal.querySelector('.a11y-statement-close').addEventListener('click',   closeStmt);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeStmt(); });
  }
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('.a11y-statement-close').focus();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
restoreSettings();
injectWidget();
