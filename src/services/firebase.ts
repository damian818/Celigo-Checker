import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// In AI Studio or deployed to Vercel, use ENV vars. 
// As a fallback for local AI Studio preview without .env, we can optionally fetch the config JSON,
// but for standard vite setup we rely on VITE_ variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCTu-wEAAM6zSLTz2IuV0uJhF0snUJNxYI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0872554321.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0872554321",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0872554321.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "738132454032",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:738132454032:web:9093130901cb59e9378615"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Provider with required Google Workspace Scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/chat.messages');
googleProvider.addScope('https://www.googleapis.com/auth/chat.spaces');

// Prompt specifically for @gappify.com Google Workspace domain accounts
googleProvider.setCustomParameters({
  hd: 'gappify.com',
  prompt: 'select_account'
});

export const ALLOWED_DOMAIN = 'gappify.com';

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

// Export types
export type { User };
