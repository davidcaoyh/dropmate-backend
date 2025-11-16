import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseInitialized = false;

// Initialize Firebase Admin SDK
// Only initialize if credentials are provided
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error.message);
      firebaseInitialized = false;
    }
  }
} else {
  console.log('⚠️  Firebase credentials not configured');
  console.log('   Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  console.log('   See FIREBASE_SETUP.md for instructions');
}

export const auth = firebaseInitialized ? admin.auth() : null;
export const isFirebaseConfigured = () => firebaseInitialized;
export default admin;
