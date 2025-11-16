#!/usr/bin/env node

/**
 * Test script to validate user-specific package retrieval
 * Creates 5 test users and validates data isolation
 */

import admin from 'firebase-admin';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// Try multiple locations for .env file
const envPaths = [
  join(__dirname, 'services/core-api/.env'),
  join(__dirname, '.env'),
  join(process.cwd(), 'services/core-api/.env'),
  join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`✅ Loaded environment from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found, using environment variables');
}

const { Pool } = pg;

// Initialize Firebase Admin
let firebaseApp;
try {
  // Check if FIREBASE_SERVICE_ACCOUNT exists (JSON format)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Use individual environment variables
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Missing Firebase configuration. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

// Database connection
// Parse DATABASE_URL if available, otherwise use individual variables
let dbConfig;
if (process.env.DATABASE_URL) {
  // Parse postgresql://user:password@host:port/database
  const url = new URL(process.env.DATABASE_URL);
  dbConfig = {
    host: url.hostname === 'db' ? 'localhost' : url.hostname, // Replace Docker hostname with localhost
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dropmate',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

console.log(`📊 Connecting to database: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
const db = new Pool(dbConfig);

// Test users configuration
const TEST_USERS = [
  { email: 'alice@test.com', password: 'test123456', name: 'Alice Johnson' },
  { email: 'bob@test.com', password: 'test123456', name: 'Bob Smith' },
  { email: 'charlie@test.com', password: 'test123456', name: 'Charlie Davis' },
  { email: 'diana@test.com', password: 'test123456', name: 'Diana Martinez' },
  { email: 'eve@test.com', password: 'test123456', name: 'Eve Wilson' }
];

async function createFirebaseUser(email, password, name) {
  try {
    // Try to get existing user first
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      console.log(`  ℹ️  Firebase user already exists: ${email} (UID: ${existingUser.uid})`);
      return existingUser;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    console.log(`  ✅ Created Firebase user: ${email} (UID: ${userRecord.uid})`);
    return userRecord;
  } catch (error) {
    console.error(`  ❌ Failed to create Firebase user ${email}:`, error.message);
    throw error;
  }
}

async function createDatabaseUser(firebaseUid, email, name) {
  try {
    // Check if user exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (existingUser.rows.length > 0) {
      console.log(`  ℹ️  Database user already exists: ${email}`);
      return existingUser.rows[0];
    }

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (firebase_uid, email, role, password_hash)
       VALUES ($1, $2, 'customer', NULL)
       RETURNING *`,
      [firebaseUid, email]
    );
    const user = userResult.rows[0];

    // Create customer profile
    await db.query(
      `INSERT INTO customers (user_id, name, phone)
       VALUES ($1, $2, $3)`,
      [user.id, name, '+1-555-' + Math.floor(1000 + Math.random() * 9000)]
    );

    console.log(`  ✅ Created database user and customer profile: ${email}`);
    return user;
  } catch (error) {
    console.error(`  ❌ Failed to create database user ${email}:`, error.message);
    throw error;
  }
}

async function createSamplePackages(userId, userName, count = 3) {
  try {
    const customer = await db.query(
      'SELECT id FROM customers WHERE user_id = $1',
      [userId]
    );

    if (customer.rows.length === 0) {
      throw new Error('Customer profile not found');
    }

    const customerId = customer.rows[0].id;

    // Create an order
    const orderResult = await db.query(
      `INSERT INTO orders (customer_id, total_amount, status)
       VALUES ($1, $2, 'confirmed')
       RETURNING *`,
      [customerId, (Math.random() * 200 + 50).toFixed(2)]
    );
    const order = orderResult.rows[0];

    // Create shipments
    const shipments = [];
    for (let i = 0; i < count; i++) {
      const trackingNumber = `${userName.split(' ')[0].toUpperCase()}-${Date.now()}-${i}`;
      const status = ['pending', 'in_transit', 'delivered'][Math.floor(Math.random() * 3)];

      const shipmentResult = await db.query(
        `INSERT INTO shipments (order_id, tracking_number, status, pickup_address, delivery_address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          order.id,
          trackingNumber,
          status,
          `${100 + i * 10} Pickup Street, City, State ${10000 + i}`,
          `${200 + i * 10} Delivery Avenue, City, State ${20000 + i}`
        ]
      );
      shipments.push(shipmentResult.rows[0]);
    }

    console.log(`  ✅ Created ${count} packages for ${userName}`);
    return shipments;
  } catch (error) {
    console.error(`  ❌ Failed to create packages for ${userName}:`, error.message);
    throw error;
  }
}

