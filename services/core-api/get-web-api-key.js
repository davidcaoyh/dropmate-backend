import admin from './src/firebase.js';
import https from 'https';

async function getProjectConfig() {
  const projectId = 'dropmate-9dc10';

  // Get access token from Firebase Admin
  const accessToken = await admin.credential.applicationDefault().getAccessToken();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebase.googleapis.com',
      path: `/v1beta1/projects/${projectId}/webApps`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const apps = JSON.parse(data);
          console.log('Web Apps:', apps);

          if (apps.apps && apps.apps.length > 0) {
            // Get config for the first app
            const appId = apps.apps[0].appId;
            getWebAppConfig(appId, accessToken.access_token)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('No web apps found. Create one in Firebase Console.'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getWebAppConfig(appId, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebase.googleapis.com',
      path: `/v1beta1/${appId}/config`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const config = JSON.parse(data);
          resolve(config);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔍 Fetching Firebase Web API Key...\n');
    const config = await getProjectConfig();
    console.log('\n📋 Firebase Web Config:');
    console.log(JSON.stringify(config, null, 2));

    if (config.apiKey) {
      console.log('\n🔑 Web API Key:', config.apiKey);
      console.log('\n💡 To run the full test:');
      console.log(`export FIREBASE_WEB_API_KEY="${config.apiKey}"`);
      console.log('node get-test-token.js');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Alternative: Get API key manually from Firebase Console');
    console.log('https://console.firebase.google.com/project/dropmate-9dc10/settings/general');
  }
}

main();
