import { auth, isFirebaseConfigured } from '../firebase.js';
import db from '../models/db.js';

/**
 * Middleware to verify Firebase ID token and attach user to request
 *
 * Usage:
 *   router.get('/protected', authenticateFirebase, (req, res) => {
 *     console.log(req.user); // { id, firebase_uid, email, role }
 *   });
 */
export async function authenticateFirebase(req, res, next) {
  try {
    // Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Firebase authentication is not configured. Please configure Firebase credentials in the backend.'
      });
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided. Please include Authorization: Bearer <token> header.'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token with Firebase
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.'
        });
      }
      throw error;
    }

    const { uid, email } = decodedToken;

    // Find or create user in our database
    let result = await db.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [uid]
    );

    let user;

    if (result.rows.length === 0) {
      // First time user - create record
      console.log(`🆕 Creating new user: ${email} (Firebase UID: ${uid})`);

      result = await db.query(
        `INSERT INTO users (firebase_uid, email, role, password_hash)
         VALUES ($1, $2, 'customer', NULL)
         RETURNING *`,
        [uid, email]
      );
      user = result.rows[0];

      // Create customer profile for new user
      const customerResult = await db.query(
        `INSERT INTO customers (user_id, name, phone)
         VALUES ($1, $2, NULL)
         RETURNING *`,
        [user.id, email.split('@')[0]] // Use email prefix as default name
      );

      console.log(`✅ Created customer profile: ID ${customerResult.rows[0].id}`);
    } else {
      user = result.rows[0];
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      firebase_uid: uid,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);

    return res.status(403).json({
      error: 'Authentication failed',
      message: 'Invalid or malformed authentication token.'
    });
  }
}

/**
 * Optional authentication middleware
 * Allows requests with or without authentication
 * Useful for endpoints that have different behavior for logged-in users
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  return authenticateFirebase(req, res, next);
}

/**
 * Middleware to verify user has 'customer' role
 * Must be used after authenticateFirebase
 *
 * Usage:
 *   router.post('/shipments', authenticateFirebase, requireCustomer, handler);
 */
export function requireCustomer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'customer') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only accessible to customers'
    });
  }

  next();
}

/**
 * Middleware to verify user has 'driver' role
 * Must be used after authenticateFirebase
 *
 * Usage:
 *   router.get('/available-packages', authenticateFirebase, requireDriver, handler);
 */
export function requireDriver(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'driver') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only accessible to drivers'
    });
  }

  next();
}
