import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBeBjmVD-pkUueZapn65stLuwIc7rbCTik',
  authDomain: 'es11-5db8c.firebaseapp.com',
  databaseURL: 'https://es11-5db8c-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'es11-5db8c',
  storageBucket: 'es11-5db8c.firebasestorage.app',
  messagingSenderId: '740551885181',
  appId: '1:740551885181:web:e45f71f211ff20807f0c14',
  measurementId: 'G-PGPK7JNTS4',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const firebaseConfigured = true;
