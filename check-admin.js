import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function checkAdmin() {
  console.log('🔍 Checking PocketBase admin status...\n');
  
  // Try common admin credentials
  const adminCredentials = [
    { email: 'admin@parcbistro.com', password: 'parcmanager123' },
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'admin@admin.com', password: 'password123' },
    { email: 'test@test.com', password: 'test123' }
  ];
  
  for (const cred of adminCredentials) {
    try {
      console.log(`Trying: ${cred.email}...`);
      await pb.admins.authWithPassword(cred.email, cred.password);
      console.log(`✅ Admin login successful with: ${cred.email}`);
      
      // Try to list users
      try {
        const users = await pb.collection('users').getList(1, 5);
        console.log(`📊 Found ${users.totalItems} users in database`);
        users.items.forEach(user => {
          console.log(`  - ${user.email} (${user.role || 'no role'})`);
        });
      } catch (userError) {
        console.log('❌ Could not list users:', userError.message);
      }
      
      return true;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n🚨 No admin access found. You may need to:');
  console.log('1. Access PocketBase admin panel directly');
  console.log('2. Reset the PocketBase instance');
  console.log('3. Check Railway/Fly.io console for admin setup');
  
  return false;
}

checkAdmin();
