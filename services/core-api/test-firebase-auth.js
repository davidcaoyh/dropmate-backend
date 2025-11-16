import admin from './src/firebase.js';

async function testFirebaseAuth() {
  try {
    console.log('🧪 Firebase Authentication Test\n');

    // Create a test user
    const testEmail = 'test@dropmate.com';
    const testUid = 'test-user-123';

    console.log('1️⃣  Creating custom token for test user...');
    const customToken = await admin.auth().createCustomToken(testUid, {
      email: testEmail
    });
    console.log('✅ Custom token created:', customToken.substring(0, 50) + '...\n');

    console.log('📝 To test the API:');
    console.log('--------------------------------------------------');
    console.log('1. First, exchange the custom token for an ID token:');
    console.log('\nYou need the Firebase Web API Key from Firebase Console.');
    console.log('Then run:');
    console.log(`
curl -X POST \\
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=YOUR_WEB_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "token": "${customToken}",
    "returnSecureToken": true
  }'
    `);

    console.log('\n2. OR, for quick testing, create a user directly:');
    console.log('--------------------------------------------------');

    // Try to get or create user
    let user;
    try {
      user = await admin.auth().getUser(testUid);
      console.log('✅ Test user already exists:', testUid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        user = await admin.auth().createUser({
          uid: testUid,
          email: testEmail,
          emailVerified: true,
          password: 'TestPassword123!'
        });
        console.log('✅ Created new test user:', testUid);
      } else {
        throw error;
      }
    }

    // Create a custom token that can be used
    const idToken = await admin.auth().createCustomToken(testUid);

    console.log('\n3. Test API endpoints:');
    console.log('--------------------------------------------------');
    console.log(`Custom Token (use this to sign in via Firebase Client SDK):`);
    console.log(customToken);
    console.log('\nFor direct backend testing, you would need an ID token from Firebase Auth.');
    console.log('\n📚 See FIREBASE_SETUP.md for complete integration guide.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testFirebaseAuth();
