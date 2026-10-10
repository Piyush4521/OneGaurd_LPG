import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDxVscsFYARHNjiwc9_BPBee44MUoji67k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "onegaurd-e63c0.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "onegaurd-e63c0",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "onegaurd-e63c0.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "336935929403",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:336935929403:web:5add4932a2bfb7f1b53e1e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SF2QEKN3BL",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://onegaurd-e63c0-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Primary user assigned to this Firebase instance
export const FIREBASE_ADMIN_EMAIL = "piyushsonawane.nbnscoe.entc@gmail.com";

// Initialize Firebase App singleton
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Optional Analytics initialization (runs safely only in browser environments)
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
    }
  }).catch(() => {
    // Analytics fallback in non-supported environments
  });
}

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const realtimeDb = getDatabase(firebaseApp);

export default firebaseApp;
