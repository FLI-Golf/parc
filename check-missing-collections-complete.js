import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function checkAllCollections() {
  // ALL collections the app uses (comprehensive list)
  const requiredCollections = [
    // Core Authentication
    'users',                        // Built-in PocketBase auth collection
    
    // Menu & Catalog
    'menu_collection',              // Menu items
    'menu_categories',              // Menu categories  
    'menu_modifiers',               // Item modifiers
    'sections_collection',          // Restaurant sections
    
    // Orders & Tickets
    'tickets_collection',           // Order tickets
    'ticket_items_collection',      // Individual order items
    'completed_orders',             // Historical completed orders
    
    // Payments
    'payments_collection',          // Payment records (with Stripe integration)
    
    // Tables & Service
    'tables_collection',            // Restaurant tables
    'table_updates_collection',     // Table status changes
    
    // Staff & Operations  
    'staff_collection',             // Staff members
    'shifts_collection',            // Staff shifts/schedules
    'events_collection',            // Restaurant events
    
    // Inventory & Supplies
    'inventory_collection',         // Inventory items
    'vendors_collection',           // Vendor information
    
    // Maintenance (if used)
    'maintenance_records',
    'maintenance_records_collection',
    'maintenance_tasks', 
    'maintenance_tasks_collection',
    'maintenance_schedules',
    'maintenance_schedules_collection'
  ];

  console.log('🧪 PARC TESTING: Collection Status Check');
  console.log('==========================================\n');
  
  let existingCount = 0;
  let missingCount = 0;
  let errorCount = 0;
  
  const missing = [];
  const existing = [];
  const errors = [];
  
  for (const collection of requiredCollections) {
    try {
      await pb.collection(collection).getList(1, 1);
      console.log(`✅ ${collection.padEnd(35)} - EXISTS`);
      existing.push(collection);
      existingCount++;
    } catch (error) {
      if (error.status === 404) {
        console.log(`❌ ${collection.padEnd(35)} - MISSING (404)`);
        missing.push(collection);
        missingCount++;
      } else if (error.status === 401) {
        console.log(`🔒 ${collection.padEnd(35)} - EXISTS (requires auth)`);
        existing.push(collection);
        existingCount++;
      } else {
        console.log(`⚠️  ${collection.padEnd(35)} - ERROR ${error.status}`);
        errors.push({ collection, error: error.status });
        errorCount++;
      }
    }
  }

  console.log('\n📊 SUMMARY');
  console.log('===========');
  console.log(`✅ Existing: ${existingCount}/${requiredCollections.length}`);
  console.log(`❌ Missing:  ${missingCount}/${requiredCollections.length}`);
  console.log(`⚠️  Errors:   ${errorCount}/${requiredCollections.length}`);
  
  if (missingCount > 0) {
    console.log('\n🚨 MISSING COLLECTIONS');
    console.log('========================');
    console.log('You need to create these collections in PocketBase admin:');
    console.log('URL: https://pocketbase-production-7050.up.railway.app/_/');
    console.log('');
    
    missing.forEach(collection => {
      console.log(`- ${collection}`);
      
      // Suggest schema files if they exist
      const schemaFiles = [
        `${collection}_schema.json`,
        `${collection.replace('_collection', '')}_schema.json`,
        'ticket_system_collections.json',
        'enhanced_menu_collections.json'
      ];
      
      console.log(`  Schema: Check ${schemaFiles.join(' or ')}`);
    });
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️  COLLECTION ERRORS');
    console.log('=====================');
    errors.forEach(({ collection, error }) => {
      console.log(`- ${collection}: HTTP ${error}`);
    });
  }
  
  console.log('\n🎯 TESTING READINESS');
  console.log('====================');
  
  const criticalCollections = [
    'users', 'menu_collection', 'tickets_collection', 
    'ticket_items_collection', 'payments_collection', 
    'tables_collection', 'staff_collection'
  ];
  
  const criticalMissing = missing.filter(c => criticalCollections.includes(c));
  
  if (criticalMissing.length === 0) {
    console.log('✅ READY FOR TESTING - All critical collections exist');
    console.log('');
    console.log('🧪 Next Steps:');
    console.log('1. Run payment tests with Stripe test cards');
    console.log('2. Test manager override functionality');  
    console.log('3. Verify order → payment → completion flow');
    console.log('4. Check inventory tracking accuracy');
  } else {
    console.log('❌ NOT READY - Missing critical collections:');
    criticalMissing.forEach(c => console.log(`   - ${c}`));
    console.log('');
    console.log('⚠️  Create missing collections before testing!');
  }
  
  console.log('\n💳 STRIPE TESTING');
  console.log('=================');
  console.log('Test Cards (Safe - No Real Charges):');
  console.log('✅ 4242424242424242 - Success');
  console.log('❌ 4000000000000002 - Declined');
  console.log('💰 4000000000009995 - Insufficient funds');
  console.log('📅 4000000000000069 - Expired');
  console.log('');
  console.log('Use any future date (12/34) and any CVC (123)');
}

checkAllCollections().catch(console.error);
</invoke>
