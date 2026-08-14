import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyCBUgFuPVDdc9zk5Ck2GwPrNthMQirjvDo',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'anixihealth24.firebaseapp.com',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'anixihealth24',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'anixihealth24.appspot.com',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '639305017116',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:639305017116:web:b1c58263be5bb651457cd9',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
