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
  const requiredFields = ['project_id', 'private_key', 'client_email'];
  for (const field of requiredFields) {
    if (!serviceAccount[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Ensure private_key is properly formatted
  if (serviceAccount.private_key.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  
  return serviceAccount;
}

async function initializeFirebase() {
  try {
    // Check time sync first
    await checkTimeSync();

    // Read service account file directly
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    console.log('Loading service account from:', serviceAccountPath);
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Firebase service account file not found');
    }

    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    let serviceAccount = JSON.parse(serviceAccountContent);

    // Validate and format service account
    serviceAccount = validateServiceAccount(serviceAccount);

    // Delete any existing apps
    admin.apps.forEach(app => {
      if (app) {
        app.delete();
      }
    });

    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin with project:', serviceAccount.project_id);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    // Test the initialization by getting the messaging service
    const messaging = app.messaging();
    console.log('Firebase Admin initialized successfully with messaging service');

    return app;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

let firebaseApp;

// Initialize Firebase and export the initialized app
initializeFirebase()
  .then(app => {
    firebaseApp = app;
    console.log('Firebase app exported successfully');
  })
  .catch(error => {
    console.error('Failed to initialize Firebase:', error);
    process.exit(1);
  });

// Export a function to get the messaging service
module.exports = {
  getMessaging: () => {
    if (!firebaseApp) {
      throw new Error('Firebase app not initialized');
    }
    return firebaseApp.messaging();
  }
}; 