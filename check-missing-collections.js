import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function checkMissingCollections() {
  // Collections the app is trying to access
  const requiredCollections = [
    'inventory_collection',
    'staff_collection', 
    'shifts_collection',
    'menu_collection',
    'events_collection',
    'tables_collection',
    'table_updates_collection',
    'vendors_collection',
    'sections_collection',
    'maintenance_records',
    'maintenance_records_collection',
    'maintenance_tasks',
    'maintenance_tasks_collection',
    'maintenance_schedules',
    'maintenance_schedules_collection'
  ];

  console.log('=== Checking Required Collections ===\n');
  
  for (const collection of requiredCollections) {
    try {
      await pb.collection(collection).getList(1, 1);
      console.log(`✅ ${collection} - EXISTS`);
    } catch (error) {
      if (error.status === 404) {
        console.log(`❌ ${collection} - MISSING (404)`);
      } else if (error.status === 401) {
        console.log(`🔒 ${collection} - EXISTS (requires auth)`);
      } else {
        console.log(`⚠️  ${collection} - ERROR ${error.status}`);
      }
    }
  }

  console.log('\n=== Missing Collections to Create ===');
  console.log('You need to create these collections in PocketBase admin:');
  
  const missingSchemas = [
    'tables_collection_schema.json',
    'table_updates_collection_schema.json',
    'maintenance_records_schema.json',
    'maintenance_tasks_schema.json', 
    'maintenance_schedules_schema.json',
    'staff_collection_schema.json',
    'vendors_collection_schema.json'
  ];

  missingSchemas.forEach(schema => {
    console.log(`- Import: ${schema}`);
  });

  console.log('\n=== Admin Panel ===');
  console.log('Go to: https://pocketbase-production-7050.up.railway.app/_/');
}

checkMissingCollections();
