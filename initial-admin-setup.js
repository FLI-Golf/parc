import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function createInitialAdmin() {
  console.log('🔧 Attempting to create initial admin...\n');
  
  try {
    // For some PocketBase instances, you can create the first admin directly
    const admin = await pb.admins.create({
      email: 'admin@parcbistro.com',
      password: 'parcmanager123'
    });
    
    console.log('✅ Initial admin created successfully!');
    console.log('📧 Email: admin@parcbistro.com');
    console.log('🔒 Password: parcmanager123');
    
    return true;
  } catch (error) {
    console.log('❌ Initial admin creation failed:', error.message);
    console.log('Status:', error.status);
    
    if (error.status === 403) {
      console.log('\n💡 This suggests admin already exists or setup is complete');
      console.log('🔍 Possible existing credentials to try:');
      console.log('   - Check your deployment logs');
      console.log('   - Look for Railway/Fly.io environment variables');
      console.log('   - Contact support for reset');
    }
    
    return false;
  }
}

// Try the setup
createInitialAdmin().then(success => {
  if (success) {
    console.log('\n🎯 Ready to proceed with test user creation!');
  } else {
    console.log('\n⚠️  Manual intervention required for admin setup');
  }
});
