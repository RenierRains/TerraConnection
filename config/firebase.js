const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Function to check time sync
async function checkTimeSync() {
  return new Promise((resolve, reject) => {
    https.get('https://www.google.com', (res) => {
      const serverTime = new Date(res.headers.date);
      const localTime = new Date();
      const timeDiff = Math.abs(serverTime - localTime);
      console.log('Server time:', serverTime.toISOString());
      console.log('Local time:', localTime.toISOString());
      console.log('Time difference:', timeDiff / 1000, 'seconds');
      
      // If time difference is more than 5 minutes, it might cause issues
      if (timeDiff > 300000) {
        reject(new Error(`Server time is out of sync by ${timeDiff / 1000} seconds`));
      } else {
        resolve();
      }
    }).on('error', reject);
  });
}

// Function to validate service account file
function validateServiceAccount(serviceAccount) {
  const requiredFields = ['project_id', 'private_key', 'client_email', 'client_id', 'type'];
  for (const field of requiredFields) {
    if (!serviceAccount[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate service account type
  if (serviceAccount.type !== 'service_account') {
    throw new Error('Invalid service account type. Must be "service_account"');
  }

  // Ensure private_key is properly formatted
  if (typeof serviceAccount.private_key !== 'string') {
    throw new Error('private_key must be a string');
  }

  // Replace \\n with actual newlines and ensure it starts with -----BEGIN PRIVATE KEY-----
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format');
  }

  // Validate client email format
  if (!serviceAccount.client_email.endsWith('.iam.gserviceaccount.com')) {
    throw new Error('Invalid client_email format');
  }

  console.log('Service account validation passed');
  return serviceAccount;
}

async function initializeFirebase() {
  try {
    // Check time sync first
    await checkTimeSync();

    // Read service account file
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    console.log('Loading service account from:', serviceAccountPath);
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Firebase service account file not found');
    }

    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    let serviceAccount;
    
    try {
      serviceAccount = JSON.parse(serviceAccountContent);
    } catch (e) {
      throw new Error('Invalid JSON in service account file: ' + e.message);
    }

    // Validate and format service account
    serviceAccount = validateServiceAccount(serviceAccount);

    // Delete any existing apps
    const apps = admin.apps;
    await Promise.all(apps.map(app => app ? app.delete() : null));

    // Initialize Firebase Admin with explicit databaseURL
    console.log('Initializing Firebase Admin with project:', serviceAccount.project_id);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    // Test the messaging service
    try {
      const messaging = app.messaging();
      await messaging.getMessagingConditions(); // Test the messaging service
      console.log('Firebase Messaging service test successful');
    } catch (error) {
      console.error('Firebase Messaging service test failed:', error);
      throw error;
    }

    console.log('Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

let firebaseApp = null;
let initializationPromise = null;

// Function to get or initialize Firebase app
async function getOrInitializeApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!initializationPromise) {
    initializationPromise = initializeFirebase()
      .then(app => {
        firebaseApp = app;
        console.log('Firebase app initialized successfully');
        return app;
      })
      .catch(error => {
        console.error('Failed to initialize Firebase:', error);
        initializationPromise = null; // Reset promise on failure
        throw error;
      });
  }

  return initializationPromise;
}

// Export functions to get Firebase services
module.exports = {
  getMessaging: async () => {
    const app = await getOrInitializeApp();
    return app.messaging();
  },
  reInitialize: async () => {
    if (firebaseApp) {
      await firebaseApp.delete();
    }
    firebaseApp = null;
    initializationPromise = null;
    return getOrInitializeApp();
  }
}; 