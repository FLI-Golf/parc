import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function testLogin() {
  try {
    console.log('Testing login with marie.rousseau@parcbistro.com...');
    
    // Test with temp123
    const authData = await pb.collection('users').authWithPassword(
      'marie.rousseau@parcbistro.com', 
      'temp123'
    );
    
    console.log('✅ Login successful!');
    console.log('User ID:', authData.record.id);
    console.log('User role:', authData.record.role);
    console.log('User name:', authData.record.name);
    
  } catch (error) {
    console.log('❌ Login failed:', error.message);
    
    // Try to list users to see what exists
    try {
      await pb.admins.authWithPassword('admin@parcbistro.com', 'parcmanager123');
      console.log('\n🔍 Checking existing users...');
      
      const users = await pb.collection('users').getList(1, 50, {
        filter: 'email ~ "parcbistro"'
      });
      
      console.log('Found users:');
      users.items.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ID: ${user.id}`);
      });
      
    } catch (adminError) {
      console.log('❌ Admin auth failed:', adminError.message);
    }
  }
}

testLogin();
