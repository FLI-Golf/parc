import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function setupFinalUsers() {
  console.log('🔧 Setting up test users with admin access...\n');
  
  try {
    // Login as admin
    await pb.admins.authWithPassword('ddinsmore8@gmail.com', 'MADcap(123)');
    console.log('✅ Admin login successful');
    
    // Test users to set up
    const testUsers = [
      {
        id: 'y75ww2u9169kinb',
        email: 'marie.rousseau@parcbistro.com',
        password: 'test123',
        name: 'Marie Rousseau',
        role: 'Server'
      },
      {
        id: 'f191z14z2679pzf', 
        email: 'pierre.dubois@parcbistro.com',
        password: 'test123',
        name: 'Pierre Dubois',
        role: 'Manager'
      }
    ];
    
    for (const userData of testUsers) {
      try {
        // Update existing user
        await pb.collection('users').update(userData.id, {
          password: userData.password,
          passwordConfirm: userData.password,
          role: userData.role,
          name: userData.name
        });
        
        console.log(`✅ Updated: ${userData.name} (${userData.role})`);
        
        // Test login immediately
        const testAuth = await pb.collection('users').authWithPassword(
          userData.email, 
          userData.password
        );
        console.log(`   🔐 Login test: SUCCESS (ID: ${testAuth.record.id})`);
        
      } catch (error) {
        console.log(`❌ Failed to update ${userData.name}:`, error.message);
      }
    }
    
    console.log('\n🎯 Test credentials ready:');
    console.log('📧 marie.rousseau@parcbistro.com / test123 (Server)');
    console.log('📧 pierre.dubois@parcbistro.com / test123 (Manager)');
    console.log('\n✅ Ready for Test #1: Basic Order Flow!');
    
  } catch (error) {
    console.log('❌ Admin setup failed:', error.message);
  }
}

setupFinalUsers();
