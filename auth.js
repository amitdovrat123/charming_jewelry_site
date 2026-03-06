import { auth, db, googleProvider } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Google icon SVG ───────────────────────────────────────────
const GOOGLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.14 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.64-13.47-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

// ── Modal HTML template ───────────────────────────────────────
const MODAL_HTML = `
<div id="auth-overlay" class="auth-overlay" role="dialog" aria-modal="true" aria-label="כניסה למועדון Charming" aria-hidden="true">
  <div class="auth-modal" dir="rtl">

    <button class="auth-modal-close" id="auth-close" aria-label="סגור">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="auth-tabs" role="tablist">
      <button class="auth-tab auth-tab--active" data-tab="login"    role="tab" aria-selected="true">התחברות</button>
      <button class="auth-tab"                  data-tab="register" role="tab" aria-selected="false">הרשמה למועדון</button>
    </div>

    <!-- ── LOGIN PANEL ─────────────────────────────────────── -->
    <div class="auth-panel" id="auth-panel-login" role="tabpanel">
      <div class="auth-panel-header">
        <h2 class="auth-panel-title">ברוכה השבה ✨</h2>
        <p class="auth-panel-subtitle">התחברי לחשבון שלך</p>
      </div>
      <form id="form-login" novalidate>
        <div class="auth-field">
          <label for="login-email">דוא"ל</label>
          <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email" required />
        </div>
        <div class="auth-field">
          <label for="login-password">סיסמה</label>
          <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required />
        </div>
        <p class="auth-error" id="login-error" aria-live="polite"></p>
        <button type="submit" class="btn auth-submit-btn" id="login-submit">התחברות</button>
      </form>
      <div class="auth-divider"><span>או</span></div>
      <button class="auth-google-btn" id="google-login-btn" type="button">
        ${GOOGLE_ICON}
        <span>התחברות מהירה עם Google</span>
      </button>
    </div>

    <!-- ── REGISTER PANEL ──────────────────────────────────── -->
    <div class="auth-panel auth-panel--hidden" id="auth-panel-register" role="tabpanel">
      <div class="auth-panel-header">
        <h2 class="auth-panel-title">הצטרפי למועדון 💎</h2>
        <p class="auth-panel-subtitle">הרשמי וקבלי 10% הנחה על ההזמנה הראשונה</p>
      </div>
      <form id="form-register" novalidate>
        <div class="auth-fields-row">
          <div class="auth-field">
            <label for="reg-name">שם מלא</label>
            <input type="text" id="reg-name" placeholder="שם פרטי ושם משפחה" autocomplete="name" required />
          </div>
          <div class="auth-field">
            <label for="reg-phone">טלפון</label>
            <input type="tel" id="reg-phone" placeholder="05X-XXXXXXX" autocomplete="tel" />
          </div>
        </div>
        <div class="auth-field">
          <label for="reg-email">דוא"ל</label>
          <input type="email" id="reg-email" placeholder="your@email.com" autocomplete="email" required />
        </div>
        <div class="auth-field">
          <label for="reg-password">סיסמה</label>
          <input type="password" id="reg-password" placeholder="לפחות 6 תווים" autocomplete="new-password" required minlength="6" />
        </div>
        <div class="auth-checkboxes">
          <label class="auth-checkbox-label">
            <input type="checkbox" id="reg-newsletter" checked />
            <span class="auth-checkbox-text">אני מאשר/ת קבלת דיוור וחדשות מצ'ארמינג</span>
          </label>
          <label class="auth-checkbox-label">
            <input type="checkbox" id="reg-terms" />
            <span class="auth-checkbox-text">קראתי ואני מסכים/ה ל<a href="terms.html" target="_blank" rel="noopener">תקנון ומדיניות פרטיות</a></span>
          </label>
        </div>
        <p class="auth-error" id="reg-error" aria-live="polite"></p>
        <button type="submit" class="btn auth-submit-btn" id="reg-submit">הרשמה למועדון</button>
      </form>
      <div class="auth-divider"><span>או</span></div>
      <button class="auth-google-btn" id="google-reg-btn" type="button">
        ${GOOGLE_ICON}
        <span>הרשמה מהירה עם Google</span>
      </button>
    </div>

    <!-- ── SUCCESS PANEL ───────────────────────────────────── -->
    <div class="auth-panel auth-panel--hidden" id="auth-panel-success" role="tabpanel">
      <div class="auth-success">
        <div class="auth-success-icon">💖</div>
        <h2 class="auth-panel-title">ברוכה הבאה למועדון!</h2>
        <p class="auth-panel-subtitle">נרשמת בהצלחה. שמחים שהצטרפת אלינו.</p>
        <div class="auth-coupon">
          <p class="auth-coupon-label">קוד ה-10% הנחה הבלעדי שלך:</p>
          <div class="auth-coupon-code">CHARM10</div>
          <p class="auth-coupon-note">שמרי אותו — ניתן להזין בהזמנה הבאה שלך</p>
        </div>
        <button class="btn auth-submit-btn" id="auth-success-close" type="button">יאללה, בואי נקנה!</button>
      </div>
    </div>

  </div>
</div>`;

