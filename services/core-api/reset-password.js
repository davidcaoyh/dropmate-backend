import admin from './src/firebase.js';

async function resetDriverPassword() {
  try {
    console.log('🔐 Resetting password for driver1@dropmate.com...\n');

    const email = 'driver1@dropmate.com';
    const newPassword = 'Driver123!';
    const uid = 'E1HNj7WnkveIGqqgwlUTHZI6Jc52';

    // Update the user's password
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    console.log('✅ Password reset successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', newPassword);
    console.log('🆔 Firebase UID:', uid);
    console.log('\n💡 You can now login with these credentials');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }

  process.exit(0);
}

resetDriverPassword();
