import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
    apiKey: "AIzaSyCYoYG2JORKHp6Q3F9ougrE5OqUvnquu2o",
    authDomain: "anixihealth24.firebaseapp.com",
    projectId: "anixihealth24",
    storageBucket: "anixihealth24.appspot.com",
    messagingSenderId: "639305017116",
    appId: "1:639305017116:ios:f5a80456365c03d5457cd9"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
