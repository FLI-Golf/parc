import PocketBase from 'pocketbase';
import fs from 'fs';

// Initialize PocketBase client with your Fly.io instance URL
const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function importCollections() {
  try {
    // Read the sample collections JSON file
    const collectionsData = JSON.parse(fs.readFileSync('./sample_collections.json', 'utf8'));
    
    console.log('Collections to import:', collectionsData.length);
    
    // Note: We can't authenticate as admin without credentials
    // For now, let's just try to create a user directly to see if the collection exists
    
    // Test data for creating a new user
    const userData = {
      name: "Test User",
      email: "test@example.com",
      emailVisibility: true,
      password: "securePassword123!",
      passwordConfirm: "securePassword123!"
    };

    // Try to create user
    const record = await pb.collection('users').create(userData);
    console.log('User created successfully:', record);
  } catch (error) {
    console.error('Error importing collections or creating user:', error);
    
    // Check if it's a collection not found error
    if (error.status === 404) {
      console.log('Collection not found. You may need to import the collections first.');
      console.log('Please visit the admin panel at https://pocketbase-production-7050.up.railway.app/_/ to import collections.');
    }
  }
}

importCollections();