import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function testAuthentication() {
  console.log('🧪 Testing authentication with existing users...\n');
  
  // Test Marie Rousseau (Server)
  try {
    console.log('Testing Marie Rousseau (Server)...');
    const authData = await pb.collection('users').authWithPassword(
      'marie.rousseau@parcbistro.com', 
      'temp123'
    );
    console.log('✅ Marie login successful!');
    console.log(`   Role: ${authData.record.role}`);
    console.log(`   ID: ${authData.record.id}`);
    console.log(`   Name: ${authData.record.name}`);
  } catch (error) {
    console.log('❌ Marie login failed:', error.message);
  }
  
  // Test Pierre Dubois (Manager)
  try {
    console.log('\nTesting Pierre Dubois (Manager)...');
    const authData = await pb.collection('users').authWithPassword(
      'pierre.dubois@parcbistro.com', 
      'temp123'
    );
    console.log('✅ Pierre login successful!');
    console.log(`   Role: ${authData.record.role}`);
    console.log(`   ID: ${authData.record.id}`);
    console.log(`   Name: ${authData.record.name}`);
  } catch (error) {
    console.log('❌ Pierre login failed:', error.message);
  }
  
  console.log('\n🎯 Authentication test complete!');
}

testAuthentication();
