import PocketBase from 'pocketbase';
import fs from 'fs';
import csv from 'csv-parser';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function setupTestEnvironment() {
  console.log('🚀 Setting up test environment...\n');
  
  // Step 1: Create admin account
  try {
    console.log('1️⃣ Creating admin account...');
    await pb.admins.create({
      email: 'admin@parcbistro.com',
      password: 'parcmanager123'
    });
    console.log('✅ Admin created successfully');
  } catch (error) {
    if (error.message.includes('already exists') || error.status === 400) {
      console.log('ℹ️  Admin already exists, continuing...');
    } else {
      console.log('❌ Admin creation failed:', error.message);
      return;
    }
  }
  
  // Step 2: Login as admin
  try {
    console.log('\n2️⃣ Logging in as admin...');
    await pb.admins.authWithPassword('admin@parcbistro.com', 'parcmanager123');
    console.log('✅ Admin login successful');
  } catch (error) {
    console.log('❌ Admin login failed:', error.message);
    return;
  }
  
  // Step 3: Create staff users
  console.log('\n3️⃣ Creating staff users...');
  const staffData = [];
  
  fs.createReadStream('static/sample-data/staff.csv')
    .pipe(csv())
    .on('data', (data) => staffData.push(data))
    .on('end', async () => {
      
      for (const staff of staffData) {
        try {
          const userData = {
            id: staff.user_id, // Use the existing ID
            email: staff.email,
            password: 'temp123',
            passwordConfirm: 'temp123',
            name: `${staff.first_name} ${staff.last_name}`,
            role: staff.position === 'manager' ? 'Manager' : 'Server'
          };
          
          // Try to create user with specific ID
          const user = await pb.collection('users').create(userData);
          console.log(`✅ Created: ${staff.first_name} ${staff.last_name} (${staff.position})`);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`ℹ️  ${staff.first_name} ${staff.last_name} already exists`);
          } else {
            console.log(`❌ Failed to create ${staff.first_name} ${staff.last_name}:`, error.message);
          }
        }
      }
      
      console.log('\n🎯 Test user credentials:');
      console.log('📧 marie.rousseau@parcbistro.com / temp123 (Server)');
      console.log('📧 pierre.dubois@parcbistro.com / temp123 (Manager)');
      console.log('\n✅ Test environment setup complete!');
      
      // Step 4: Test login
      console.log('\n4️⃣ Testing server login...');
      try {
        const testAuth = await pb.collection('users').authWithPassword(
          'marie.rousseau@parcbistro.com', 
          'temp123'
        );
        console.log(`✅ Test login successful! User: ${testAuth.record.name} (${testAuth.record.role})`);
      } catch (error) {
        console.log('❌ Test login failed:', error.message);
      }
    });
}

setupTestEnvironment();
