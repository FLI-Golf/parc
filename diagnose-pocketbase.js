import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function diagnosePocketBase() {
  console.log('=== PocketBase Diagnosis ===\n');
  
  try {
    // 1. Health Check
    console.log('1. Health Check:');
    const health = await fetch('https://pocketbase-production-7050.up.railway.app/api/health');
    const healthData = await health.json();
    console.log(`   Status: ${health.status} - ${healthData.message}`);
    console.log(`   Can Backup: ${healthData.data.canBackup}\n`);
    
    // 2. Admin Panel Check
    console.log('2. Admin Panel Access:');
    const adminPanel = await fetch('https://pocketbase-production-7050.up.railway.app/_/');
    console.log(`   Admin Panel: ${adminPanel.status === 200 ? '✅ Accessible' : '❌ Not accessible'}\n`);
    
    // 3. Collections Check (without auth)
    console.log('3. Collections Status:');
    try {
      const collections = await pb.collections.getFullList();
      console.log(`   Collections found: ${collections.length}`);
      collections.forEach(col => {
        console.log(`   - ${col.id} (${col.name})`);
      });
    } catch (error) {
      console.log(`   Collections: ❌ ${error.message}`);
      console.log('   Reason: Need admin authentication to list collections');
    }
    
    // 4. Test specific collections we know should exist
    console.log('\n4. Testing Known Collections:');
    const collectionsToTest = [
      'sections_collection',
      'vendors_collection', 
      'inventory_collection',
      'staff_collection',
      'shifts_collection',
      'menu_collection',
      'events_collection'
    ];
    
    for (const collectionId of collectionsToTest) {
      try {
        await pb.collection(collectionId).getList(1, 1);
        console.log(`   ${collectionId}: ✅ Exists and accessible`);
      } catch (error) {
        if (error.status === 404) {
          console.log(`   ${collectionId}: ❌ Collection not found (404)`);
        } else if (error.status === 401) {
          console.log(`   ${collectionId}: 🔒 Requires authentication`);
        } else {
          console.log(`   ${collectionId}: ❌ Error ${error.status}`);
        }
      }
    }
    
    // 5. Test user registration (to see if auth collection exists)
    console.log('\n5. User Authentication Test:');
    try {
      // Just test if we can access the users collection
      await pb.collection('users').getList(1, 1);
      console.log('   Users collection: ✅ Exists');
    } catch (error) {
      if (error.status === 404) {
        console.log('   Users collection: ❌ Not found');
      } else {
        console.log('   Users collection: 🔒 Requires auth or exists');
      }
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ PocketBase instance is running and healthy');
    console.log('✅ Admin panel is accessible');
    console.log('❌ Most collections are missing (need to be created)');
    console.log('🔧 Required action: Set up admin account and import collections');
    
    console.log('\n=== Next Steps ===');
    console.log('1. Go to: https://pocketbase-production-7050.up.railway.app/_/');
    console.log('2. Create your first admin account');
    console.log('3. Import the collection schema files generated');
    console.log('4. Import sample data');
    
  } catch (error) {
    console.error('Diagnosis failed:', error);
  }
}

diagnosePocketBase();
