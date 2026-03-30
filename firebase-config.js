/*
 * Firebase Client Config (public keys — protected by Firestore Security Rules).
 * No private keys or service-account credentials belong in this file.
 * See firestore.rules for access control.
 */
import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence }
                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider }
                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

const firebaseConfig = {
  apiKey:            'AIzaSyACTKkedUuHhYNOSBPsVxPV9YMM7agtILk',
  authDomain:        'charming-3dd6f.firebaseapp.com',
  projectId:         'charming-3dd6f',
  storageBucket:     'charming-3dd6f.firebasestorage.app',
  messagingSenderId: '13025110676',
  appId:             '1:13025110676:web:1cddc38b2d147e5e195001',
};

const app = initializeApp(firebaseConfig);

// ── App Check — blocks requests not from the real site ───────
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lew1ZssAAAAAAkFQcaMLzM3n7z458OdDT8UkOdt'),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);

// Persist auth state in localStorage/IndexedDB so page navigations
// never trigger a re-authentication prompt (FaceID / passkey).
export const authReady = setPersistence(auth, browserLocalPersistence);

export const db             = getFirestore(app);
export const googleProvider = (() => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
})();