// ── State ─────────────────────────────────────────────────────
let isLoading    = false;
// When true, onAuthStateChanged will not auto-close the modal
// (used during registration and new Google sign-up so the success
// panel can remain visible).
let skipAutoClose = false;

// ── Helpers ───────────────────────────────────────────────────
function getErrorMsg(code) {
  const map = {
    'auth/email-already-in-use':   'כתובת הדוא"ל כבר רשומה. נסי להתחבר.',
    'auth/invalid-email':          'כתובת דוא"ל לא תקינה.',
    'auth/weak-password':          'הסיסמה חלשה מדי — נסי לפחות 6 תווים.',
    'auth/user-not-found':         'לא נמצא משתמש עם כתובת דוא"ל זו.',
    'auth/wrong-password':         'סיסמה שגויה. נסי שנית.',
    'auth/invalid-credential':     'פרטי ההתחברות שגויים. בדקי דוא"ל וסיסמה.',
    'auth/too-many-requests':      'יותר מדי ניסיונות. נסי שוב מאוחר יותר.',
    'auth/popup-closed-by-user':    '',
    'auth/cancelled-popup-request': '',
    'auth/popup-blocked':           'חלון הכניסה נחסם — אפשרי חלונות קופצים בדפדפן ונסי שוב.',
    'auth/operation-not-allowed':   'שיטת התחברות זו אינה מופעלת. אנא פני לתמיכה.',
    'auth/network-request-failed':  'שגיאת רשת. בדקי את החיבור ונסי שוב.',
  };
  return map[code] ?? 'אירעה שגיאה. נסי שנית.';
}

function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.orig = btn.textContent;
    btn.textContent  = 'רגע...';
  } else if (btn.dataset.orig) {
    btn.textContent = btn.dataset.orig;
  }
}

// ── Modal control ─────────────────────────────────────────────
function openModal(tab = 'login') {
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  switchTab(tab);
  setTimeout(() => {
    const first = overlay.querySelector('.auth-panel:not(.auth-panel--hidden) input');
    if (first) first.focus();
  }, 60);
}

function closeModal() {
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  skipAutoClose = false;
  document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; });
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('auth-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  ['login', 'register', 'success'].forEach(id => {
    const el = document.getElementById(`auth-panel-${id}`);
    if (el) el.classList.toggle('auth-panel--hidden', id !== tab);
  });
}

// ── Firestore ─────────────────────────────────────────────────
async function saveUserToFirestore(user, extras = {}) {
  await setDoc(doc(db, 'users', user.uid), {
    uid:               user.uid,
    name:              extras.name  ?? user.displayName ?? '',
    email:             user.email,
    phone:             extras.phone ?? '',
    isClubMember:      true,
    newsletterConsent: extras.newsletter !== false,
    joinedAt:          serverTimestamp(),
  });
}

async function userExistsInFirestore(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists();
}

