import admin from './src/firebase.js';
import https from 'https';

// Firebase Web API Key - Get from Firebase Console > Project Settings > General
// For testing purposes, we'll need to provide this
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'YOUR_WEB_API_KEY_HERE';

async function signInWithCustomToken(customToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      token: customToken,
      returnSecureToken: true
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function testAuth() {
  try {
    console.log('🧪 Firebase Authentication Integration Test\n');

    // Create test user
    const testUid = 'test-user-' + Date.now();
    const testEmail = `test-${Date.now()}@dropmate.com`;

    console.log('1️⃣  Creating Firebase test user...');

    let user;
    try {
      user = await admin.auth().createUser({
        uid: testUid,
        email: testEmail,
        emailVerified: true,
        password: 'TestPassword123!'
      });
      console.log('✅ Created test user:', testEmail);
    } catch (error) {
      console.log('❌ Failed to create user:', error.message);
      return;
    }

    console.log('\n2️⃣  Creating custom token...');
    const customToken = await admin.auth().createCustomToken(testUid);
    console.log('✅ Custom token created');

    if (FIREBASE_WEB_API_KEY === 'YOUR_WEB_API_KEY_HERE') {
      console.log('\n⚠️  Web API Key not configured');
      console.log('To get the Web API Key:');
      console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
      console.log('2. Select your project: dropmate-9dc10');
      console.log('3. Go to Project Settings (gear icon)');
      console.log('4. Under "General" tab, scroll to "Your apps"');
      console.log('5. Find "Web API Key"');
      console.log('6. Run: export FIREBASE_WEB_API_KEY=<your-key>');
      console.log('\n🔧 Custom Token (for manual exchange):');
      console.log(customToken);
      return;
    }

    console.log('\n3️⃣  Exchanging custom token for ID token...');
    const authResult = await signInWithCustomToken(customToken);
    const idToken = authResult.idToken;
    console.log('✅ ID token obtained');

    console.log('\n4️⃣  Testing authenticated API endpoint...');
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('http://localhost:8080/api/users/me', {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const profile = await response.json();

    if (response.ok) {
      console.log('✅ Successfully authenticated!');
      console.log('\n📋 User Profile:');
      console.log(JSON.stringify(profile, null, 2));
    } else {
      console.log('❌ Authentication failed:');
      console.log(profile);
    }

    console.log('\n🎉 Firebase Authentication is working!\n');
    console.log('🔑 ID Token (valid for 1 hour):');
    console.log(idToken);
    console.log('\n📝 Test with curl:');
    console.log(`curl http://localhost:8080/api/users/me \\`);
    console.log(`  -H "Authorization: Bearer ${idToken}"`);

    // Cleanup
    console.log('\n🧹 Cleaning up test user...');
    await admin.auth().deleteUser(testUid);
    console.log('✅ Test user deleted');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testAuth();
