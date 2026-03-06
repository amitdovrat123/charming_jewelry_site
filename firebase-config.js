import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, OAuthProvider }
                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyACTKkedUuHhYNOSBPsVxPV9YMM7agtILk',
  authDomain:        'charming-3dd6f.firebaseapp.com',
  projectId:         'charming-3dd6f',
  storageBucket:     'charming-3dd6f.firebasestorage.app',
  messagingSenderId: '13025110676',
  appId:             '1:13025110676:web:1cddc38b2d147e5e195001',
  measurementId:     'G-MBC09YG3HY',
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = (() => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
})();

export const appleProvider = (() => {
  const p = new OAuthProvider('apple.com');
  p.addScope('email');
  p.addScope('name');
  return p;
})();