// ── Register ──────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  if (isLoading) return;

  const errorEl    = document.getElementById('reg-error');
  const name       = document.getElementById('reg-name').value.trim();
  const email      = document.getElementById('reg-email').value.trim();
  const password   = document.getElementById('reg-password').value;
  const phone      = document.getElementById('reg-phone').value.trim();
  const newsletter = document.getElementById('reg-newsletter').checked;
  const termsOk    = document.getElementById('reg-terms').checked;

  if (!name)    { errorEl.textContent = 'יש להזין שם מלא.'; return; }
  if (!termsOk) { errorEl.textContent = 'יש לאשר את התקנון ומדיניות הפרטיות כדי להמשיך.'; return; }

  isLoading     = true;
  skipAutoClose = true;   // block onAuthStateChanged from closing modal
  errorEl.textContent = '';
  setBtnLoading('reg-submit', true);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await saveUserToFirestore(cred.user, { name, phone, newsletter });
    updateNavbar(cred.user);
    switchTab('success');
  } catch (err) {
    skipAutoClose = false;
    errorEl.textContent = getErrorMsg(err.code);
  } finally {
    isLoading = false;
    setBtnLoading('reg-submit', false);
  }
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  if (isLoading) return;

  const errorEl  = document.getElementById('login-error');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  isLoading = true;
  errorEl.textContent = '';
  setBtnLoading('login-submit', true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged fires → updateNavbar + closeModal
  } catch (err) {
    errorEl.textContent = getErrorMsg(err.code);
  } finally {
    isLoading = false;
    setBtnLoading('login-submit', false);
  }
}

// ── Google sign-in ────────────────────────────────────────────
// panelId: 'login' | 'reg'  (matches the error element IDs)
async function handleGoogleAuth(panelId) {
  if (isLoading) return;
  isLoading     = true;
  // Block onAuthStateChanged until we decide what to show
  skipAutoClose = true;
  const errorEl = document.getElementById(`${panelId}-error`);
  if (errorEl) errorEl.textContent = '';

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user   = result.user;
    const exists = await userExistsInFirestore(user.uid);

    if (!exists) {
      // New user — save profile and show success panel
      await saveUserToFirestore(user, { name: user.displayName, newsletter: true });
      updateNavbar(user);
      const overlay = document.getElementById('auth-overlay');
      if (overlay && !overlay.classList.contains('is-open')) {
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
      switchTab('success');
    } else {
      // Returning user — close modal normally
      skipAutoClose = false;
      closeModal();
    }
  } catch (err) {
    skipAutoClose = false;
    const msg = getErrorMsg(err.code);
    if (msg && errorEl) errorEl.textContent = msg;
  } finally {
    isLoading = false;
  }
}

// ── Navbar ────────────────────────────────────────────────────
function updateNavbar(user) {
  const navItem = document.getElementById('auth-nav-item');
  if (!navItem) return;

  if (user) {
    // Extract first name from displayName or email
    const first = (user.displayName || user.email || '')
      .split(' ')[0].split('@')[0];
    navItem.innerHTML = `
      <span class="auth-nav-user">
        שלום, <strong>${first}</strong>
        <button class="auth-nav-logout" id="auth-logout-btn" type="button">התנתק</button>
      </span>`;
    document.getElementById('auth-logout-btn')
      .addEventListener('click', () => signOut(auth));
  } else {
    navItem.innerHTML = `<a href="#" class="auth-nav-link" id="auth-nav-btn">התחברות / הרשמה</a>`;
    document.getElementById('auth-nav-btn')
      .addEventListener('click', e => {
        e.preventDefault();
        // Close mobile nav if open
        const navLinks  = document.querySelector('.nav-links');
        const hamburger = document.querySelector('.nav-hamburger');
        if (navLinks)  navLinks.classList.remove('is-open');
        if (hamburger) {
          hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
        openModal('login');
      });
  }
}

// ── Auth state observer ───────────────────────────────────────
onAuthStateChanged(auth, user => {
  updateNavbar(user);
  if (user && !skipAutoClose) closeModal();
});

// ── Event setup ───────────────────────────────────────────────
function setupEvents() {
  document.getElementById('auth-close')
    .addEventListener('click', closeModal);

  document.getElementById('auth-overlay')
    .addEventListener('click', e => { if (e.target.id === 'auth-overlay') closeModal(); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.querySelectorAll('.auth-tab')
    .forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  document.getElementById('form-login')
    .addEventListener('submit', handleLogin);
  document.getElementById('form-register')
    .addEventListener('submit', handleRegister);

  document.getElementById('google-login-btn')
    .addEventListener('click', () => handleGoogleAuth('login'));
  document.getElementById('google-reg-btn')
    .addEventListener('click', () => handleGoogleAuth('reg'));

  document.getElementById('auth-success-close')
    .addEventListener('click', closeModal);
}

// ── Boot (modules are deferred — DOM is ready here) ──────────
document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
setupEvents();
// Attach the modal-open click listener to the nav button immediately,
// without waiting for onAuthStateChanged (which is async).
// The observer will call updateNavbar again once Firebase resolves.
updateNavbar(null);
