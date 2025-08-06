import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function testCollections() {
  console.log('🧪 PARC Collection Status Check\n');
  
  const criticalCollections = [
    'users',
    'menu_collection', 
    'tickets_collection',
    'ticket_items_collection', 
    'payments_collection',
    'completed_orders',
    'tables_collection',
    'staff_collection'
  ];
  
  let ready = true;
  
  for (const collection of criticalCollections) {
    try {
      await pb.collection(collection).getList(1, 1);
      console.log(`✅ ${collection}`);
    } catch (error) {
      if (error.status === 404) {
        console.log(`❌ ${collection} - MISSING`);
        ready = false;
      } else if (error.status === 401) {
        console.log(`🔒 ${collection} - EXISTS (requires auth)`);
      } else {
        console.log(`⚠️  ${collection} - ERROR ${error.status}`);
        ready = false;
      }
    }
  }
  
  console.log(`\n🎯 Testing Status: ${ready ? '✅ READY' : '❌ NOT READY'}`);
  
  console.log('\n💳 Stripe Test Cards (Safe):');
  console.log('✅ 4242424242424242 - Success');
  console.log('❌ 4000000000000002 - Declined');
  
  return ready;
}

testCollections();