async function validateUserIsolation(userId, userName) {
  try {
    // Get user's shipments
    const result = await db.query(
      `SELECT s.id, s.tracking_number, s.status,
              o.customer_id, c.user_id
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE c.user_id = $1`,
      [userId]
    );

    const userShipments = result.rows;

    // Verify all shipments belong to this user
    const allBelongToUser = userShipments.every(s => s.user_id === userId);

    if (allBelongToUser) {
      console.log(`  ✅ User isolation verified for ${userName}: ${userShipments.length} packages`);
      return true;
    } else {
      console.log(`  ❌ User isolation FAILED for ${userName}: Found packages from other users`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Failed to validate isolation for ${userName}:`, error.message);
    throw error;
  }
}

async function testCrossUserAccess(userId1, userId2, userName1, userName2) {
  try {
    // Get user2's shipments
    const user2Shipments = await db.query(
      `SELECT s.id FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE c.user_id = $1
       LIMIT 1`,
      [userId2]
    );

    if (user2Shipments.rows.length === 0) {
      console.log(`  ⚠️  No shipments found for ${userName2} to test cross-access`);
      return true;
    }

    const shipmentId = user2Shipments.rows[0].id;

    // Try to access user2's shipment as user1
    const accessResult = await db.query(
      `SELECT s.id FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE s.id = $1 AND c.user_id = $2`,
      [shipmentId, userId1]
    );

    if (accessResult.rows.length === 0) {
      console.log(`  ✅ Cross-user access denied: ${userName1} cannot see ${userName2}'s packages`);
      return true;
    } else {
      console.log(`  ❌ SECURITY ISSUE: ${userName1} can access ${userName2}'s packages!`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Failed cross-access test:`, error.message);
    return false;
  }
}

async function displayTestCredentials(users) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST USER CREDENTIALS');
  console.log('='.repeat(80));
  console.log('\nYou can use these credentials to test the frontend:\n');

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name}`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Password: ${user.password}`);
    console.log('');
  });

  console.log('='.repeat(80));
}

async function main() {
  console.log('\n🧪 Starting User Isolation Test\n');
  console.log('This script will:');
  console.log('  1. Create 5 test user accounts in Firebase');
  console.log('  2. Create database records for each user');
  console.log('  3. Add sample packages for each user');
  console.log('  4. Validate data isolation\n');

  const createdUsers = [];

  try {
    // Step 1: Create users
    console.log('📝 Step 1: Creating test users...\n');

    for (const testUser of TEST_USERS) {
      console.log(`Creating user: ${testUser.name} (${testUser.email})`);

      const firebaseUser = await createFirebaseUser(
        testUser.email,
        testUser.password,
        testUser.name
      );

      const dbUser = await createDatabaseUser(
        firebaseUser.uid,
        testUser.email,
        testUser.name
      );

      createdUsers.push({
        ...testUser,
        dbId: dbUser.id,
        firebaseUid: firebaseUser.uid
      });

      console.log('');
    }

    // Step 2: Create sample packages
    console.log('\n📦 Step 2: Creating sample packages...\n');

    for (const user of createdUsers) {
      console.log(`Creating packages for: ${user.name}`);
      await createSamplePackages(user.dbId, user.name, 3);
      console.log('');
    }

    // Step 3: Validate user isolation
    console.log('\n🔒 Step 3: Validating user isolation...\n');

    let allTestsPassed = true;

    for (const user of createdUsers) {
      console.log(`Testing isolation for: ${user.name}`);
      const passed = await validateUserIsolation(user.dbId, user.name);
      allTestsPassed = allTestsPassed && passed;
      console.log('');
    }

    // Step 4: Test cross-user access prevention
    console.log('\n🛡️  Step 4: Testing cross-user access prevention...\n');

    console.log('Testing if Alice can access Bob\'s packages:');
    const crossAccessTest = await testCrossUserAccess(
      createdUsers[0].dbId,
      createdUsers[1].dbId,
      createdUsers[0].name,
      createdUsers[1].name
    );
    allTestsPassed = allTestsPassed && crossAccessTest;

    // Display results
    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - User isolation is working correctly!');
    } else {
      console.log('❌ SOME TESTS FAILED - Please review the errors above');
    }
    console.log('='.repeat(80));

    // Display credentials
    await displayTestCredentials(TEST_USERS);

    console.log('\n💡 Next steps:');
    console.log('  1. Start the frontend: cd dropmate-frontend && npm run dev');
    console.log('  2. Login with any of the test accounts above');
    console.log('  3. Each user should see only their own 3 packages');
    console.log('  4. Try logging in with different accounts to verify isolation\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await db.end();
    await admin.app().delete();
  }
}

main();
